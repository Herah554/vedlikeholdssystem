import type { Role } from "@/generated/prisma/client";

/**
 * Hvem får gjøre hva.
 *
 * Systemet skal selges til firmaer som organiserer seg ulikt. Et sted er det
 * lagersjefen som bestiller deler, et annet sted planleggeren. Derfor er ikke
 * rettighetene bygget inn i koden — hver bedrift krysser av selv under
 * Oppsett, og standardoppsettet under er bare et fornuftig utgangspunkt.
 *
 * Tre nivåer per modul, fordi det er slik arbeidet faktisk deler seg:
 *
 *   se            lese, men ikke røre
 *   endre         det daglige arbeidet: føre timer, ta ut deler, motta varer
 *   administrere  sette opp: opprette utstyr og deler, sende bestillinger
 *
 * Nivåene er kumulative. Den som kan administrere, kan også endre og se.
 */

export const NIVAER = ["se", "endre", "administrere"] as const;
export type Nivaa = (typeof NIVAER)[number];

const RANG: Record<Nivaa, number> = { se: 1, endre: 2, administrere: 3 };

export const MODULER = [
  {
    id: "ukeplan",
    navn: "Ukeplan",
    endre: "Flytte jobber mellom dager",
    administrere: "Fordele jobber på andre",
  },
  {
    id: "arbeidsordre",
    navn: "Arbeidsordre",
    endre: "Melde feil, føre timer, ta ut deler",
    administrere: "Godkjenne, tildele og lukke",
  },
  {
    id: "avvik",
    navn: "Avvik",
    endre: "Melde avvik og skrive i dem",
    administrere: "Tildele, sette tiltak og lukke",
  },
  {
    id: "anlegg",
    navn: "Anlegg",
    endre: "Føre driftstimer og endre status",
    administrere: "Opprette og endre utstyr",
  },
  {
    id: "reservedeler",
    navn: "Reservedeler",
    endre: "Registrere innkjøp og telle opp",
    administrere: "Opprette og endre deler",
  },
  {
    id: "bestillinger",
    navn: "Bestillinger",
    endre: "Motta varer",
    administrere: "Opprette og sende bestillinger",
  },
  {
    id: "leverandorer",
    navn: "Leverandører",
    endre: null,
    administrere: "Opprette og endre leverandører",
  },
  {
    id: "forebyggende",
    navn: "Forebyggende",
    endre: "Kvittere ut planlagt vedlikehold",
    administrere: "Opprette og endre planer",
  },
  {
    id: "budsjett",
    navn: "Budsjett",
    endre: null,
    administrere: "Sette og endre budsjett",
  },
  { id: "rapporter", navn: "Rapporter", endre: null, administrere: null },
  { id: "assistent", navn: "Assistent", endre: null, administrere: null },
] as const;

export type Modul = (typeof MODULER)[number]["id"];

export const MODUL_IDER = MODULER.map((m) => m.id) as readonly Modul[];

/** Lagret form: rolle → modul → høyeste nivå. Mangler modulen, er den stengt. */
export type Matrise = Partial<Record<Role, Partial<Record<Modul, Nivaa>>>>;

/**
 * Roller som kan krysses av. Administrator står ikke her — den har alt, alltid.
 * Uten en rolle som garantert kommer inn, kan en bedrift krysse seg selv ut.
 */
export const VALGBARE_ROLLER: Role[] = [
  "LEDER",
  "PLANLEGGER",
  "DELELAGER",
  "TEKNIKER",
  "GJEST",
];

/** Utgangspunktet en ny bedrift får. Gjenskaper oppførselen systemet hadde før. */
export const STANDARD_MATRISE: Matrise = {
  LEDER: {
    ukeplan: "administrere",
    arbeidsordre: "administrere",
    avvik: "administrere",
    anlegg: "administrere",
    reservedeler: "administrere",
    bestillinger: "administrere",
    leverandorer: "administrere",
    forebyggende: "administrere",
    budsjett: "administrere",
    rapporter: "administrere",
    assistent: "se",
  },
  PLANLEGGER: {
    ukeplan: "administrere",
    arbeidsordre: "administrere",
    avvik: "administrere",
    anlegg: "administrere",
    reservedeler: "administrere",
    bestillinger: "administrere",
    leverandorer: "administrere",
    forebyggende: "administrere",
    budsjett: "se",
    rapporter: "se",
    assistent: "se",
  },
  // Delelageransvarlig styrer alt som har med deler å gjøre, og ser resten.
  DELELAGER: {
    ukeplan: "se",
    arbeidsordre: "se",
    avvik: "endre",
    anlegg: "se",
    reservedeler: "administrere",
    bestillinger: "administrere",
    leverandorer: "administrere",
    forebyggende: "se",
    rapporter: "se",
    assistent: "se",
  },
  TEKNIKER: {
    ukeplan: "endre",
    arbeidsordre: "endre",
    avvik: "endre",
    anlegg: "endre",
    reservedeler: "endre",
    bestillinger: "endre",
    leverandorer: "se",
    forebyggende: "endre",
    rapporter: "se",
    assistent: "se",
  },
  GJEST: {
    ukeplan: "se",
    arbeidsordre: "se",
    // Selv en gjest skal kunne melde fra om noe farlig.
    avvik: "endre",
    anlegg: "se",
    reservedeler: "se",
    bestillinger: "se",
    forebyggende: "se",
    rapporter: "se",
    assistent: "se",
  },
};

/**
 * Leser matrisen som ligger lagret på organisasjonen.
 *
 * Alt som ikke er gjenkjennelig kastes. Verdien kommer fra en JSON-kolonne,
 * og selv om bare vår egen kode skriver dit, skal en ødelagt eller utdatert
 * verdi ikke kunne gi noen mer tilgang enn de skal ha.
 */
export function lesMatrise(lagret: unknown): Matrise {
  if (!lagret || typeof lagret !== "object" || Array.isArray(lagret)) {
    return STANDARD_MATRISE;
  }

  const kilde = lagret as Record<string, unknown>;
  const ut: Matrise = {};

  for (const rolle of VALGBARE_ROLLER) {
    const moduler = kilde[rolle];
    if (!moduler || typeof moduler !== "object") continue;

    const rad: Partial<Record<Modul, Nivaa>> = {};
    for (const modul of MODUL_IDER) {
      const nivaa = (moduler as Record<string, unknown>)[modul];
      if (typeof nivaa === "string" && NIVAER.includes(nivaa as Nivaa)) {
        rad[modul] = nivaa as Nivaa;
      }
    }
    ut[rolle] = rad;
  }

  return ut;
}

/** Sant hvis rollen når opp til nivået i modulen. */
export function kan(
  rolle: Role,
  matrise: Matrise,
  modul: Modul,
  nivaa: Nivaa = "se",
): boolean {
  // Administrator har alt. Det er ikke noe man kan krysse bort — ellers
  // kunne en bedrift låse seg selv ute av sitt eget oppsett.
  if (rolle === "ADMIN") return true;

  const har = matrise[rolle]?.[modul];
  if (!har) return false;

  return RANG[har] >= RANG[nivaa];
}

/** Modulene rollen har lov til å åpne. Brukes til å bygge menyen. */
export function synligeModuler(rolle: Role, matrise: Matrise): Set<Modul> {
  return new Set(MODUL_IDER.filter((m) => kan(rolle, matrise, m, "se")));
}
