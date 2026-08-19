"use server";

import { revalidatePath } from "next/cache";
import { requireTenant } from "@/lib/auth";
import { tolkOppsett } from "../oppsett";

export type Resultat = { ok: boolean; feil?: string; melding?: string };

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

/**
 * Bestemmer hvem som får se ditt oppsett.
 *
 * Hele lista skrives om hver gang. Det er enklere å resonnere om enn å regne
 * ut hva som ble lagt til og fjernet, og lista er aldri lengre enn antall
 * ansatte i bedriften.
 */
export async function delOppsett(
  _forrige: Resultat,
  formData: FormData,
): Promise<Resultat> {
  const { db, session } = await requireTenant();

  const eget = await db.dashboard.findFirst({
    where: { userId: session.userId },
    orderBy: { updatedAt: "desc" },
  });

  if (!eget) {
    return {
      ok: false,
      feil: "Lagre ditt eget oppsett først, så kan du dele det.",
    };
  }

  const heleFirmaet = formData.get("alle") === "ja";

  // Mottakerne kontrolleres mot brukertabellen. Den går gjennom
  // flerklient-filteret, så en id fra en annen bedrift finner ingenting.
  const onskede = formData.getAll("mottaker").map(String);
  const gyldige = heleFirmaet
    ? []
    : await db.user.findMany({
        where: { id: { in: onskede }, isActive: true },
        select: { id: true },
      });

  await db.$transaction([
    db.dashboardShare.deleteMany({ where: { dashboardId: eget.id } }),
    db.dashboardShare.createMany({
      data: heleFirmaet
        ? [{ dashboardId: eget.id, userId: null }]
        : gyldige.map((u) => ({ dashboardId: eget.id, userId: u.id })),
    }),
  ]);

  revalidatePath("/dashbord/tilpass");

  const antall = heleFirmaet ? "hele firmaet" : `${gyldige.length} personer`;
  return { ok: true, melding: `Oppsettet er delt med ${antall}.` };
}

/**
 * Tar i bruk et oppsett noen har delt med deg.
 *
 * Oppsettet kopieres i stedet for å peke tilbake. Endrer kollegaen sitt eget
 * senere, skal ikke ditt plutselig se annerledes ut uten at du har rørt noe.
 */
export async function taIBruk(dashboardId: string): Promise<Resultat> {
  const { db, session } = await requireTenant();

  // Oppslaget går gjennom dashboards og ikke delingstabellen, slik at
  // flerklient-filteret gjelder. Uten det ville en id fra en annen kunde
  // kunne hentes ved å gjette.
  const kilde = await db.dashboard.findFirst({
    where: {
      id: dashboardId,
      userId: { not: session.userId },
      shares: { some: { OR: [{ userId: session.userId }, { userId: null }] } },
    },
    select: { layout: true, name: true },
  });

  if (!kilde) {
    return { ok: false, feil: "Fant ikke oppsettet, eller det er ikke delt med deg." };
  }

  const oppsett = tolkOppsett(kilde.layout);
  if (!oppsett) return { ok: false, feil: "Oppsettet er tomt." };

  const eget = await db.dashboard.findFirst({
    where: { userId: session.userId },
  });

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
  revalidatePath("/dashbord/tilpass");
  return { ok: true };
}
