"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { krev, requireTenant } from "@/lib/auth";

export type Resultat = { ok: boolean; feil?: string; melding?: string };

const nyDelSkjema = z.object({
  number: z.string().trim().min(1, "Delenummer er påkrevd.").max(40),
  name: z.string().trim().min(2, "Navnet må ha minst to tegn."),
  description: z.string().trim().optional(),
  manufacturer: z.string().trim().optional(),
  manufacturerPartNo: z.string().trim().optional(),
  unit: z.string().trim().min(1).default("stk"),
  unitCost: z.coerce.number().min(0, "Pris kan ikke være negativ."),
  minStock: z.coerce.number().min(0),
  maxStock: z.string().trim().optional(),
  binLocation: z.string().trim().optional(),
  supplierId: z.string().trim().optional(),
  leadTimeDays: z.string().trim().optional(),
  startBeholdning: z.coerce.number().min(0).default(0),
});

export async function opprettDel(
  _forrige: Resultat,
  formData: FormData,
): Promise<Resultat> {
  const { db, session } = await requireTenant();
  krev(session, "reservedeler", "administrere");

  const parsed = nyDelSkjema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, feil: parsed.error.issues[0].message };
  const d = parsed.data;

  const finnes = await db.part.findFirst({ where: { number: d.number } });
  if (finnes) return { ok: false, feil: `Delenummer «${d.number}» finnes allerede.` };

  const maks = d.maxStock ? Number(d.maxStock) : null;
  const ledetid = d.leadTimeDays ? Number(d.leadTimeDays) : null;

  const del = await db.$transaction(async (tx) => {
    const ny = await tx.part.create({
      data: {
        organizationId: session.organizationId,
        number: d.number,
        name: d.name,
        description: d.description || null,
        manufacturer: d.manufacturer || null,
        manufacturerPartNo: d.manufacturerPartNo || null,
        unit: d.unit,
        unitCost: d.unitCost,
        minStock: d.minStock,
        maxStock: maks != null && !Number.isNaN(maks) ? maks : null,
        binLocation: d.binLocation || null,
        supplierId: d.supplierId || null,
        leadTimeDays: ledetid != null && !Number.isNaN(ledetid) ? ledetid : null,
        quantityOnHand: d.startBeholdning,
      },
    });

    // Startbeholdningen føres som en bevegelse, ellers ville reskontroen
    // ikke summert seg til beholdningen.
    if (d.startBeholdning > 0) {
      await tx.stockMovement.create({
        data: {
          organizationId: session.organizationId,
          partId: ny.id,
          type: "INN",
          quantity: d.startBeholdning,
          unitCost: d.unitCost,
          userId: session.userId,
          note: "Registrert startbeholdning",
        },
      });
    }
    return ny;
  });

  revalidatePath("/reservedeler");
  redirect(`/reservedeler/${del.id}`);
}

const bevegelseSkjema = z.object({
  quantity: z.coerce.number().refine((n) => n !== 0, "Antall kan ikke være null."),
  unitCost: z.string().trim().optional(),
  note: z.string().trim().optional(),
});

/** Mottak fra leverandør. Øker beholdningen. */
export async function registrerInnkjop(
  partId: string,
  _forrige: Resultat,
  formData: FormData,
): Promise<Resultat> {
  const { db, session } = await requireTenant();
  krev(session, "reservedeler", "endre");

  const parsed = bevegelseSkjema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, feil: parsed.error.issues[0].message };

  const antall = Math.abs(parsed.data.quantity);
  const pris = parsed.data.unitCost ? Number(parsed.data.unitCost) : null;

  await db.$transaction(async (tx) => {
    const del = await tx.part.findFirst({ where: { id: partId } });
    if (!del) throw new Error("Ukjent reservedel.");

    await tx.stockMovement.create({
      data: {
        organizationId: session.organizationId,
        partId,
        type: "INN",
        quantity: antall,
        unitCost: pris != null && !Number.isNaN(pris) ? pris : del.unitCost,
        userId: session.userId,
        note: parsed.data.note || null,
      },
    });
    await tx.part.update({
      where: { id: partId },
      data: {
        quantityOnHand: { increment: antall },
        // Ny innkjøpspris blir gjeldende kostnad for framtidige uttak
        ...(pris != null && !Number.isNaN(pris) ? { unitCost: pris } : {}),
      },
    });
  });

  revalidatePath(`/reservedeler/${partId}`);
  revalidatePath("/reservedeler");
  revalidatePath("/dashbord");
  return { ok: true, melding: "Lagret." };
}

/**
 * Korrigerer beholdningen etter opptelling.
 * Differansen mot dagens tall føres som en justeringsbevegelse.
 */
export async function justerBeholdning(
  partId: string,
  _forrige: Resultat,
  formData: FormData,
): Promise<Resultat> {
  const { db, session } = await requireTenant();
  krev(session, "reservedeler", "endre");

  const talt = Number(formData.get("talt"));
  if (!Number.isFinite(talt) || talt < 0) {
    return { ok: false, feil: "Skriv inn hvor mange du faktisk telte." };
  }
  const notat = String(formData.get("note") ?? "").trim();

  try {
    await db.$transaction(async (tx) => {
      const del = await tx.part.findFirst({ where: { id: partId } });
      if (!del) throw new Error("Ukjent reservedel.");

      const differanse = talt - del.quantityOnHand;
      if (differanse === 0) throw new Error("Beholdningen stemmer allerede.");

      await tx.stockMovement.create({
        data: {
          organizationId: session.organizationId,
          partId,
          type: "JUSTERING",
          quantity: differanse,
          unitCost: del.unitCost,
          userId: session.userId,
          note: notat || `Opptelling: ${del.quantityOnHand} → ${talt}`,
        },
      });
      await tx.part.update({
        where: { id: partId },
        data: { quantityOnHand: talt },
      });
    });
  } catch (e) {
    return { ok: false, feil: e instanceof Error ? e.message : "Justeringen feilet." };
  }

  revalidatePath(`/reservedeler/${partId}`);
  revalidatePath("/reservedeler");
  return { ok: true };
}

const endreDelSkjema = z.object({
  number: z.string().trim().min(1, "Delenummer er påkrevd.").max(40),
  name: z.string().trim().min(2, "Navnet må ha minst to tegn."),
  description: z.string().trim().optional(),
  manufacturer: z.string().trim().optional(),
  manufacturerPartNo: z.string().trim().optional(),
  unit: z.string().trim().min(1),
  unitCost: z.coerce.number().min(0, "Pris kan ikke være negativ."),
  minStock: z.coerce.number().min(0, "Minimum kan ikke være negativt."),
  maxStock: z.string().trim().optional(),
  binLocation: z.string().trim().optional(),
  supplierId: z.string().trim().optional(),
  leadTimeDays: z.string().trim().optional(),
});

/**
 * Retter opplysningene på en reservedel.
 *
 * Minimums- og maksimumsnivået er det som oftest må endres. De settes når
 * delen registreres, før noen vet hvor fort den faktisk går med, og først
 * etter et halvår ser man at to på lager er for lite. Uten en vei til å
 * rette det, blir «deler under minimum» en liste ingen stoler på.
 *
 * Beholdningen står ikke her. Den endres bare gjennom lagerbevegelser, slik
 * at reskontroen alltid summerer seg til det som står på hylla. Skal et tall
 * korrigeres, gjøres det som en opptelling — da vet man hvem som gjorde det
 * og hvorfor.
 */
export async function endreDel(
  partId: string,
  _forrige: Resultat,
  formData: FormData,
): Promise<Resultat> {
  const { db, session } = await requireTenant();
  krev(session, "reservedeler", "administrere");

  const parsed = endreDelSkjema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, feil: parsed.error.issues[0].message };
  const d = parsed.data;

  const del = await db.part.findFirst({
    where: { id: partId },
    select: { id: true, number: true },
  });
  if (!del) return { ok: false, feil: "Fant ikke delen." };

  if (d.number !== del.number) {
    const opptatt = await db.part.findFirst({
      where: { number: d.number, id: { not: partId } },
      select: { id: true },
    });
    if (opptatt) {
      return { ok: false, feil: `Delenummer «${d.number}» finnes allerede.` };
    }
  }

  const maks = d.maxStock ? Number(d.maxStock) : null;
  const gyldigMaks = maks != null && !Number.isNaN(maks) ? maks : null;

  // Et maksimum under minimum gir en bestillingsberegning som ber om mindre
  // enn det delen skal ha på lager
  if (gyldigMaks != null && gyldigMaks < d.minStock) {
    return {
      ok: false,
      feil: "Maksimum kan ikke være lavere enn minimum.",
    };
  }

  if (d.supplierId) {
    const lev = await db.supplier.findFirst({
      where: { id: d.supplierId },
      select: { id: true },
    });
    if (!lev) return { ok: false, feil: "Fant ikke leverandøren." };
  }

  const ledetid = d.leadTimeDays ? Number(d.leadTimeDays) : null;

  await db.part.update({
    where: { id: partId },
    data: {
      number: d.number,
      name: d.name,
      description: d.description || null,
      manufacturer: d.manufacturer || null,
      manufacturerPartNo: d.manufacturerPartNo || null,
      unit: d.unit,
      unitCost: d.unitCost,
      minStock: d.minStock,
      maxStock: gyldigMaks,
      binLocation: d.binLocation || null,
      supplierId: d.supplierId || null,
      leadTimeDays:
        ledetid != null && !Number.isNaN(ledetid) ? ledetid : null,
    },
  });

  revalidatePath(`/reservedeler/${partId}`);
  revalidatePath("/reservedeler");
  revalidatePath("/dashbord");
  return { ok: true };
}
