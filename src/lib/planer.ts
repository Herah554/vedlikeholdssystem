import type { Plan } from "@/generated/prisma/client";
import type { Modul } from "@/lib/rettigheter";

/**
 * Hva kunden betaler for.
 *
 * Dette er en annen akse enn rettighetene. Rettighetene svarer på «hvem i
 * bedriften får gjøre dette», planen svarer på «har bedriften kjøpt det i det
 * hele tatt». Begge må si ja.
 *
 * Rekkefølgen betyr noe: den som er stengt av planen skal aldri kunne åpnes
 * ved å endre en rolle, og en administrator som roter i rettighetene skal
 * ikke kunne gi seg selv noe firmaet ikke har.
 */

export const FUNKSJONER = [
  {
    id: "avvik",
    navn: "Avvikssystem",
    beskrivelse: "HMS, nestenulykker, kvalitet og miljø. Med årsak og tiltak.",
  },
  {
    id: "assistent",
    navn: "AI-assistent",
    beskrivelse: "Søker i all historikk og hjelper til med feilsøking.",
  },
  {
    id: "vedlegg",
    navn: "Bilder og dokumenter",
    beskrivelse: "Bilder på arbeidsordre, avvik og utstyr.",
  },
  {
    id: "bestillinger",
    navn: "Bestillinger",
    beskrivelse: "Samle deler i bestillinger og sende dem til leverandør.",
  },
  {
    id: "budsjett",
    navn: "Budsjett",
    beskrivelse: "Kostnad mot budsjett per kostnadssted.",
  },
  {
    id: "import",
    navn: "Import fra regneark",
    beskrivelse: "Få inn utstyr og deler fra Excel.",
  },
  {
    id: "deling",
    navn: "Deling av dashbord",
    beskrivelse: "Dele oppsett mellom kolleger.",
  },
] as const;

export type Funksjon = (typeof FUNKSJONER)[number]["id"];

export const FUNKSJON_IDER = FUNKSJONER.map((f) => f.id) as readonly Funksjon[];

/**
 * Modulene som krever en funksjon.
 *
 * De som ikke står her — arbeidsordre, anlegg, reservedeler, ukeplan,
 * forebyggende, rapporter — er med i alle planer. Et vedlikeholdssystem uten
 * arbeidsordre er ikke et vedlikeholdssystem, og å kunne selge det uten ville
 * bare gitt kunder som angrer.
 */
export const MODUL_KREVER: Partial<Record<Modul, Funksjon>> = {
  avvik: "avvik",
  assistent: "assistent",
  bestillinger: "bestillinger",
  budsjett: "budsjett",
};

export const PLANER: Record<
  Plan,
  { navn: string; beskrivelse: string; funksjoner: readonly Funksjon[] }
> = {
  BASIS: {
    navn: "Basis",
    beskrivelse:
      "Arbeidsordre, anlegg, reservedeler, ukeplan og forebyggende vedlikehold.",
    funksjoner: ["import"],
  },
  PLUSS: {
    navn: "Pluss",
    beskrivelse: "Basis, pluss avvik, bilder, bestillinger og budsjett.",
    funksjoner: ["import", "avvik", "vedlegg", "bestillinger", "budsjett", "deling"],
  },
  PRO: {
    navn: "Pro",
    beskrivelse: "Alt, inkludert AI-assistenten.",
    funksjoner: FUNKSJON_IDER,
  },
};

export const PLAN_REKKEFOLGE: Plan[] = ["BASIS", "PLUSS", "PRO"];

/**
 * Enkeltfunksjoner slått av eller på for én kunde.
 *
 * True slår på noe planen ikke har, false slår av noe planen har. Mangler
 * funksjonen her, gjelder planen. Det er den formen som lar deg si «dere får
 * prøve assistenten i en måned» uten å flytte kunden til en annen plan.
 */
export type Unntak = Partial<Record<Funksjon, boolean>>;

/** Leser unntakene fra databasen. Alt ukjent forkastes. */
export function lesUnntak(lagret: unknown): Unntak {
  if (!lagret || typeof lagret !== "object" || Array.isArray(lagret)) return {};

  const kilde = lagret as Record<string, unknown>;
  const ut: Unntak = {};

  for (const id of FUNKSJON_IDER) {
    if (typeof kilde[id] === "boolean") ut[id] = kilde[id] as boolean;
  }

  return ut;
}

/** Sant hvis bedriften har funksjonen — enten via planen eller et unntak. */
export function harFunksjon(
  plan: Plan,
  unntak: Unntak,
  funksjon: Funksjon,
): boolean {
  const overstyrt = unntak[funksjon];
  if (typeof overstyrt === "boolean") return overstyrt;
  return PLANER[plan].funksjoner.includes(funksjon);
}

/** Alle funksjonene bedriften har, samlet. */
export function funksjonerFor(plan: Plan, unntak: Unntak): Set<Funksjon> {
  return new Set(FUNKSJON_IDER.filter((f) => harFunksjon(plan, unntak, f)));
}

/**
 * Sant hvis modulen er med i det bedriften betaler for.
 *
 * Moduler uten krav er alltid med.
 */
export function modulErKjopt(
  plan: Plan,
  unntak: Unntak,
  modul: Modul,
): boolean {
  const kreves = MODUL_KREVER[modul];
  if (!kreves) return true;
  return harFunksjon(plan, unntak, kreves);
}
