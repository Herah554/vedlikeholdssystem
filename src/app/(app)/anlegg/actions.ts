"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { krev, requireTenant } from "@/lib/auth";

export type Resultat = { ok: boolean; feil?: string };

const skjema = z.object({
  code: z
    .string()
    .trim()
    .min(1, "TAG er påkrevd.")
    .max(40)
    .regex(/^[A-Za-z0-9._\-/]+$/, "TAG kan bare inneholde bokstaver, tall og - _ . /"),
  name: z.string().trim().min(2, "Navnet må ha minst to tegn."),
  description: z.string().trim().optional(),
  type: z.enum(["ANLEGG", "SYSTEM", "UTSTYR", "KOMPONENT"]),
  parentId: z.string().trim().optional(),
  criticality: z.coerce.number().int().min(1).max(5),
  manufacturer: z.string().trim().optional(),
  modelNumber: z.string().trim().optional(),
  serialNumber: z.string().trim().optional(),
  location: z.string().trim().optional(),
  installedAt: z.string().trim().optional(),
  purchaseCost: z.string().trim().optional(),
  costCenterId: z.string().trim().optional(),
});

function tilDato(v?: string) {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function opprettUtstyr(
  _forrige: Resultat,
  formData: FormData,
): Promise<Resultat> {
  const { db, session } = await requireTenant();
  krev(session, "anlegg", "administrere");

  const parsed = skjema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, feil: parsed.error.issues[0].message };
  const d = parsed.data;

  const finnes = await db.asset.findFirst({ where: { code: d.code } });
  if (finnes) return { ok: false, feil: `TAG «${d.code}» er allerede i bruk.` };

  // Stien og dybden utledes av forelderen, slik at deltre-spørringer
  // («alt under dette anlegget») blir ett enkelt LIKE-oppslag.
  let path = "";
  let depth = 0;
  if (d.parentId) {
    const forelder = await db.asset.findFirst({ where: { id: d.parentId } });
    if (!forelder) return { ok: false, feil: "Fant ikke overordnet enhet." };
    path = forelder.path;
    depth = forelder.depth + 1;
  }

  const kost = d.purchaseCost ? Number(d.purchaseCost.replace(/\s/g, "")) : null;

  const ny = await db.asset.create({
    data: {
      organizationId: session.organizationId,
      code: d.code,
      name: d.name,
      description: d.description || null,
      type: d.type,
      parentId: d.parentId || null,
      depth,
      path: "",
      criticality: d.criticality,
      manufacturer: d.manufacturer || null,
      modelNumber: d.modelNumber || null,
      serialNumber: d.serialNumber || null,
      location: d.location || null,
      installedAt: tilDato(d.installedAt),
      purchaseCost: kost != null && !Number.isNaN(kost) ? kost : null,
      costCenterId: d.costCenterId || null,
    },
  });

  await db.asset.update({
    where: { id: ny.id },
    data: { path: `${path}/${ny.id}` },
  });

  revalidatePath("/anlegg");
  redirect(`/anlegg/${ny.id}`);
}

export async function oppdaterDriftstimer(
  assetId: string,
  timer: number,
): Promise<Resultat> {
  const { db, session } = await requireTenant();
  krev(session, "anlegg", "endre");

  if (!Number.isFinite(timer) || timer < 0) {
    return { ok: false, feil: "Driftstimer må være et positivt tall." };
  }

  await db.asset.updateMany({
    where: { id: assetId },
    data: { runningHours: timer },
  });

  revalidatePath(`/anlegg/${assetId}`);
  revalidatePath("/forebyggende");
  return { ok: true };
}

export async function endreStatusPaUtstyr(
  assetId: string,
  status: "I_DRIFT" | "STANSET" | "UNDER_VEDLIKEHOLD" | "UTRANGERT",
): Promise<Resultat> {
  const { db, session } = await requireTenant();
  krev(session, "anlegg", "endre");

  await db.asset.updateMany({ where: { id: assetId }, data: { status } });

  revalidatePath(`/anlegg/${assetId}`);
  revalidatePath("/anlegg");
  return { ok: true };
}
