import { prisma } from "@/lib/prisma";

/**
 * Hvem får lov til å opprette en ny bedrift?
 *
 * Svaret er: bare du, og bare én gang herfra.
 *
 * Systemet er en tjeneste du selger, ikke noe folk melder seg på selv. Derfor
 * er denne siden åpen nøyaktig så lenge databasen er tom — akkurat nok til at
 * du får opprettet din egen bedrift og plattformeierkontoen. I det øyeblikket
 * den finnes, stenger siden seg for godt.
 *
 * Nye kunder oppretter du fra /plattform. Da får de en ferdig konto de kan
 * logge inn med, i stedet for å registrere seg selv.
 *
 * Det finnes med vilje ingen miljøvariabel som åpner denne igjen. En bryter
 * som kan stå feil, kommer før eller siden til å stå feil.
 */

export type RegistreringStatus =
  | { apen: true; forstegangsoppsett: true }
  | { apen: false };

export async function registreringStatus(): Promise<RegistreringStatus> {
  const antallOrganisasjoner = await prisma.organization.count();

  if (antallOrganisasjoner === 0) {
    return { apen: true, forstegangsoppsett: true };
  }

  return { apen: false };
}
