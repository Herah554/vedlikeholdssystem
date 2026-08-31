/**
 * Hvordan arbeidet fordeler seg på folk.
 *
 * Det finnes ikke ett tall som sier hvor god en tekniker er, og et system som
 * later som det gjør det, er verre enn ingenting. De to nærliggende målene er
 * begge feil hver sin vei:
 *
 *   Antall jobber utført favoriserer den som tar de korte jobbene. Den som
 *   tar de tre tyngste havariene i måneden kommer dårligst ut.
 *
 *   Timer ført favoriserer den som bruker lang tid.
 *
 * Derfor står målene her ved siden av hverandre, sammen med det som forklarer
 * forskjellene mellom dem — hvor tunge jobber personen faktisk fikk. En leder
 * som ser at én har halvparten så mange jobber, men dobbelt så mange kritiske,
 * har fått et svar. Ett samletall hadde skjult nettopp det.
 *
 * Regnestykket ligger her, uten UI og uten database, slik at det kan kjøres i
 * en test. Tall om navngitte personer skal ikke være omtrentlige.
 */

/** Dager etter en fullført jobb der en ny feil på samme utstyr regnes som omgang. */
export const OMGANG_DAGER = 30;

export type OrdreForMaling = {
  id: string;
  assignedToId: string | null;
  assetId: string | null;
  priority: string;
  estimatedHours: number | null;
  dueDate: Date | null;
  completedAt: Date | null;
  resolution: string | null;
};

/** En korrektiv jobb, brukt til å se om en tidligere reparasjon holdt. */
export type Korrektiv = {
  id: string;
  assetId: string | null;
  createdAt: Date;
};

export type Maling = {
  brukerId: string;
  navn: string;

  /** Fullførte jobber i perioden */
  utfort: number;
  /** Timer ført i perioden */
  timer: number;

  /** Av de fullførte: hvor mange var kritiske eller høy prioritet */
  tunge: number;

  /**
   * Faktiske timer delt på anslåtte, for jobbene som har begge deler.
   * Null når ingen av jobbene har anslag.
   */
  motAnslag: number | null;
  medAnslag: number;

  /** Fullført innen fristen, av dem som hadde en frist */
  iTide: number;
  medFrist: number;

  /** Fullførte jobber der det står skrevet hva som løste problemet */
  dokumentert: number;

  /**
   * Fullførte jobber der samme utstyr fikk en ny korrektiv jobb innen
   * OMGANG_DAGER. Nærmeste ærlige mål på om reparasjonen holdt.
   */
  omganger: number;
  /** Fullførte jobber knyttet til utstyr — nevneren for omganger */
  medUtstyr: number;
};

const TUNGE = ["KRITISK", "HOY"];

/**
 * Regner ut målene per person.
 *
 * `timerPerBruker` kommer fra timeføringen og ikke fra arbeidsordrene, fordi
 * en tekniker kan føre timer på en jobb som er tildelt en annen. Timene
 * tilhører den som førte dem.
 */
export function malMedarbeidere(
  ordrer: OrdreForMaling[],
  personer: { id: string; navn: string }[],
  timerPerBruker: Map<string, number>,
  /** Korrektive jobber, til å se om en reparasjon holdt */
  korrektive: Korrektiv[],
): Maling[] {
  // Korrektive jobber per utstyr, sortert på tid, slik at oppslaget under
  // slipper å gå gjennom alle for hver eneste fullførte jobb.
  const perUtstyr = new Map<string, Korrektiv[]>();
  for (const k of korrektive) {
    if (!k.assetId) continue;
    const liste = perUtstyr.get(k.assetId) ?? [];
    liste.push(k);
    perUtstyr.set(k.assetId, liste);
  }

  return personer
    .map((p) => {
      const mine = ordrer.filter(
        (o) => o.assignedToId === p.id && o.completedAt != null,
      );

      let medAnslag = 0;
      let sumAnslag = 0;
      let medFrist = 0;
      let iTide = 0;
      let dokumentert = 0;
      let medUtstyr = 0;
      let omganger = 0;
      let tunge = 0;

      for (const o of mine) {
        if (TUNGE.includes(o.priority)) tunge += 1;
        if (o.resolution && o.resolution.trim().length > 0) dokumentert += 1;

        if (o.dueDate) {
          medFrist += 1;
          if (o.completedAt! <= o.dueDate) iTide += 1;
        }

        if (o.estimatedHours && o.estimatedHours > 0) {
          medAnslag += 1;
          sumAnslag += o.estimatedHours;
        }

        if (o.assetId) {
          medUtstyr += 1;
          const grense = new Date(
            o.completedAt!.getTime() + OMGANG_DAGER * 86400_000,
          );
          const nyFeil = (perUtstyr.get(o.assetId) ?? []).some(
            (k) =>
              k.id !== o.id && k.createdAt > o.completedAt! && k.createdAt <= grense,
          );
          if (nyFeil) omganger += 1;
        }
      }

      const timer = timerPerBruker.get(p.id) ?? 0;

      // Faktiske timer mot anslag regnes bare på jobbene som faktisk har
      // anslag. Blander man inn jobbene uten, blir forholdstallet meningsløst.
      const motAnslag =
        medAnslag > 0 && sumAnslag > 0 ? timer / sumAnslag : null;

      return {
        brukerId: p.id,
        navn: p.navn,
        utfort: mine.length,
        timer,
        tunge,
        motAnslag,
        medAnslag,
        iTide,
        medFrist,
        dokumentert,
        omganger,
        medUtstyr,
      };
    })
    .sort((a, b) => b.utfort - a.utfort || a.navn.localeCompare(b.navn, "nb"));
}

/** Andel i prosent, eller null når det ikke er noe å regne på. */
export function andel(teller: number, nevner: number): number | null {
  if (nevner <= 0) return null;
  return Math.round((teller / nevner) * 100);
}
