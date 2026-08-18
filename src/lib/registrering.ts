import { prisma } from "@/lib/prisma";

/**
 * Hvem får lov til å opprette en ny bedrift?
 *
 * Ligger systemet på åpent internett, kan ikke registreringen stå åpen — da
 * kan hvem som helst opprette organisasjoner på serveren din. Samtidig må den
 * aller første bedriften kunne opprettes, ellers kommer man aldri i gang.
 *
 * Løsningen er at registreringen er åpen så lenge databasen er tom, og etter
 * det må den slås på bevisst med TILLAT_REGISTRERING="ja". Er
 * REGISTRERING_KODE satt i tillegg, må koden oppgis.
 */

export type RegistreringStatus =
  | { apen: true; forstegangsoppsett: boolean; krevKode: boolean }
  | { apen: false };

export async function registreringStatus(): Promise<RegistreringStatus> {
  const antallOrganisasjoner = await prisma.organization.count();

  // Tom database — dette er førstegangsoppsettet
  if (antallOrganisasjoner === 0) {
    return { apen: true, forstegangsoppsett: true, krevKode: false };
  }

  if (process.env.TILLAT_REGISTRERING?.toLowerCase() === "ja") {
    return {
      apen: true,
      forstegangsoppsett: false,
      krevKode: Boolean(process.env.REGISTRERING_KODE),
    };
  }

  return { apen: false };
}

/**
 * Sjekker invitasjonskoden.
 *
 * Sammenlikningen tar like lang tid uansett hvor koden er feil, slik at ingen
 * kan gjette den tegn for tegn ved å måle svartiden.
 */
export function kodeStemmer(oppgitt: string | undefined): boolean {
  const fasit = process.env.REGISTRERING_KODE;
  if (!fasit) return true;
  if (!oppgitt) return false;

  const a = Buffer.from(oppgitt);
  const b = Buffer.from(fasit);
  if (a.length !== b.length) {
    // Sammenlikn likevel, slik at lengden ikke lekker gjennom svartiden
    let tull = 0;
    for (let i = 0; i < b.length; i += 1) tull |= b[i];
    return false;
  }

  let ulikhet = 0;
  for (let i = 0; i < a.length; i += 1) ulikhet |= a[i] ^ b[i];
  return ulikhet === 0;
}
