/**
 * Skjemamaler og utfylte skjemaer.
 *
 * Et SJA er ikke en sjekkliste. Det er et dokument noen skriver under på før
 * en farlig jobb, og det må kunne legges fram etterpå — for verneombudet,
 * for Arbeidstilsynet, eller for den som lurer på hva som gikk galt.
 *
 * Derfor er den viktigste regelen her at et utfylt skjema aldri endrer
 * innhold. Malen kan ryddes i når som helst; kopien som ligger på det
 * utfylte skjemaet står som den var.
 */

export const FELTTYPER = [
  { id: "overskrift", navn: "Overskrift", forklaring: "Deler skjemaet i bolker. Ikke noe å fylle ut." },
  { id: "tekst", navn: "Kort tekst", forklaring: "Én linje" },
  { id: "langtekst", navn: "Lang tekst", forklaring: "Flere linjer" },
  { id: "ja_nei", navn: "Ja eller nei", forklaring: "To knapper" },
  { id: "avkryssing", navn: "Avkryssing", forklaring: "Én boks som hukes av" },
  { id: "tall", navn: "Tall", forklaring: "Måling, antall eller lignende" },
  { id: "dato", navn: "Dato", forklaring: "" },
  { id: "valg", navn: "Ett valg", forklaring: "Velg én av flere" },
  { id: "flervalg", navn: "Flere valg", forklaring: "Huk av så mange som passer" },
] as const;

export type Felttype = (typeof FELTTYPER)[number]["id"];

export const FELTTYPE_IDER = FELTTYPER.map((f) => f.id) as readonly Felttype[];

/** Felttyper som ikke har noe svar. */
export const UTEN_SVAR: Felttype[] = ["overskrift"];

export type Felt = {
  id: string;
  type: Felttype;
  etikett: string;
  hjelpetekst?: string;
  pakrevd?: boolean;
  /** Bare for «valg» og «flervalg» */
  valg?: string[];
};

export type Svar = Record<string, string | string[] | boolean | number | null>;

/**
 * Leser feltene fra databasen.
 *
 * Verdien kommer fra en JSON-kolonne. Selv om bare vår egen kode skriver dit,
 * skal en ødelagt eller utdatert verdi ikke kunne få siden til å falle sammen
 * midt i et sikkerhetsdokument.
 */
export function lesFelter(rå: unknown): Felt[] {
  if (!Array.isArray(rå)) return [];

  return rå.flatMap((element, i): Felt[] => {
    if (!element || typeof element !== "object") return [];
    const o = element as Record<string, unknown>;

    const type = FELTTYPE_IDER.includes(o.type as Felttype)
      ? (o.type as Felttype)
      : "tekst";

    const etikett = typeof o.etikett === "string" ? o.etikett.trim() : "";
    if (!etikett) return [];

    return [
      {
        id: typeof o.id === "string" && o.id ? o.id : `f${i}`,
        type,
        etikett,
        hjelpetekst:
          typeof o.hjelpetekst === "string" && o.hjelpetekst.trim()
            ? o.hjelpetekst.trim()
            : undefined,
        pakrevd: o.pakrevd === true,
        valg: Array.isArray(o.valg)
          ? o.valg
              .filter((v): v is string => typeof v === "string" && v.trim() !== "")
              .map((v) => v.trim())
          : undefined,
      },
    ];
  });
}

/** Leser svarene. Ukjente felter forkastes. */
export function lesSvar(rå: unknown, felter: Felt[]): Svar {
  if (!rå || typeof rå !== "object" || Array.isArray(rå)) return {};

  const kilde = rå as Record<string, unknown>;
  const ut: Svar = {};

  for (const felt of felter) {
    const verdi = kilde[felt.id];
    if (verdi === undefined) continue;

    if (felt.type === "flervalg") {
      ut[felt.id] = Array.isArray(verdi)
        ? verdi.filter((v): v is string => typeof v === "string")
        : [];
    } else if (felt.type === "avkryssing") {
      ut[felt.id] = verdi === true;
    } else if (felt.type === "tall") {
      const n = Number(verdi);
      ut[felt.id] = Number.isFinite(n) ? n : null;
    } else {
      ut[felt.id] = verdi === null ? null : String(verdi);
    }
  }

  return ut;
}

/** Sant hvis feltet har fått et svar som teller. */
export function harSvar(felt: Felt, svar: Svar): boolean {
  const v = svar[felt.id];

  if (felt.type === "avkryssing") return v === true;
  if (felt.type === "flervalg") return Array.isArray(v) && v.length > 0;
  if (felt.type === "tall") return typeof v === "number";

  return typeof v === "string" && v.trim() !== "";
}

/**
 * Hvilke påkrevde felter mangler svar.
 *
 * Brukes når skjemaet skal låses. Et halvferdig SJA er verre enn ingen: det
 * ser ut som om noen har vurdert risikoen.
 */
export function manglerSvar(felter: Felt[], svar: Svar): Felt[] {
  return felter.filter(
    (f) => f.pakrevd && !UTEN_SVAR.includes(f.type) && !harSvar(f, svar),
  );
}

/** Hvor mye av skjemaet er fylt ut. Brukes til å vise framdrift. */
export function framdrift(
  felter: Felt[],
  svar: Svar,
): { utfylt: number; totalt: number } {
  const teller = felter.filter((f) => !UTEN_SVAR.includes(f.type));
  return {
    utfylt: teller.filter((f) => harSvar(f, svar)).length,
    totalt: teller.length,
  };
}

/**
 * Et forslag til SJA, slik at ingen må begynne på blankt ark.
 *
 * Punktene følger den rekkefølgen en sikker jobb-analyse går i: hva skal
 * gjøres, hva kan gå galt, hva gjør vi med det, og hvem har vært med på
 * vurderingen.
 */
export const SJA_MAL: Felt[] = [
  { id: "s1", type: "overskrift", etikett: "Jobben" },
  { id: "arbeid", type: "langtekst", etikett: "Hva skal gjøres?", pakrevd: true, hjelpetekst: "Beskriv arbeidet steg for steg" },
  { id: "sted", type: "tekst", etikett: "Hvor", pakrevd: true },
  { id: "deltakere", type: "langtekst", etikett: "Hvem deltar", pakrevd: true, hjelpetekst: "Navn på alle som er med på jobben" },

  { id: "s2", type: "overskrift", etikett: "Hva kan gå galt" },
  { id: "farer", type: "flervalg", etikett: "Farer ved denne jobben", pakrevd: true, valg: ["Fall fra høyde", "Klemfare", "Elektrisk støt", "Varmt arbeid", "Kjemikalier", "Trykk eller energi lagret i utstyret", "Tunge løft", "Støy", "Trange rom", "Arbeid over andre"] },
  { id: "andreFarer", type: "langtekst", etikett: "Andre farer", hjelpetekst: "Det som ikke passet i lista over" },
  { id: "verste", type: "langtekst", etikett: "Verste tenkelige utfall", pakrevd: true },

  { id: "s3", type: "overskrift", etikett: "Hva gjør vi med det" },
  { id: "tiltak", type: "langtekst", etikett: "Tiltak før arbeidet starter", pakrevd: true },
  { id: "verneutstyr", type: "flervalg", etikett: "Verneutstyr", valg: ["Hjelm", "Vernebriller", "Hansker", "Vernesko", "Hørselvern", "Fallsele", "Åndedrettsvern", "Synlighetstøy"] },
  { id: "isolert", type: "ja_nei", etikett: "Er utstyret gjort strømløst og sikret?", pakrevd: true },
  { id: "arbeidstillatelse", type: "ja_nei", etikett: "Kreves arbeidstillatelse?", pakrevd: true },

  { id: "s4", type: "overskrift", etikett: "Godkjenning" },
  { id: "gjennomgatt", type: "avkryssing", etikett: "Alle deltakere har vært med på gjennomgangen", pakrevd: true },
  { id: "ansvarlig", type: "tekst", etikett: "Ansvarlig for jobben", pakrevd: true },
  { id: "dato", type: "dato", etikett: "Dato for gjennomgang", pakrevd: true },
];
