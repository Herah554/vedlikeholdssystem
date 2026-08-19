"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { krev, requireTenant } from "@/lib/auth";

export type Resultat = { ok: boolean; feil?: string };

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
  return { ok: true };
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
