"use server";

import { revalidatePath } from "next/cache";
import { krev, requireTenant } from "@/lib/auth";
import {
  lesFelter,
  lesSvar,
  manglerSvar,
  type Felt,
  type Svar,
} from "@/lib/skjema";
import type { TenantDb } from "@/lib/tenant";
import type { Modul } from "@/lib/rettigheter";

export type Resultat = { ok: boolean; feil?: string; melding?: string };

/**
 * Utfylte skjemaer på en jobb eller et avvik.
 *
 * Tilgangen følger det skjemaet henger på: kan du endre arbeidsordren, kan du
 * fylle ut skjemaene på den. Det er samme regel som for bilder og kommentarer,
 * og da er den lett å forstå.
 */

type Feste =
  | { type: "arbeidsordre"; id: string }
  | { type: "avvik"; id: string };

const MODUL: Record<Feste["type"], Modul> = {
  arbeidsordre: "arbeidsordre",
  avvik: "avvik",
};

function sti(feste: Feste): string {
  return `/${feste.type}/${feste.id}`;
}

async function finnFeste(
  db: TenantDb,
  skjemaId: string,
): Promise<{ feste: Feste; laast: boolean; felter: Felt[] } | null> {
  const svar = await db.formResponse.findFirst({
    where: { id: skjemaId },
    select: {
      workOrderId: true,
      deviationId: true,
      status: true,
      schemaSnapshot: true,
    },
  });

  if (!svar) return null;

  const feste: Feste = svar.workOrderId
    ? { type: "arbeidsordre", id: svar.workOrderId }
    : { type: "avvik", id: svar.deviationId ?? "" };

  return {
    feste,
    laast: svar.status === "LAAST",
    felter: lesFelter(svar.schemaSnapshot),
  };
}

/**
 * Starter et skjema fra en mal.
 *
 * Feltene kopieres inn i det samme øyeblikket. Endrer noen malen etterpå,
 * står dette skjemaet med spørsmålene det faktisk ble fylt ut fra.
 */
export async function startSkjema(formData: FormData): Promise<void> {
  const { db, session } = await requireTenant();

  const malId = String(formData.get("malId") ?? "");
  const festeType = String(formData.get("festeType") ?? "");
  const festeId = String(formData.get("festeId") ?? "");

  if (festeType !== "arbeidsordre" && festeType !== "avvik") {
    throw new Error("Ukjent type.");
  }
  const feste: Feste = { type: festeType, id: festeId };

  krev(session, MODUL[feste.type], "endre");

  const mal = await db.formTemplate.findFirst({
    where: { id: malId, isActive: true },
    select: { id: true, name: true, version: true, fields: true },
  });
  if (!mal) throw new Error("Fant ikke malen.");

  await db.formResponse.create({
    data: {
      organizationId: session.organizationId,
      templateId: mal.id,
      templateName: mal.name,
      templateVersion: mal.version,
      // Kopien. Se kommentaren over.
      schemaSnapshot: mal.fields ?? [],
      workOrderId: feste.type === "arbeidsordre" ? feste.id : null,
      deviationId: feste.type === "avvik" ? feste.id : null,
      startedById: session.userId,
    },
  });

  revalidatePath(sti(feste));
}

/** Lagrer svarene. Kan gjøres så mange ganger man vil, helt til skjemaet låses. */
export async function lagreSvar(
  skjemaId: string,
  _forrige: Resultat,
  formData: FormData,
): Promise<Resultat> {
  const { db, session } = await requireTenant();

  const info = await finnFeste(db, skjemaId);
  if (!info) return { ok: false, feil: "Fant ikke skjemaet." };

  krev(session, MODUL[info.feste.type], "endre");

  if (info.laast) {
    return { ok: false, feil: "Skjemaet er låst og kan ikke endres." };
  }

  // Svarene bygges ut fra feltene i kopien, ikke ut fra hva skjemaet sendte.
  // Da kan ingen legge inn svar på spørsmål som ikke finnes.
  const rå: Record<string, unknown> = {};

  for (const felt of info.felter) {
    if (felt.type === "flervalg") {
      rå[felt.id] = formData.getAll(felt.id).map(String);
    } else if (felt.type === "avkryssing") {
      rå[felt.id] = formData.get(felt.id) === "ja";
    } else {
      const v = formData.get(felt.id);
      rå[felt.id] = v === null ? null : String(v);
    }
  }

  const svar: Svar = lesSvar(rå, info.felter);

  await db.formResponse.updateMany({
    where: { id: skjemaId },
    data: { answers: svar },
  });

  revalidatePath(sti(info.feste));
  return { ok: true, melding: "Lagret." };
}

/**
 * Låser skjemaet.
 *
 * Alle påkrevde felter må være besvart. Et halvferdig SJA er verre enn
 * ingen — det ser ut som om noen har vurdert risikoen.
 */
export async function laasSkjema(skjemaId: string): Promise<Resultat> {
  const { db, session } = await requireTenant();

  const info = await finnFeste(db, skjemaId);
  if (!info) return { ok: false, feil: "Fant ikke skjemaet." };

  krev(session, MODUL[info.feste.type], "endre");
  if (info.laast) return { ok: true };

  const rad = await db.formResponse.findFirstOrThrow({
    where: { id: skjemaId },
    select: { answers: true },
  });

  const mangler = manglerSvar(info.felter, lesSvar(rad.answers, info.felter));

  if (mangler.length > 0) {
    return {
      ok: false,
      feil: `Disse må fylles ut først: ${mangler.map((f) => f.etikett).join(", ")}.`,
    };
  }

  await db.formResponse.updateMany({
    where: { id: skjemaId },
    data: { status: "LAAST", lockedAt: new Date(), lockedById: session.userId },
  });

  revalidatePath(sti(info.feste));
  return { ok: true, melding: "Skjemaet er låst." };
}

/** Åpner et låst skjema igjen. Krever at man kan administrere modulen. */
export async function laasOppSkjema(skjemaId: string): Promise<Resultat> {
  const { db, session } = await requireTenant();

  const info = await finnFeste(db, skjemaId);
  if (!info) return { ok: false, feil: "Fant ikke skjemaet." };

  krev(session, MODUL[info.feste.type], "administrere");

  await db.formResponse.updateMany({
    where: { id: skjemaId },
    data: { status: "UTKAST", lockedAt: null, lockedById: null },
  });

  revalidatePath(sti(info.feste));
  return { ok: true };
}

/** Fjerner et skjema som ikke skulle vært startet. Bare utkast. */
export async function slettSkjema(skjemaId: string): Promise<Resultat> {
  const { db, session } = await requireTenant();

  const info = await finnFeste(db, skjemaId);
  if (!info) return { ok: false, feil: "Fant ikke skjemaet." };

  krev(session, MODUL[info.feste.type], "administrere");

  if (info.laast) {
    return {
      ok: false,
      feil:
        "Låste skjemaer kan ikke slettes. Lås opp først hvis det virkelig må bort.",
    };
  }

  await db.formResponse.deleteMany({ where: { id: skjemaId } });

  revalidatePath(sti(info.feste));
  return { ok: true };
}

/**
 * Låser alle utkast på en jobb.
 *
 * Kalles når arbeidsordren lukkes. Et SJA er et dokument fra den dagen jobben
 * ble gjort — det skal ikke kunne endres uka etter fordi noen husker det
 * annerledes.
 */
export async function laasSkjemaerPaaOrdre(
  db: TenantDb,
  brukerId: string,
  workOrderId: string,
): Promise<number> {
  const svar = await db.formResponse.updateMany({
    where: { workOrderId, status: "UTKAST" },
    data: { status: "LAAST", lockedAt: new Date(), lockedById: brukerId },
  });

  return svar.count;
}
