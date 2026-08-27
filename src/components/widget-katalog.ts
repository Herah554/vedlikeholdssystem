import {
  AlertTriangle,
  Boxes,
  CalendarClock,
  ClipboardList,
  Clock,
  PackageSearch,
  Repeat2,
  Wallet,
} from "lucide-react";

/**
 * Metadata om widgets — hvilke som finnes, hva de heter og hvor store de er.
 *
 * Dette ligger med vilje i en egen fil uten databaseimport. Tilpasningsskjermen
 * er en klientkomponent, og hadde den importert fra widgets.tsx ville hele
 * Prisma-klienten blitt dratt med inn i nettleserpakken.
 */

export type WidgetType =
  | "apne-ordrer"
  | "kritiske-ordrer"
  | "forfalt-pm"
  | "lav-beholdning"
  | "delebehov"
  | "nedetid-30"
  | "kostnad-hittil"
  | "pm-etterlevelse"
  | "ordrer-per-status"
  | "kostnad-per-maaned"
  | "nedetid-per-utstyr"
  | "mine-jobber"
  | "siste-ordrer"
  | "utloper-snart";

/**
 * Rutenettet er tolv kolonner bredt.
 *
 * Fire kolonner ga fire mulige bredder, og det er ikke fritt nok til å bygge
 * dashbordet slik man vil. Tolv deler seg pent i halve, tredjedeler,
 * fjerdedeler og seksdeler — de inndelingene folk faktisk vil ha.
 */
export type Bredde = number;

/** Høyden måles i rader à 3,5rem. Åtte rader rekker for et stort diagram. */
export type Hoyde = number;

export const MAKS_BREDDE = 12;
export const MAKS_HOYDE = 8;

/**
 * Én rad pluss mellomrommet, i piksler. Må stemme med auto-rows i rutenett.tsx.
 *
 * 3,5rem rad og 1rem mellomrom. Halvparten av det gamle, slik at høyden kan
 * finjusteres og ikke bare hoppe i store sprang.
 */
export const RAD_PIKSLER = 72;

export type WidgetOppsett = {
  id: string;
  type: WidgetType;
  w: Bredde;
  h: Hoyde;
  /** Kolonne fra venstre, 0 til 3. Se src/lib/plassering.ts. */
  x: number;
  /** Rad nedover, 0 og oppover. */
  y: number;
};

/** Katalogen brukeren velger fra når hen tilpasser dashbordet. */
export const WIDGET_KATALOG: {
  type: WidgetType;
  navn: string;
  beskrivelse: string;
  bredde: Bredde;
  hoyde: Hoyde;
}[] = [
  { type: "apne-ordrer", navn: "Åpne arbeidsordre", beskrivelse: "Antall jobber som ikke er avsluttet", bredde: 3, hoyde: 2 },
  { type: "kritiske-ordrer", navn: "Kritiske jobber", beskrivelse: "Åpne ordre med prioritet Kritisk", bredde: 3, hoyde: 2 },
  { type: "forfalt-pm", navn: "Forfalt forebyggende", beskrivelse: "Planer som har passert forfallsdato", bredde: 3, hoyde: 2 },
  { type: "lav-beholdning", navn: "Deler under minimum", beskrivelse: "Reservedeler som må bestilles", bredde: 3, hoyde: 2 },
  { type: "delebehov", navn: "Delebehov", beskrivelse: "Deler teknikerne venter på at noen bestiller", bredde: 3, hoyde: 2 },
  { type: "nedetid-30", navn: "Nedetid siste 30 dager", beskrivelse: "Sum stopptid meldt på arbeidsordre", bredde: 3, hoyde: 2 },
  { type: "kostnad-hittil", navn: "Kostnad hittil i år", beskrivelse: "Timer og deler samlet", bredde: 3, hoyde: 2 },
  { type: "pm-etterlevelse", navn: "PM-etterlevelse", beskrivelse: "Andel forebyggende arbeid utført i tide", bredde: 3, hoyde: 2 },
  { type: "ordrer-per-status", navn: "Arbeidsordre per status", beskrivelse: "Søylediagram over statusfordelingen", bredde: 6, hoyde: 4 },
  { type: "kostnad-per-maaned", navn: "Kostnad per måned", beskrivelse: "Arbeid og deler siste tolv måneder", bredde: 6, hoyde: 4 },
  { type: "nedetid-per-utstyr", navn: "Nedetid per utstyr", beskrivelse: "Utstyret som stopper produksjonen mest", bredde: 6, hoyde: 4 },
  { type: "mine-jobber", navn: "Mine jobber", beskrivelse: "Arbeidsordre tildelt deg", bredde: 6, hoyde: 4 },
  { type: "siste-ordrer", navn: "Siste meldinger", beskrivelse: "Nyeste arbeidsordre i systemet", bredde: 6, hoyde: 4 },
  { type: "utloper-snart", navn: "Går snart ut", beskrivelse: "Kalibreringsbevis og sertifikater som nærmer seg utløp", bredde: 6, hoyde: 4 },
];

/** Oppsettet nye brukere ser før de har tilpasset noe selv. */
export const STANDARD_OPPSETT: WidgetOppsett[] = [
  { id: "w1", type: "apne-ordrer", w: 3, h: 2, x: 0, y: 0 },
  { id: "w2", type: "kritiske-ordrer", w: 3, h: 2, x: 3, y: 0 },
  { id: "w3", type: "forfalt-pm", w: 3, h: 2, x: 6, y: 0 },
  { id: "w4", type: "lav-beholdning", w: 3, h: 2, x: 9, y: 0 },
  { id: "w5", type: "ordrer-per-status", w: 6, h: 4, x: 0, y: 2 },
  { id: "w6", type: "kostnad-per-maaned", w: 6, h: 4, x: 6, y: 2 },
  { id: "w7", type: "nedetid-per-utstyr", w: 6, h: 4, x: 0, y: 6 },
  { id: "w8", type: "mine-jobber", w: 6, h: 4, x: 6, y: 6 },
];

/** Ikon per widget, brukt i tilpasningsvisningen. */
export const WIDGET_IKON: Record<WidgetType, typeof ClipboardList> = {
  "apne-ordrer": ClipboardList,
  "kritiske-ordrer": AlertTriangle,
  "forfalt-pm": Repeat2,
  "lav-beholdning": Boxes,
  delebehov: PackageSearch,
  "nedetid-30": Clock,
  "kostnad-hittil": Wallet,
  "pm-etterlevelse": Repeat2,
  "ordrer-per-status": ClipboardList,
  "kostnad-per-maaned": Wallet,
  "nedetid-per-utstyr": Clock,
  "mine-jobber": ClipboardList,
  "siste-ordrer": ClipboardList,
  "utloper-snart": CalendarClock,
};

/**
 * Ferdige oppsett å starte fra.
 *
 * Et tomt rutenett er vanskelig å begynne på, og et dashbord er ikke det
 * samme for en tekniker som for en leder. Malene er ment som utgangspunkt —
 * du drar om på dem etterpå.
 */
export type Mal = {
  id: string;
  navn: string;
  beskrivelse: string;
  oppsett: WidgetOppsett[];
};

export const MALER: Mal[] = [
  {
    id: "standard",
    navn: "Driftsoversikt",
    beskrivelse: "Nøkkeltallene øverst, diagrammene under. Passer de fleste.",
    oppsett: STANDARD_OPPSETT,
  },
  {
    id: "tekniker",
    navn: "Tekniker",
    beskrivelse: "Dine egne jobber først, og det som haster.",
    oppsett: [
      { id: "t1", type: "mine-jobber", w: 6, h: 6, x: 0, y: 0 },
      { id: "t2", type: "kritiske-ordrer", w: 3, h: 2, x: 6, y: 0 },
      { id: "t3", type: "forfalt-pm", w: 3, h: 2, x: 9, y: 0 },
      { id: "t4", type: "lav-beholdning", w: 6, h: 2, x: 0, y: 6 },
      { id: "t5", type: "siste-ordrer", w: 6, h: 4, x: 6, y: 6 },
    ],
  },
  {
    id: "leder",
    navn: "Leder",
    beskrivelse: "Kostnad, nedetid og etterlevelse — det du rapporterer på.",
    oppsett: [
      { id: "l1", type: "kostnad-hittil", w: 3, h: 2, x: 0, y: 0 },
      { id: "l2", type: "nedetid-30", w: 3, h: 2, x: 3, y: 0 },
      { id: "l3", type: "pm-etterlevelse", w: 3, h: 2, x: 6, y: 0 },
      { id: "l4", type: "apne-ordrer", w: 3, h: 2, x: 9, y: 0 },
      { id: "l5", type: "kostnad-per-maaned", w: 12, h: 6, x: 0, y: 2 },
      { id: "l6", type: "nedetid-per-utstyr", w: 6, h: 4, x: 0, y: 8 },
      { id: "l7", type: "ordrer-per-status", w: 6, h: 4, x: 6, y: 8 },
    ],
  },
  {
    id: "delelager",
    navn: "Delelager",
    beskrivelse: "Beholdning og det som må bestilles.",
    oppsett: [
      { id: "d1", type: "lav-beholdning", w: 6, h: 4, x: 0, y: 0 },
      { id: "d2", type: "kostnad-hittil", w: 6, h: 2, x: 6, y: 0 },
      { id: "d3", type: "siste-ordrer", w: 6, h: 6, x: 0, y: 4 },
      { id: "d4", type: "ordrer-per-status", w: 6, h: 4, x: 6, y: 4 },
    ],
  },
  {
    id: "kompakt",
    navn: "Kompakt",
    beskrivelse: "Bare tallene, ingen diagrammer. Passer på en skjerm i verkstedet.",
    oppsett: [
      { id: "k1", type: "apne-ordrer", w: 3, h: 2, x: 0, y: 0 },
      { id: "k2", type: "kritiske-ordrer", w: 3, h: 2, x: 3, y: 0 },
      { id: "k3", type: "forfalt-pm", w: 3, h: 2, x: 6, y: 0 },
      { id: "k4", type: "lav-beholdning", w: 3, h: 2, x: 9, y: 0 },
      { id: "k5", type: "nedetid-30", w: 3, h: 2, x: 0, y: 2 },
      { id: "k6", type: "kostnad-hittil", w: 3, h: 2, x: 3, y: 2 },
      { id: "k7", type: "pm-etterlevelse", w: 3, h: 2, x: 6, y: 2 },
      { id: "k8", type: "mine-jobber", w: 3, h: 2, x: 9, y: 2 },
    ],
  },
];
