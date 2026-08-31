/**
 * Hvor mye hver person har igjen på en dag.
 *
 * Ukeplanen viste før bare en sum per dag. Den sier ingenting om det
 * planleggeren faktisk lurer på: hvem kan ta denne jobben på onsdag? Én dag
 * med tolv timer kan være helt grei om tre personer deler dem, og umulig om
 * de ligger på samme mann.
 *
 * Regnestykket ligger her, uten UI og uten database, slik at det kan kjøres
 * i en test. Det er verdt det: et beleggstall som er feil er verre enn ingen
 * tall, fordi planleggeren tror han vet noe han ikke vet.
 */

export type JobbForBelegg = {
  assignedToId: string | null;
  estimatedHours: number | null;
};

export type Person = { id: string; navn: string; timerPerDag: number };

export type Belegg = {
  brukerId: string;
  navn: string;
  /** Timer lagt på personen denne dagen */
  planlagt: number;
  timerPerDag: number;
  /** Kan bli negativ. Det er poenget — da er dagen overbooket. */
  igjen: number;
};

export type Dagsbelegg = {
  personer: Belegg[];
  /** Timer på jobber ingen har fått. De belaster ingen, men finnes. */
  ufordelt: number;
};

/**
 * Fordeler dagens jobber på personene.
 *
 * Alle oppgitte personer kommer med, også de uten jobber den dagen. Det er
 * hele nytten: den som er ledig onsdag skal være synlig, ikke fraværende.
 *
 * Jobber uten anslag teller null timer. Å gjette et anslag ville gitt tall
 * som ser presise ut uten å være det; heller vise at dagen har en jobb til
 * enn å påstå at den tar to timer.
 */
export function beleggForDag(
  jobber: JobbForBelegg[],
  personer: Person[],
): Dagsbelegg {
  const timerPer = new Map<string, number>();
  let ufordelt = 0;

  for (const j of jobber) {
    const timer = j.estimatedHours ?? 0;
    if (!j.assignedToId) {
      ufordelt += timer;
      continue;
    }
    timerPer.set(j.assignedToId, (timerPer.get(j.assignedToId) ?? 0) + timer);
  }

  const belegg = personer.map((p) => {
    const planlagt = timerPer.get(p.id) ?? 0;
    return {
      brukerId: p.id,
      navn: p.navn,
      planlagt,
      timerPerDag: p.timerPerDag,
      igjen: p.timerPerDag - planlagt,
    };
  });

  // Mest ledig først. Planleggeren leter etter noen som kan ta en jobb til,
  // og skal slippe å lese gjennom dem som er fulle for å finne dem.
  belegg.sort((a, b) => b.igjen - a.igjen || a.navn.localeCompare(b.navn, "nb"));

  return { personer: belegg, ufordelt };
}
