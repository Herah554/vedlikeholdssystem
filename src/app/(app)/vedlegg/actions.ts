"use server";

import { revalidatePath } from "next/cache";
import { krev, krevFunksjon, requireTenant } from "@/lib/auth";
import type { Modul } from "@/lib/rettigheter";
import { harLagring, lagreFil, sjekkFil, slettFil } from "@/lib/lagring";

/**
 * Vedlegg til arbeidsordre, avvik og utstyr.
 *
 * Hvem som får laste opp følger av hva vedlegget henger på: et bilde på en
 * arbeidsordre krever at man kan endre arbeidsordre, et bilde på et avvik at
 * man kan endre avvik. Det er den samme regelen som gjelder for teksten på
 * samme side, og da blir den lett å forstå.
 */

export type Feste =
  | { type: "arbeidsordre"; id: string }
  | { type: "avvik"; id: string }
  | { type: "anlegg"; id: string };

export type Opplastingssvar = {
  ok: boolean;
  feil?: string;
  antall?: number;
};

const MODUL: Record<Feste["type"], Modul> = {
  arbeidsordre: "arbeidsordre",
  avvik: "avvik",
  anlegg: "anlegg",
};

function lesFeste(formData: FormData): Feste {
  const type = String(formData.get("festeType") ?? "");
  const id = String(formData.get("festeId") ?? "");

  if (!id) throw new Error("Mangler hva vedlegget hører til.");
  if (type !== "arbeidsordre" && type !== "avvik" && type !== "anlegg") {
    throw new Error("Ukjent type.");
  }

  return { type, id };
}

/** Adressen som skal tegnes på nytt etter en endring. */
function sti(feste: Feste): string {
  return feste.type === "anlegg"
    ? `/anlegg/${feste.id}`
    : `/${feste.type}/${feste.id}`;
}

export async function lastOppVedlegg(
  _forrige: Opplastingssvar,
  formData: FormData,
): Promise<Opplastingssvar> {
  const { db, session } = await requireTenant();

  let feste: Feste;
  try {
    feste = lesFeste(formData);
  } catch (e) {
    return { ok: false, feil: e instanceof Error ? e.message : "Ugyldig." };
  }

  krevFunksjon(session, "vedlegg");
  krev(session, MODUL[feste.type], "endre");

  if (!harLagring()) {
    return {
      ok: false,
      feil: "Fillagring er ikke satt opp på denne serveren ennå.",
    };
  }

  // At raden finnes kontrolleres gjennom flerklient-filteret. Uten det kunne
  // en id fra en annen bedrift brukes til å henge et vedlegg på deres data.
  const finnes = await (feste.type === "arbeidsordre"
    ? db.workOrder.findFirst({ where: { id: feste.id }, select: { id: true } })
    : feste.type === "avvik"
      ? db.deviation.findFirst({ where: { id: feste.id }, select: { id: true } })
      : db.asset.findFirst({ where: { id: feste.id }, select: { id: true } }));

  if (!finnes) return { ok: false, feil: "Fant ikke raden vedlegget hører til." };

  const filer = formData.getAll("filer").filter((f): f is File => f instanceof File);
  if (filer.length === 0) return { ok: false, feil: "Velg minst én fil." };

  let antall = 0;

  for (const fil of filer) {
    const kontroll = sjekkFil(fil.name, fil.type, fil.size);
    if (!kontroll.ok) return { ok: false, feil: kontroll.feil, antall };

    const lagret = await lagreFil({
      organizationId: session.organizationId,
      filnavn: fil.name,
      mimeType: fil.type,
      data: await fil.arrayBuffer(),
    });

    await db.attachment.create({
      data: {
        organizationId: session.organizationId,
        workOrderId: feste.type === "arbeidsordre" ? feste.id : null,
        deviationId: feste.type === "avvik" ? feste.id : null,
        assetId: feste.type === "anlegg" ? feste.id : null,
        uploadedById: session.userId,
        fileName: fil.name,
        storagePath: lagret.nokkel,
        url: lagret.url,
        mimeType: fil.type,
        sizeBytes: fil.size,
      },
    });

    antall += 1;
  }

  revalidatePath(sti(feste));
  return { ok: true, antall };
}

export async function slettVedlegg(id: string): Promise<{ ok: boolean; feil?: string }> {
  const { db, session } = await requireTenant();

  const vedlegg = await db.attachment.findFirst({
    where: { id },
    select: {
      id: true,
      url: true,
      workOrderId: true,
      deviationId: true,
      assetId: true,
    },
  });

  if (!vedlegg) return { ok: false, feil: "Fant ikke vedlegget." };

  const feste: Feste = vedlegg.workOrderId
    ? { type: "arbeidsordre", id: vedlegg.workOrderId }
    : vedlegg.deviationId
      ? { type: "avvik", id: vedlegg.deviationId }
      : { type: "anlegg", id: vedlegg.assetId ?? "" };

  krevFunksjon(session, "vedlegg");
  krev(session, MODUL[feste.type], "endre");

  // Raden fjernes først. Blir fila liggende igjen hos lagringstjenesten er
  // det til å leve med; en rad som peker på ingenting er verre.
  await db.attachment.deleteMany({ where: { id } });
  await slettFil(vedlegg.url);

  revalidatePath(sti(feste));
  return { ok: true };
}

/**
 * Setter dokumenttype, referanse og gyldighet på et vedlegg.
 *
 * Dette er det som skiller et kalibreringsbevis fra en tilfeldig PDF. Uten
 * utløpsdatoen er dokumentet bare en fil i en mappe; med den kan systemet si
 * fra før måleren ikke lenger kan brukes til noe som teller.
 */
export async function settDokumentinfo(
  _forrige: Opplastingssvar,
  formData: FormData,
): Promise<Opplastingssvar> {
  const { db, session } = await requireTenant();
  krevFunksjon(session, "vedlegg");

  const id = String(formData.get("id") ?? "");

  const vedlegg = await db.attachment.findFirst({
    where: { id },
    select: { workOrderId: true, deviationId: true, assetId: true },
  });
  if (!vedlegg) return { ok: false, feil: "Fant ikke vedlegget." };

  const feste: Feste = vedlegg.workOrderId
    ? { type: "arbeidsordre", id: vedlegg.workOrderId }
    : vedlegg.deviationId
      ? { type: "avvik", id: vedlegg.deviationId }
      : { type: "anlegg", id: vedlegg.assetId ?? "" };

  krev(session, MODUL[feste.type], "endre");

  // Typen kontrolleres mot firmaets egen liste. En kode som ikke finnes der
  // ville vist seg som rå tekst i grensesnittet.
  const type = String(formData.get("docType") ?? "").trim();
  if (type) {
    const kjent = await db.listValue.findFirst({
      where: { list: "dokumenttype", code: type },
      select: { id: true },
    });
    if (!kjent) return { ok: false, feil: "Ukjent dokumenttype." };
  }

  const lesDato = (navn: string): Date | null => {
    const rå = String(formData.get(navn) ?? "").trim();
    if (!rå) return null;
    const d = new Date(rå);
    return Number.isNaN(d.getTime()) ? null : d;
  };

  await db.attachment.updateMany({
    where: { id },
    data: {
      docType: type || null,
      reference: String(formData.get("reference") ?? "").trim() || null,
      validFrom: lesDato("validFrom"),
      validUntil: lesDato("validUntil"),
    },
  });

  revalidatePath(sti(feste));
  return { ok: true };
}
