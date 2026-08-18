"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertRole, requireTenant } from "@/lib/auth";

export type Resultat = { ok: boolean; feil?: string; melding?: string };

const skjema = z.object({
  name: z.string().trim().min(2, "Navnet må ha minst to tegn."),
  contactName: z.string().trim().optional(),
  email: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  website: z.string().trim().optional(),
});

/** E-posten er valgfri, men må være gyldig når den først er fylt ut. */
function sjekkEpost(verdi: string | undefined): string | null | { feil: string } {
  if (!verdi) return null;
  const parsed = z.email().safeParse(verdi);
  return parsed.success
    ? verdi.toLowerCase()
    : { feil: `«${verdi}» er ikke en gyldig e-postadresse.` };
}

export async function opprettLeverandor(
  _forrige: Resultat,
  formData: FormData,
): Promise<Resultat> {
  const { db, session } = await requireTenant();
  assertRole(session.role, "PLANLEGGER");

  const parsed = skjema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, feil: parsed.error.issues[0].message };
  const d = parsed.data;

  const epost = sjekkEpost(d.email);
  if (epost && typeof epost === "object") return { ok: false, feil: epost.feil };

  const finnes = await db.supplier.findFirst({ where: { name: d.name } });
  if (finnes) return { ok: false, feil: `${d.name} er allerede registrert.` };

  await db.supplier.create({
    data: {
      organizationId: session.organizationId,
      name: d.name,
      contactName: d.contactName || null,
      email: epost,
      phone: d.phone || null,
      website: d.website || null,
    },
  });

  revalidatePath("/leverandorer");
  return { ok: true, melding: `${d.name} er lagt til.` };
}

export async function oppdaterLeverandor(
  leverandorId: string,
  _forrige: Resultat,
  formData: FormData,
): Promise<Resultat> {
  const { db, session } = await requireTenant();
  assertRole(session.role, "PLANLEGGER");

  const parsed = skjema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, feil: parsed.error.issues[0].message };
  const d = parsed.data;

  const epost = sjekkEpost(d.email);
  if (epost && typeof epost === "object") return { ok: false, feil: epost.feil };

  const leverandor = await db.supplier.findFirst({ where: { id: leverandorId } });
  if (!leverandor) return { ok: false, feil: "Fant ikke leverandøren." };

  if (d.name !== leverandor.name) {
    const opptatt = await db.supplier.findFirst({ where: { name: d.name } });
    if (opptatt) return { ok: false, feil: `${d.name} er allerede registrert.` };
  }

  await db.supplier.updateMany({
    where: { id: leverandorId },
    data: {
      name: d.name,
      contactName: d.contactName || null,
      email: epost,
      phone: d.phone || null,
      website: d.website || null,
    },
  });

  revalidatePath("/leverandorer");
  revalidatePath(`/leverandorer/${leverandorId}`);
  return { ok: true, melding: "Leverandøren er oppdatert." };
}
