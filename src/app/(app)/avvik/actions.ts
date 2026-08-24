"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { krev, requireTenant } from "@/lib/auth";
import { nextCounterValue } from "@/lib/tenant";
import { NESTE_AVVIK_STATUS } from "@/lib/domene";
import type { DeviationStatus } from "@/generated/prisma/client";

export type Resultat = { ok: boolean; feil?: string; melding?: string };

const nyttAvvik = z.object({
  title: z.string().trim().min(4, "Skriv en kort overskrift på minst fire tegn."),
  description: z.string().trim().min(10, "Beskriv hva som skjedde."),
  type: z.enum(["HMS", "NAERULYKKE", "KVALITET", "MILJO", "ANNET"]),
  severity: z.enum(["LAV", "MIDDELS", "HOY", "KRITISK"]),
  assetId: z.string().trim().optional(),
  location: z.string().trim().optional(),
  occurredAt: z.string().trim().min(1, "Når skjedde det?"),
  immediateAction: z.string().trim().optional(),
});

/**
 * Melder et avvik.
 *
 * Kravet er «endre», ikke «administrere». Et avvikssystem der teknikeren må
 * be om lov til å rapportere en nestenulykke, blir ikke brukt — og da er det
 * verdiløst.
 */
export async function meldAvvik(
  _forrige: Resultat,
  formData: FormData,
): Promise<Resultat> {
  const { db, session } = await requireTenant();
  krev(session, "avvik", "endre");

  const parsed = nyttAvvik.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, feil: parsed.error.issues[0].message };
  }
  const d = parsed.data;

  const skjedde = new Date(d.occurredAt);
  if (Number.isNaN(skjedde.getTime())) {
    return { ok: false, feil: "Datoen kunne ikke leses." };
  }

  const number = await nextCounterValue(session.organizationId, "deviation");

  const avvik = await db.deviation.create({
    data: {
      organizationId: session.organizationId,
      number,
      title: d.title,
      description: d.description,
      type: d.type,
      severity: d.severity,
      assetId: d.assetId || null,
      location: d.location || null,
      occurredAt: skjedde,
      reportedById: session.userId,
      immediateAction: d.immediateAction || null,
    },
  });

  revalidatePath("/avvik");
  redirect(`/avvik/${avvik.id}`);
}

const behandling = z.object({
  assignedToId: z.string().trim().optional(),
  rootCause: z.string().trim().optional(),
  correctiveAction: z.string().trim().optional(),
  immediateAction: z.string().trim().optional(),
  deadline: z.string().trim().optional(),
  severity: z.enum(["LAV", "MIDDELS", "HOY", "KRITISK"]).optional(),
});

/** Lagrer behandlingen: ansvarlig, årsak, tiltak og frist. */
export async function lagreBehandling(
  avvikId: string,
  _forrige: Resultat,
  formData: FormData,
): Promise<Resultat> {
  const { db, session } = await requireTenant();
  krev(session, "avvik", "administrere");

  const parsed = behandling.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, feil: parsed.error.issues[0].message };
  }
  const d = parsed.data;

  const frist = d.deadline ? new Date(d.deadline) : null;
  if (frist && Number.isNaN(frist.getTime())) {
    return { ok: false, feil: "Fristen kunne ikke leses." };
  }

  const antall = await db.deviation.updateMany({
    where: { id: avvikId },
    data: {
      assignedToId: d.assignedToId || null,
      rootCause: d.rootCause || null,
      correctiveAction: d.correctiveAction || null,
      immediateAction: d.immediateAction || null,
      deadline: frist,
      ...(d.severity ? { severity: d.severity } : {}),
    },
  });

  if (antall.count === 0) return { ok: false, feil: "Fant ikke avviket." };

  revalidatePath(`/avvik/${avvikId}`);
  return { ok: true, melding: "Lagret." };
}

/**
 * Flytter avviket til neste steg.
 *
 * Lovlige overganger står i NESTE_AVVIK_STATUS. Et avvik kan ikke lukkes rett
 * fra «meldt»: da har ingen skrevet ned hvorfor det skjedde, og registreringen
 * er redusert til en logg over ting som gikk galt.
 */
export async function settAvviksStatus(
  avvikId: string,
  status: DeviationStatus,
): Promise<Resultat> {
  const { db, session } = await requireTenant();
  krev(session, "avvik", "administrere");

  const avvik = await db.deviation.findFirst({
    where: { id: avvikId },
    select: { status: true, rootCause: true, correctiveAction: true },
  });
  if (!avvik) return { ok: false, feil: "Fant ikke avviket." };

  if (!NESTE_AVVIK_STATUS[avvik.status].includes(status)) {
    return { ok: false, feil: "Det steget er ikke lovlig herfra." };
  }

  if (status === "TILTAK_IVERKSATT" && !avvik.correctiveAction) {
    return {
      ok: false,
      feil: "Skriv inn hvilket tiltak som er satt i verk før du går videre.",
    };
  }

  if (status === "LUKKET" && !avvik.rootCause) {
    return {
      ok: false,
      feil: "Skriv inn årsaken før avviket lukkes. Uten den lærer ingen noe av det.",
    };
  }

  await db.deviation.updateMany({
    where: { id: avvikId },
    data: {
      status,
      closedAt: status === "LUKKET" ? new Date() : null,
    },
  });

  revalidatePath(`/avvik/${avvikId}`);
  revalidatePath("/avvik");
  return { ok: true };
}

/**
 * Lager en arbeidsordre av avviket.
 *
 * Et avvik forklarer hva som gikk galt; arbeidsordren er jobben som retter
 * det. De to henger sammen, og lenka går begge veier, slik at den som leser
 * jobben senere skjønner hvorfor den ble opprettet.
 */
export async function lagArbeidsordre(avvikId: string): Promise<Resultat> {
  const { db, session } = await requireTenant();
  krev(session, "avvik", "administrere");
  krev(session, "arbeidsordre", "endre");

  const avvik = await db.deviation.findFirst({
    where: { id: avvikId },
    select: {
      id: true,
      number: true,
      title: true,
      description: true,
      severity: true,
      assetId: true,
      workOrderId: true,
    },
  });
  if (!avvik) return { ok: false, feil: "Fant ikke avviket." };
  if (avvik.workOrderId) {
    return { ok: false, feil: "Det er allerede laget en arbeidsordre." };
  }

  const number = await nextCounterValue(session.organizationId, "workOrder");

  const ordre = await db.workOrder.create({
    data: {
      organizationId: session.organizationId,
      number,
      title: avvik.title,
      description: `Opprettet fra avvik AV-${String(avvik.number).padStart(4, "0")}.\n\n${avvik.description}`,
      type: "KORREKTIV",
      priority:
        avvik.severity === "KRITISK"
          ? "KRITISK"
          : avvik.severity === "HOY"
            ? "HOY"
            : "NORMAL",
      assetId: avvik.assetId,
      requestedById: session.userId,
    },
  });

  await db.deviation.updateMany({
    where: { id: avvikId },
    data: { workOrderId: ordre.id },
  });

  revalidatePath(`/avvik/${avvikId}`);
  return { ok: true, melding: "Arbeidsordren er opprettet." };
}
