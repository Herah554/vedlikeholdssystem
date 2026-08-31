"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { krev, requireTenant } from "@/lib/auth";
import { nextCounterValue } from "@/lib/tenant";
import { laasSkjemaerPaaOrdre } from "@/app/(app)/skjema/actions";
import { NESTE_STATUS } from "@/lib/domene";
import type { WorkOrderStatus } from "@/generated/prisma/client";

/**
 * Alle endringer på arbeidsordre.
 *
 * Hver handling henter sesjonen på nytt gjennom requireTenant(). Det som
 * kommer inn fra nettleseren brukes aldri til å avgjøre hvem brukeren er
 * eller hvilket firma hen tilhører — det leses kun fra sesjonskapselen.
 */

export type Resultat = { ok: boolean; feil?: string; melding?: string };

const nyOrdreSkjema = z.object({
  title: z.string().trim().min(3, "Tittelen må ha minst tre tegn."),
  description: z.string().trim().optional(),
  type: z.enum(["KORREKTIV", "FOREBYGGENDE", "INSPEKSJON", "FORBEDRING"]),
  priority: z.enum(["KRITISK", "HOY", "NORMAL", "LAV"]),
  assetId: z.string().trim().optional(),
  assignedToId: z.string().trim().optional(),
  dueDate: z.string().trim().optional(),
  plannedDate: z.string().trim().optional(),
  estimatedHours: z.string().trim().optional(),
});

function tilDato(verdi: string | undefined): Date | null {
  if (!verdi) return null;
  const d = new Date(verdi);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function opprettOrdre(
  _forrige: Resultat,
  formData: FormData,
): Promise<Resultat> {
  const { db, session } = await requireTenant();
  krev(session, "arbeidsordre", "endre");

  const parsed = nyOrdreSkjema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, feil: parsed.error.issues[0].message };
  }
  const d = parsed.data;

  // Utstyret må tilhøre samme organisasjon. Den utvidede klienten filtrerer
  // automatisk, så et fremmed utstyrs-id gir ganske enkelt null her.
  if (d.assetId) {
    const finnes = await db.asset.findFirst({ where: { id: d.assetId } });
    if (!finnes) return { ok: false, feil: "Ukjent utstyr valgt." };
  }
  if (d.assignedToId) {
    const finnes = await db.user.findFirst({ where: { id: d.assignedToId } });
    if (!finnes) return { ok: false, feil: "Ukjent bruker valgt." };
  }

  const number = await nextCounterValue(session.organizationId, "workOrder");

  const ordre = await db.workOrder.create({
    data: {
      organizationId: session.organizationId,
      number,
      title: d.title,
      description: d.description || null,
      type: d.type,
      priority: d.priority,
      status: "MELDT",
      assetId: d.assetId || null,
      assignedToId: d.assignedToId || null,
      requestedById: session.userId,
      dueDate: tilDato(d.dueDate),
      plannedDate: tilDato(d.plannedDate),
      estimatedHours: d.estimatedHours ? Number(d.estimatedHours) : null,
    },
  });

  revalidatePath("/arbeidsordre");
  revalidatePath("/dashbord");
  redirect(`/arbeidsordre/${ordre.id}`);
}

/** Stegene som avgjør om arbeidet er godt nok, ikke om det er gjort. */
const KREVER_ANSVAR: WorkOrderStatus[] = ["GODKJENT", "AVVIST", "LUKKET"];

export async function endreStatus(
  ordreId: string,
  nyStatus: WorkOrderStatus,
): Promise<Resultat> {
  const { db, session } = await requireTenant();
  // Å starte og fullføre en jobb er å gjøre arbeidet. Å godkjenne den, avvise
  // den eller lukke den er å gå god for det — og det er et annet ansvar.
  krev(
    session,
    "arbeidsordre",
    KREVER_ANSVAR.includes(nyStatus) ? "administrere" : "endre",
  );

  const ordre = await db.workOrder.findFirst({ where: { id: ordreId } });
  if (!ordre) return { ok: false, feil: "Fant ikke arbeidsordren." };

  // Statusflyten er definert ett sted, i domene.ts, og håndheves her.
  if (!NESTE_STATUS[ordre.status].includes(nyStatus)) {
    return {
      ok: false,
      feil: `Kan ikke gå fra ${ordre.status} til ${nyStatus}.`,
    };
  }

  const nå = new Date();
  await db.workOrder.update({
    where: { id: ordreId },
    data: {
      status: nyStatus,
      startedAt: nyStatus === "PAAGAAR" && !ordre.startedAt ? nå : ordre.startedAt,
      completedAt: nyStatus === "UTFORT" ? nå : ordre.completedAt,
      closedAt: nyStatus === "LUKKET" ? nå : ordre.closedAt,
    },
  });

  // Et SJA er et dokument fra den dagen jobben ble gjort. Når ordren lukkes,
  // låses utkastene — de skal ikke kunne endres uka etter fordi noen husker
  // det annerledes.
  if (nyStatus === "LUKKET") {
    await laasSkjemaerPaaOrdre(db, session.userId, ordreId);
  }

  revalidatePath(`/arbeidsordre/${ordreId}`);
  revalidatePath("/arbeidsordre");
  revalidatePath("/ukeplan");
  revalidatePath("/dashbord");
  return { ok: true };
}

export async function tildelOrdre(
  ordreId: string,
  brukerId: string | null,
): Promise<Resultat> {
  const { db, session } = await requireTenant();
  krev(session, "arbeidsordre", "endre");

  if (brukerId) {
    const finnes = await db.user.findFirst({ where: { id: brukerId } });
    if (!finnes) return { ok: false, feil: "Ukjent bruker." };
  }

  await db.workOrder.updateMany({
    where: { id: ordreId },
    data: { assignedToId: brukerId },
  });

  revalidatePath(`/arbeidsordre/${ordreId}`);
  revalidatePath("/ukeplan");
  return { ok: true };
}

/** Flytter en jobb til en annen dag i ukeplanen. */
export async function planleggOrdre(
  ordreId: string,
  dato: string | null,
): Promise<Resultat> {
  const { db, session } = await requireTenant();
  krev(session, "arbeidsordre", "endre");

  await db.workOrder.updateMany({
    where: { id: ordreId },
    data: { plannedDate: dato ? new Date(dato) : null },
  });

  revalidatePath("/ukeplan");
  revalidatePath(`/arbeidsordre/${ordreId}`);
  return { ok: true };
}

const timeSkjema = z.object({
  hours: z.coerce.number().positive("Antall timer må være over null.").max(24, "Maks 24 timer per føring."),
  workedOn: z.string().min(1, "Velg dato."),
  note: z.string().trim().optional(),
});

export async function registrerTimer(
  ordreId: string,
  _forrige: Resultat,
  formData: FormData,
): Promise<Resultat> {
  const { db, session } = await requireTenant();
  krev(session, "arbeidsordre", "endre");

  const parsed = timeSkjema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, feil: parsed.error.issues[0].message };

  const ordre = await db.workOrder.findFirst({ where: { id: ordreId } });
  if (!ordre) return { ok: false, feil: "Fant ikke arbeidsordren." };

  // Satsen fryses ved registrering, slik at gamle kostnader ikke endrer seg
  // når timeprisen justeres senere.
  const bruker = await db.user.findFirst({
    where: { id: session.userId },
    include: { organization: { select: { hourlyRate: true } } },
  });
  const sats = bruker?.hourlyRate ?? bruker?.organization.hourlyRate ?? 0;

  await db.timeEntry.create({
    data: {
      organizationId: session.organizationId,
      workOrderId: ordreId,
      userId: session.userId,
      hours: parsed.data.hours,
      workedOn: new Date(parsed.data.workedOn),
      hourlyRate: sats,
      note: parsed.data.note || null,
    },
  });

  revalidatePath(`/arbeidsordre/${ordreId}`);
  revalidatePath("/budsjett");
  return { ok: true };
}

const deleSkjema = z.object({
  partId: z.string().min(1, "Velg en del."),
  quantity: z.coerce.number().positive("Antall må være over null."),
});

/**
 * Tar ut deler til en arbeidsordre.
 *
 * Uttaket, lagerbevegelsen og den nye beholdningen skrives i én transaksjon,
 * så beholdningen kan aldri komme ut av synk med bevegelseshistorikken —
 * heller ikke om to teknikere tar ut samme del samtidig.
 */
export async function registrerDeleuttak(
  ordreId: string,
  _forrige: Resultat,
  formData: FormData,
): Promise<Resultat> {
  const { db, session } = await requireTenant();
  krev(session, "arbeidsordre", "endre");

  const parsed = deleSkjema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, feil: parsed.error.issues[0].message };
  const { partId, quantity } = parsed.data;

  const ordre = await db.workOrder.findFirst({ where: { id: ordreId } });
  if (!ordre) return { ok: false, feil: "Fant ikke arbeidsordren." };

  try {
    await db.$transaction(async (tx) => {
      const del = await tx.part.findFirst({ where: { id: partId } });
      if (!del) throw new Error("Ukjent reservedel.");
      if (del.quantityOnHand < quantity) {
        throw new Error(
          `Ikke nok på lager. Beholdning: ${del.quantityOnHand} ${del.unit}.`,
        );
      }

      await tx.partUsage.create({
        data: {
          organizationId: session.organizationId,
          workOrderId: ordreId,
          partId,
          quantity,
          unitCost: del.unitCost,
        },
      });
      await tx.stockMovement.create({
        data: {
          organizationId: session.organizationId,
          partId,
          type: "UT",
          quantity: -quantity,
          unitCost: del.unitCost,
          workOrderId: ordreId,
          userId: session.userId,
        },
      });
      await tx.part.update({
        where: { id: partId },
        data: { quantityOnHand: { decrement: quantity } },
      });
    });
  } catch (e) {
    return { ok: false, feil: e instanceof Error ? e.message : "Uttaket feilet." };
  }

  revalidatePath(`/arbeidsordre/${ordreId}`);
  revalidatePath("/reservedeler");
  revalidatePath("/dashbord");
  return { ok: true };
}

const losningSkjema = z.object({
  resolution: z.string().trim().min(1, "Beskriv hva som ble gjort."),
  failureCode: z.string().trim().optional(),
  downtimeMinutes: z.string().trim().optional(),
});

/**
 * Lagrer hva som løste feilen.
 *
 * Dette feltet er systemets viktigste kunnskapskilde: det er teksten
 * assistenten senere finner igjen når noen møter samme feil på nytt.
 */
export async function lagreLosning(
  ordreId: string,
  _forrige: Resultat,
  formData: FormData,
): Promise<Resultat> {
  const { db, session } = await requireTenant();
  krev(session, "arbeidsordre", "endre");

  const parsed = losningSkjema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, feil: parsed.error.issues[0].message };

  const minutter = parsed.data.downtimeMinutes
    ? Number(parsed.data.downtimeMinutes)
    : null;

  await db.workOrder.updateMany({
    where: { id: ordreId },
    data: {
      resolution: parsed.data.resolution,
      failureCode: parsed.data.failureCode?.toUpperCase() || null,
      downtimeMinutes: minutter != null && !Number.isNaN(minutter) ? minutter : null,
    },
  });

  revalidatePath(`/arbeidsordre/${ordreId}`);
  return { ok: true };
}

export async function leggTilKommentar(
  ordreId: string,
  _forrige: Resultat,
  formData: FormData,
): Promise<Resultat> {
  const { db, session } = await requireTenant();
  krev(session, "arbeidsordre", "endre");

  const body = String(formData.get("body") ?? "").trim();
  if (!body) return { ok: false, feil: "Skriv en kommentar først." };

  const ordre = await db.workOrder.findFirst({ where: { id: ordreId } });
  if (!ordre) return { ok: false, feil: "Fant ikke arbeidsordren." };

  await db.comment.create({
    data: {
      organizationId: session.organizationId,
      workOrderId: ordreId,
      userId: session.userId,
      body,
    },
  });

  revalidatePath(`/arbeidsordre/${ordreId}`);
  return { ok: true };
}

export async function kryssAvSjekkpunkt(
  ordreId: string,
  punktId: string,
  ferdig: boolean,
): Promise<Resultat> {
  const { db, session } = await requireTenant();
  krev(session, "arbeidsordre", "endre");

  // ChecklistItem har ingen organizationId, så tilhørigheten kontrolleres
  // via arbeidsordren den henger under.
  const ordre = await db.workOrder.findFirst({
    where: { id: ordreId },
    include: { checklist: { where: { id: punktId }, select: { id: true } } },
  });
  if (!ordre || ordre.checklist.length === 0) {
    return { ok: false, feil: "Fant ikke sjekkpunktet." };
  }

  await db.workOrder.update({
    where: { id: ordreId },
    data: {
      checklist: {
        update: {
          where: { id: punktId },
          data: { isDone: ferdig, doneAt: ferdig ? new Date() : null },
        },
      },
    },
  });

  revalidatePath(`/arbeidsordre/${ordreId}`);
  return { ok: true };
}

const endreOrdreSkjema = z.object({
  title: z.string().trim().min(3, "Tittelen må ha minst tre tegn."),
  description: z.string().trim().optional(),
  type: z.string().trim().min(1),
  priority: z.enum(["KRITISK", "HOY", "NORMAL", "LAV"]),
  assetId: z.string().trim().optional(),
  dueDate: z.string().trim().optional(),
  estimatedHours: z.string().trim().optional(),
});

/**
 * Retter opplysningene på en arbeidsordre.
 *
 * Det som meldes inn i farten er sjelden helt riktig: feil maskin, en tittel
 * som ikke sier noe, en frist ingen satte. Uten en vei til å rette det, blir
 * historikken full av ordrer ingen kan søke seg fram til senere.
 *
 * Status står ikke her. Den har sin egen flyt med egne regler, og å kunne
 * hoppe rett til «Lukket» gjennom et redigeringsskjema ville gått utenom
 * dem alle.
 *
 * En lukket ordre kan ikke endres. Da er den historikk — noen har gått god
 * for at jobben ble gjort slik det står — og systemet lover andre steder at
 * historikk ikke endrer mening i ettertid.
 */
export async function endreOrdre(
  ordreId: string,
  _forrige: Resultat,
  formData: FormData,
): Promise<Resultat> {
  const { db, session } = await requireTenant();
  krev(session, "arbeidsordre", "endre");

  const parsed = endreOrdreSkjema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, feil: parsed.error.issues[0].message };
  const d = parsed.data;

  const ordre = await db.workOrder.findFirst({
    where: { id: ordreId },
    select: { id: true, status: true },
  });
  if (!ordre) return { ok: false, feil: "Fant ikke arbeidsordren." };

  if (ordre.status === "LUKKET") {
    return {
      ok: false,
      feil:
        "Ordren er lukket og står som historikk. Skal noe rettes, må den " +
        "åpnes igjen først.",
    };
  }

  // Utstyret må høre til samme bedrift. Uten denne kontrollen kunne en
  // tilfeldig id fra utsiden knytte ordren til en annen kundes maskin.
  if (d.assetId) {
    const utstyr = await db.asset.findFirst({
      where: { id: d.assetId },
      select: { id: true },
    });
    if (!utstyr) return { ok: false, feil: "Fant ikke utstyret." };
  }

  const timer = d.estimatedHours ? Number(d.estimatedHours) : null;

  await db.workOrder.update({
    where: { id: ordreId },
    data: {
      title: d.title,
      description: d.description || null,
      type: d.type,
      priority: d.priority,
      assetId: d.assetId || null,
      dueDate: tilDato(d.dueDate),
      estimatedHours:
        timer != null && !Number.isNaN(timer) && timer > 0 ? timer : null,
    },
  });

  revalidatePath(`/arbeidsordre/${ordreId}`);
  revalidatePath("/arbeidsordre");
  revalidatePath("/ukeplan");
  return { ok: true, melding: "Lagret." };
}
