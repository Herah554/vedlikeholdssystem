"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { krev, requireTenant } from "@/lib/auth";

export type Resultat = { ok: boolean; feil?: string; melding?: string };

/**
 * Dokumentasjon skrevet direkte på utstyret.
 *
 * Driftsinstrukser, erfaringer, «husk å stenge ventil X først». Dette er ofte
 * den mest verdifulle kunnskapen i et anlegg, fordi den ellers bare finnes i
 * hodet til én person — og forsvinner den dagen han slutter.
 *
 * Kravet er «endre», ikke «administrere». Den som gjør jobben er den som vet
 * hva som er verdt å skrive ned, og skal ikke måtte spørre om lov.
 */

const notat = z.object({
  title: z.string().trim().min(3, "Gi notatet en overskrift."),
  body: z.string().trim().min(10, "Skriv litt mer enn det."),
  category: z.string().trim().optional(),
});

export async function lagreDokumentasjon(
  assetId: string,
  _forrige: Resultat,
  formData: FormData,
): Promise<Resultat> {
  const { db, session } = await requireTenant();
  krev(session, "anlegg", "endre");

  const parsed = notat.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, feil: parsed.error.issues[0].message };
  }

  // Utstyret må tilhøre samme bedrift. Den utvidede klienten filtrerer
  // automatisk, så en fremmed id gir ganske enkelt null her.
  const utstyr = await db.asset.findFirst({
    where: { id: assetId },
    select: { id: true },
  });
  if (!utstyr) return { ok: false, feil: "Fant ikke utstyret." };

  const id = String(formData.get("id") ?? "");

  if (id) {
    await db.assetDoc.updateMany({
      where: { id, assetId },
      data: {
        title: parsed.data.title,
        body: parsed.data.body,
        category: parsed.data.category || null,
      },
    });
  } else {
    await db.assetDoc.create({
      data: {
        organizationId: session.organizationId,
        assetId,
        title: parsed.data.title,
        body: parsed.data.body,
        category: parsed.data.category || null,
        createdById: session.userId,
      },
    });
  }

  revalidatePath(`/anlegg/${assetId}`);
  return { ok: true, melding: "Lagret. Assistenten kan nå søke i dette." };
}

export async function slettDokumentasjon(formData: FormData): Promise<void> {
  const { db, session } = await requireTenant();
  krev(session, "anlegg", "administrere");

  const id = String(formData.get("id") ?? "");
  const assetId = String(formData.get("assetId") ?? "");

  await db.assetDoc.deleteMany({ where: { id, assetId } });
  revalidatePath(`/anlegg/${assetId}`);
}
