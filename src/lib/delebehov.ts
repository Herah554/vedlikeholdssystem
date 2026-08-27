/**
 * Fra «jeg trenger en del» til en bestilling hos leverandøren.
 *
 * Et delebehov er en tekniker som mangler noe. Den som bestiller ser alle
 * behovene samlet og skal kunne gjøre dem om til bestillinger uten å sortere
 * for hånd. Regnestykket for den sorteringen ligger her, uten UI og uten
 * database, slik at det kan kjøres i en test.
 *
 * Tre bunker, fordi de krever helt forskjellig håndtering:
 *
 *   klare            delen finnes og har leverandør — kan bestilles nå
 *   utenLeverandor   delen finnes, men ingen vet hvem som selger den
 *   maaKobles        teknikeren beskrev delen med ord og fant den ikke
 *
 * Bare den første bunken kan bli til en bestilling. De to andre er arbeid
 * noen må gjøre først, og de er verdt å vise fram nettopp derfor — ellers
 * blir de liggende usynlige og teknikeren tror hen er glemt.
 */

/** Det minimum av et behov denne fila trenger å vite om. */
export type BehovForGruppering = {
  id: string;
  quantity: number;
  urgent: boolean;
  part: {
    id: string;
    supplierId: string | null;
    supplierNavn: string | null;
    unitCost: number;
  } | null;
};

export type Leverandorgruppe<T extends BehovForGruppering> = {
  supplierId: string;
  navn: string;
  behov: T[];
};

export type Grupperingsresultat<T extends BehovForGruppering> = {
  klare: Leverandorgruppe<T>[];
  utenLeverandor: T[];
  maaKobles: T[];
};

/**
 * Deler behovene i de tre bunkene, og sorterer leverandørene alfabetisk.
 *
 * Innenfor hver gruppe kommer det som haster først. Den som bestiller skal
 * ikke måtte lete etter linja som stopper produksjonen.
 */
export function grupperBehov<T extends BehovForGruppering>(
  behov: T[],
): Grupperingsresultat<T> {
  const maaKobles: T[] = [];
  const utenLeverandor: T[] = [];
  const perLeverandor = new Map<string, Leverandorgruppe<T>>();

  for (const b of behov) {
    if (!b.part) {
      maaKobles.push(b);
      continue;
    }
    if (!b.part.supplierId) {
      utenLeverandor.push(b);
      continue;
    }

    const gruppe = perLeverandor.get(b.part.supplierId) ?? {
      supplierId: b.part.supplierId,
      navn: b.part.supplierNavn ?? "Ukjent leverandør",
      behov: [],
    };
    gruppe.behov.push(b);
    perLeverandor.set(b.part.supplierId, gruppe);
  }

  const hasterForst = (a: T, b: T) => Number(b.urgent) - Number(a.urgent);

  for (const g of perLeverandor.values()) g.behov.sort(hasterForst);
  maaKobles.sort(hasterForst);
  utenLeverandor.sort(hasterForst);

  return {
    klare: [...perLeverandor.values()].sort((a, b) =>
      a.navn.localeCompare(b.navn, "nb"),
    ),
    utenLeverandor,
    maaKobles,
  };
}

/** En ferdig bestillingslinje, med behovene den dekker. */
export type Linje = {
  partId: string;
  quantity: number;
  unitCost: number;
  behovIder: string[];
};

/**
 * Slår sammen behov som gjelder samme del til én bestillingslinje.
 *
 * Ber to teknikere om samme pakning til hver sin jobb, skal leverandøren få
 * én linje med to stykker — ikke to linjer. Det er ikke bare penere: en
 * bestilling kan bare ha én linje per del, så to linjer ville stoppet med en
 * databasefeil midt i bestillingen.
 *
 * Antallet rundes opp. Man kan ikke bestille en halv pakning, og å runde ned
 * ville gitt teknikeren for lite.
 */
export function slaaSammenLinjer<T extends BehovForGruppering>(
  behov: T[],
): Linje[] {
  const perDel = new Map<string, Linje>();

  for (const b of behov) {
    if (!b.part) continue;

    const linje = perDel.get(b.part.id) ?? {
      partId: b.part.id,
      quantity: 0,
      unitCost: b.part.unitCost,
      behovIder: [],
    };
    linje.quantity += b.quantity;
    linje.behovIder.push(b.id);
    perDel.set(b.part.id, linje);
  }

  return [...perDel.values()].map((l) => ({
    ...l,
    quantity: Math.max(1, Math.ceil(l.quantity)),
  }));
}
