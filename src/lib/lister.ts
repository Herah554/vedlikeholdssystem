import type { TenantDb } from "@/lib/tenant";

/**
 * Verdilister firmaet styrer selv.
 *
 * Arbeidsordretypen var fire faste verdier i koden. Det holder til det første
 * firmaet og ikke det andre: noen skiller mellom garanti og ombygging, andre
 * vil ha «myndighetspålagt». Å legge til en verdi skal ikke kreve en ny
 * versjon av systemet.
 *
 * Nye lister legges til her, ikke i databasen. Tabellen har allerede et felt
 * som sier hvilken liste verdien hører til.
 */

export const LISTER = [
  {
    id: "ordretype",
    navn: "Typer arbeidsordre",
    beskrivelse:
      "Hva slags jobb det er. Vises på arbeidsordren og brukes i rapportene.",
    /** Koder systemet selv er avhengig av og som derfor ikke kan fjernes. */
    innebygde: ["KORREKTIV", "FOREBYGGENDE"],
  },
  {
    id: "dokumenttype",
    navn: "Typer dokument",
    beskrivelse:
      "Hva slags dokument som henges på utstyret. Kalibreringsbevis, sertifikater og kontrollrapporter kan ha utløpsdato.",
    innebygde: [],
  },
] as const;

export type Liste = (typeof LISTER)[number]["id"];

export function listeMeta(id: Liste) {
  return LISTER.find((l) => l.id === id)!;
}

/**
 * Fargetonene en verdi kan ha.
 *
 * Klassene står som hele strenger. Tailwind leser kildekoden som tekst og
 * ville ikke funnet en klasse satt sammen av `bg-${tone}-50`.
 */
export const TONER: Record<string, { navn: string; klasse: string }> = {
  noytral: {
    navn: "Nøytral",
    klasse: "bg-flate-dempet text-tekst ring-kant",
  },
  rose: {
    navn: "Rød",
    klasse:
      "bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300 ring-rose-200 dark:ring-rose-500/30",
  },
  emerald: {
    navn: "Grønn",
    klasse:
      "bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 ring-emerald-200 dark:ring-emerald-500/30",
  },
  sky: {
    navn: "Blå",
    klasse:
      "bg-sky-50 dark:bg-sky-500/15 text-sky-700 dark:text-sky-300 ring-sky-200 dark:ring-sky-500/30",
  },
  violet: {
    navn: "Lilla",
    klasse:
      "bg-violet-50 dark:bg-violet-500/15 text-violet-700 dark:text-violet-300 ring-violet-200 dark:ring-violet-500/30",
  },
  amber: {
    navn: "Gul",
    klasse:
      "bg-amber-50 dark:bg-amber-500/15 text-amber-900 dark:text-amber-300 ring-amber-200 dark:ring-amber-500/30",
  },
};

export const TONE_IDER = Object.keys(TONER);

export type Listeverdi = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  tone: string;
  isActive: boolean;
  isBuiltIn: boolean;
};

/** Henter verdiene i en liste, i den rekkefølgen firmaet har satt. */
export async function hentListe(
  db: TenantDb,
  liste: Liste,
  baseAktive = false,
): Promise<Listeverdi[]> {
  return db.listValue.findMany({
    where: { list: liste, ...(baseAktive ? { isActive: true } : {}) },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      code: true,
      name: true,
      description: true,
      tone: true,
      isActive: true,
      isBuiltIn: true,
    },
  });
}

export type Etikett = { tekst: string; klasse: string };

/**
 * Finner navn og farge for en kode.
 *
 * Faller tilbake til selve koden hvis verdien er fjernet fra lista. En gammel
 * arbeidsordre skal fortsatt kunne vise hva den var merket med, selv om
 * firmaet ikke bruker den typen lenger.
 */
export function etikettFor(kode: string, verdier: Listeverdi[]): Etikett {
  const treff = verdier.find((v) => v.code === kode);

  if (!treff) {
    return { tekst: kode, klasse: TONER.noytral.klasse };
  }

  return {
    tekst: treff.name,
    klasse: (TONER[treff.tone] ?? TONER.noytral).klasse,
  };
}

/** Bygger et oppslag én gang, når mange rader skal tegnes. */
export function etikettOppslag(
  verdier: Listeverdi[],
): (kode: string) => Etikett {
  const kart = new Map(verdier.map((v) => [v.code, v]));

  return (kode) => {
    const treff = kart.get(kode);
    if (!treff) return { tekst: kode, klasse: TONER.noytral.klasse };
    return {
      tekst: treff.name,
      klasse: (TONER[treff.tone] ?? TONER.noytral).klasse,
    };
  };
}
