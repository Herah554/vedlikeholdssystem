import {
  AlertTriangle,
  Boxes,
  ClipboardList,
  Clock,
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
  | "nedetid-30"
  | "kostnad-hittil"
  | "pm-etterlevelse"
  | "ordrer-per-status"
  | "kostnad-per-maaned"
  | "nedetid-per-utstyr"
  | "mine-jobber"
  | "siste-ordrer";

/** Rutenettet er fire kolonner bredt. En widget kan dekke fra én til alle. */
export type Bredde = 1 | 2 | 3 | 4;

/** Høyden måles i rader à 8rem. Tre rader er nok til de største diagrammene. */
export type Hoyde = 1 | 2 | 3;

export const MAKS_BREDDE = 4;
export const MAKS_HOYDE = 3;

/** Én radhøyde i piksler. Må stemme med RAD_HOYDE i rutenett.tsx. */
export const RAD_PIKSLER = 128;

export type WidgetOppsett = {
  id: string;
  type: WidgetType;
  w: Bredde;
  h: Hoyde;
};

/** Katalogen brukeren velger fra når hen tilpasser dashbordet. */
export const WIDGET_KATALOG: {
  type: WidgetType;
  navn: string;
  beskrivelse: string;
  bredde: Bredde;
  hoyde: Hoyde;
}[] = [
  { type: "apne-ordrer", navn: "Åpne arbeidsordre", beskrivelse: "Antall jobber som ikke er avsluttet", bredde: 1, hoyde: 1 },
  { type: "kritiske-ordrer", navn: "Kritiske jobber", beskrivelse: "Åpne ordre med prioritet Kritisk", bredde: 1, hoyde: 1 },
  { type: "forfalt-pm", navn: "Forfalt forebyggende", beskrivelse: "Planer som har passert forfallsdato", bredde: 1, hoyde: 1 },
  { type: "lav-beholdning", navn: "Deler under minimum", beskrivelse: "Reservedeler som må bestilles", bredde: 1, hoyde: 1 },
  { type: "nedetid-30", navn: "Nedetid siste 30 dager", beskrivelse: "Sum stopptid meldt på arbeidsordre", bredde: 1, hoyde: 1 },
  { type: "kostnad-hittil", navn: "Kostnad hittil i år", beskrivelse: "Timer og deler samlet", bredde: 1, hoyde: 1 },
  { type: "pm-etterlevelse", navn: "PM-etterlevelse", beskrivelse: "Andel forebyggende arbeid utført i tide", bredde: 1, hoyde: 1 },
  { type: "ordrer-per-status", navn: "Arbeidsordre per status", beskrivelse: "Søylediagram over statusfordelingen", bredde: 2, hoyde: 2 },
  { type: "kostnad-per-maaned", navn: "Kostnad per måned", beskrivelse: "Arbeid og deler siste tolv måneder", bredde: 2, hoyde: 2 },
  { type: "nedetid-per-utstyr", navn: "Nedetid per utstyr", beskrivelse: "Utstyret som stopper produksjonen mest", bredde: 2, hoyde: 2 },
  { type: "mine-jobber", navn: "Mine jobber", beskrivelse: "Arbeidsordre tildelt deg", bredde: 2, hoyde: 2 },
  { type: "siste-ordrer", navn: "Siste meldinger", beskrivelse: "Nyeste arbeidsordre i systemet", bredde: 2, hoyde: 2 },
];

/** Oppsettet nye brukere ser før de har tilpasset noe selv. */
export const STANDARD_OPPSETT: WidgetOppsett[] = [
  { id: "w1", type: "apne-ordrer", w: 1, h: 1 },
  { id: "w2", type: "kritiske-ordrer", w: 1, h: 1 },
  { id: "w3", type: "forfalt-pm", w: 1, h: 1 },
  { id: "w4", type: "lav-beholdning", w: 1, h: 1 },
  { id: "w5", type: "ordrer-per-status", w: 2, h: 2 },
  { id: "w6", type: "kostnad-per-maaned", w: 2, h: 2 },
  { id: "w7", type: "nedetid-per-utstyr", w: 2, h: 2 },
  { id: "w8", type: "mine-jobber", w: 2, h: 2 },
];

/** Ikon per widget, brukt i tilpasningsvisningen. */
export const WIDGET_IKON: Record<WidgetType, typeof ClipboardList> = {
  "apne-ordrer": ClipboardList,
  "kritiske-ordrer": AlertTriangle,
  "forfalt-pm": Repeat2,
  "lav-beholdning": Boxes,
  "nedetid-30": Clock,
  "kostnad-hittil": Wallet,
  "pm-etterlevelse": Repeat2,
  "ordrer-per-status": ClipboardList,
  "kostnad-per-maaned": Wallet,
  "nedetid-per-utstyr": Clock,
  "mine-jobber": ClipboardList,
  "siste-ordrer": ClipboardList,
};
