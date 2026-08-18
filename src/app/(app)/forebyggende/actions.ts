"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { assertRole, requireTenant } from "@/lib/auth";
import { nextCounterValue } from "@/lib/tenant";
import { APNE_STATUSER } from "@/lib/domene";

export type Resultat = { ok: boolean; feil?: string; melding?: string };

const planSkjema = z.object({
  name: z.string().trim().min(3, "Navnet må ha minst tre tegn."),
  description: z.string().trim().optional(),
  assetId: z.string().min(1, "Velg hvilket utstyr planen gjelder."),
  trigger: z.enum(["TID", "DRIFTSTIMER"]),
  intervalDays: z.string().trim().optional(),
  intervalHours: z.string().trim().optional(),
  leadTimeDays: z.coerce.number().int().min(0).max(365).default(7),
  estimatedHours: z.string().trim().optional(),
  priority: z.enum(["KRITISK", "HOY", "NORMAL", "LAV"]),
  assignedToId: z.string().trim().optional(),
  checklist: z.string().trim().optional(),
  nextDueAt: z.string().trim().optional(),
});

export async function opprettPlan(
  _forrige: Resultat,
  formData: FormData,
): Promise<Resultat> {
  const { db, session } = await requireTenant();
  assertRole(session.role, "PLANLEGGER");

  const parsed = planSkjema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, feil: parsed.error.issues[0].message };
  const d = parsed.data;

  const dager = d.intervalDays ? Number(d.intervalDays) : null;
  const timer = d.intervalHours ? Number(d.intervalHours) : null;

  if (d.trigger === "TID" && (!dager || dager < 1)) {
    return { ok: false, feil: "Oppgi hvor mange dager det skal gå mellom hver gang." };
  }
  if (d.trigger === "DRIFTSTIMER" && (!timer || timer < 1)) {
    return { ok: false, feil: "Oppgi hvor mange driftstimer det skal gå mellom hver gang." };
  }

  const utstyr = await db.asset.findFirst({ where: { id: d.assetId } });
  if (!utstyr) return { ok: false, feil: "Fant ikke utstyret." };

  // Sjekklista skrives som én linje per punkt
  const punkter = (d.checklist ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const forste = d.nextDueAt ? new Date(d.nextDueAt) : null;

  await db.pmPlan.create({
    data: {
      organizationId: session.organizationId,
      name: d.name,
      description: d.description || null,
      assetId: d.assetId,
      trigger: d.trigger,
      intervalDays: d.trigger === "TID" ? dager : null,
      intervalHours: d.trigger === "DRIFTSTIMER" ? timer : null,
      leadTimeDays: d.leadTimeDays,
      estimatedHours: d.estimatedHours ? Number(d.estimatedHours) : null,
      priority: d.priority,
      assignedToId: d.assignedToId || null,
      checklist: punkter,
      lastDoneHours: d.trigger === "DRIFTSTIMER" ? utstyr.runningHours : null,
      nextDueAt:
        forste && !Number.isNaN(forste.getTime())
          ? forste
          : d.trigger === "TID" && dager
            ? new Date(Date.now() + dager * 86400_000)
            : null,
    },
  });

  revalidatePath("/forebyggende");
  redirect("/forebyggende");
}

/**
 * Oppretter arbeidsordre for planer som nærmer seg forfall.
 *
 * En plan hoppes over hvis den allerede har en åpen arbeidsordre — ellers
 * ville hver kjøring lage en ny duplikatjobb på det samme.
 */
export async function genererForfalteOrdrer(): Promise<Resultat> {
  const { db, session } = await requireTenant();
  assertRole(session.role, "PLANLEGGER");

  const nå = new Date();

  const planer = await db.pmPlan.findMany({
    where: { isActive: true },
    include: {
      asset: { select: { id: true, code: true, name: true, runningHours: true } },
      workOrders: {
        where: { status: { in: APNE_STATUSER } },
        select: { id: true },
      },
    },
  });

  let opprettet = 0;

  for (const plan of planer) {
    if (plan.workOrders.length > 0) continue;

    let forfaller = false;
    if (plan.trigger === "TID") {
      const grense = new Date(nå.getTime() + plan.leadTimeDays * 86400_000);
      forfaller = plan.nextDueAt != null && plan.nextDueAt <= grense;
    } else if (plan.intervalHours) {
      const sidenSist = plan.asset.runningHours - (plan.lastDoneHours ?? 0);
      forfaller = sidenSist >= plan.intervalHours;
    }

    if (!forfaller) continue;

    const number = await nextCounterValue(session.organizationId, "workOrder");
    const punkter = Array.isArray(plan.checklist) ? (plan.checklist as string[]) : [];

    await db.workOrder.create({
      data: {
        organizationId: session.organizationId,
        number,
        title: plan.name,
        description: plan.description,
        type: "FOREBYGGENDE",
        status: "PLANLAGT",
        priority: plan.priority,
        assetId: plan.assetId,
        pmPlanId: plan.id,
        requestedById: session.userId,
        assignedToId: plan.assignedToId,
        estimatedHours: plan.estimatedHours,
        dueDate: plan.nextDueAt,
        plannedDate: plan.nextDueAt,
        checklist: {
          create: punkter.map((text, i) => ({ text: String(text), sortOrder: i })),
        },
      },
    });
    opprettet += 1;
  }

  revalidatePath("/forebyggende");
  revalidatePath("/arbeidsordre");
  revalidatePath("/ukeplan");
  revalidatePath("/dashbord");

  return {
    ok: true,
    melding:
      opprettet === 0
        ? "Ingen planer forfaller ennå — ingen nye arbeidsordre laget."
        : `Opprettet ${opprettet} arbeidsordre fra forebyggende planer.`,
  };
}

/** Markerer en plan som utført og beregner neste forfall. */
export async function markerPlanUtfort(planId: string): Promise<Resultat> {
  const { db, session } = await requireTenant();
  assertRole(session.role, "TEKNIKER");

  const plan = await db.pmPlan.findFirst({
    where: { id: planId },
    include: { asset: { select: { runningHours: true } } },
  });
  if (!plan) return { ok: false, feil: "Fant ikke planen." };

  const nå = new Date();
  // Neste forfall regnes fra i dag, ikke fra forrige planlagte dato. Da
  // hoper ikke etterslepet seg opp hvis en jobb ble utsatt.
  const neste =
    plan.trigger === "TID" && plan.intervalDays
      ? new Date(nå.getTime() + plan.intervalDays * 86400_000)
      : null;

  await db.pmPlan.update({
    where: { id: planId },
    data: {
      lastDoneAt: nå,
      nextDueAt: neste,
      lastDoneHours:
        plan.trigger === "DRIFTSTIMER" ? plan.asset.runningHours : plan.lastDoneHours,
    },
  });

  revalidatePath("/forebyggende");
  return { ok: true };
}

export async function settPlanAktiv(
  planId: string,
  aktiv: boolean,
): Promise<Resultat> {
  const { db, session } = await requireTenant();
  assertRole(session.role, "PLANLEGGER");

  await db.pmPlan.updateMany({ where: { id: planId }, data: { isActive: aktiv } });
  revalidatePath("/forebyggende");
  return { ok: true };
}
