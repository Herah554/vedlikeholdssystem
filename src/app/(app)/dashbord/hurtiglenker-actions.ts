"use server";

import { revalidatePath } from "next/cache";
import { requireTenant } from "@/lib/auth";
import { trygLenke } from "@/lib/lenker";

export type Resultat = { ok: boolean; feil?: string };

/** Flest lenker én person kan legge inn. */
const MAKS = 12;

/**
 * Legger til en snarvei på dashbordet.
 *
 * Lenkene er personlige. Hver enkelt har sine egne rutiner, og et
 * vedlikeholdssystem lever ved siden av leverandørkataloger, driftsinstrukser
 * og maskinsider som ikke hører hjemme i menyen vår.
 *
 * Ingen rettighetssjekk mot en modul: dette er brukerens egne bokmerker og
 * gir ikke tilgang til noe. Filteret på organisasjon og bruker gjør at ingen
 * kan se eller endre andres.
 */
export async function leggTilHurtiglenke(
  _forrige: Resultat,
  formData: FormData,
): Promise<Resultat> {
  const { db, session } = await requireTenant();

  const label = String(formData.get("label") ?? "").trim();
  if (label.length < 1) return { ok: false, feil: "Gi lenka et navn." };
  if (label.length > 40) return { ok: false, feil: "Navnet er for langt." };

  const svar = trygLenke(String(formData.get("url") ?? ""));
  if (!svar.ok) return { ok: false, feil: svar.feil };

  const antall = await db.quickLink.count({
    where: { userId: session.userId },
  });
  if (antall >= MAKS) {
    return {
      ok: false,
      feil: `Du kan ha ${MAKS} hurtiglenker. Fjern en først.`,
    };
  }

  await db.quickLink.create({
    data: {
      organizationId: session.organizationId,
      userId: session.userId,
      label,
      url: svar.url,
      sortOrder: antall,
    },
  });

  revalidatePath("/dashbord");
  return { ok: true };
}

/** Fjerner en av sine egne snarveier. */
export async function slettHurtiglenke(id: string): Promise<Resultat> {
  const { db, session } = await requireTenant();

  // userId i filteret, ikke bare id: uten det kunne en gjettet id fjerne
  // en kollegas lenke.
  const slettet = await db.quickLink.deleteMany({
    where: { id, userId: session.userId },
  });

  if (slettet.count === 0) return { ok: false, feil: "Fant ikke lenka." };

  revalidatePath("/dashbord");
  return { ok: true };
}
