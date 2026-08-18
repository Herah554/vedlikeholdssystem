"use server";

import { revalidatePath } from "next/cache";
import { requireTenant } from "@/lib/auth";
import { tolkOppsett } from "../oppsett";

export type Resultat = { ok: boolean; feil?: string };

/**
 * Lagrer brukerens eget dashbordoppsett.
 *
 * Hver bruker får sitt eget dashbord i stedet for å endre organisasjonens
 * felles oppsett — en tekniker og en leder vil se helt forskjellige tall.
 */
export async function lagreOppsett(rå: string): Promise<Resultat> {
  const { db, session } = await requireTenant();

  let tolket: unknown;
  try {
    tolket = JSON.parse(rå);
  } catch {
    return { ok: false, feil: "Kunne ikke lese oppsettet." };
  }

  const oppsett = tolkOppsett(tolket);
  if (!oppsett) {
    return { ok: false, feil: "Velg minst én widget før du lagrer." };
  }

  const eget = await db.dashboard.findFirst({ where: { userId: session.userId } });

  if (eget) {
    await db.dashboard.update({
      where: { id: eget.id },
      data: { layout: oppsett },
    });
  } else {
    await db.dashboard.create({
      data: {
        organizationId: session.organizationId,
        userId: session.userId,
        name: "Mitt dashbord",
        layout: oppsett,
      },
    });
  }

  revalidatePath("/dashbord");
  return { ok: true };
}

/** Fjerner brukerens eget oppsett, slik at organisasjonens felles brukes igjen. */
export async function tilbakestillOppsett(): Promise<Resultat> {
  const { db, session } = await requireTenant();

  await db.dashboard.deleteMany({ where: { userId: session.userId } });

  revalidatePath("/dashbord");
  return { ok: true };
}
