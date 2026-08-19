/**
 * Hvilke kolonner systemet kjenner igjen, og hva de kan hete hos kunden.
 *
 * Ingen har et regneark med kolonner som heter det samme som feltene våre.
 * De heter «TAG», «Utstyrsnr», «Equipment ID» eller «Nr.» — og derfor gjettes
 * koblingen ut fra en liste med synonymer, slik at brukeren i beste fall bare
 * skal bekrefte, ikke fylle ut.
 */

export type Felt = {
  id: string;
  navn: string;
  påkrevd?: boolean;
  hint?: string;
  /** Skrives med små bokstaver og uten skilletegn — se normaliser(). */
  synonymer: string[];
};

export type Importtype = "utstyr" | "deler";

export const UTSTYR_FELTER: Felt[] = [
  {
    id: "code",
    navn: "Kode",
    påkrevd: true,
    hint: "Entydig merking, f.eks. PU-101. Finnes koden fra før, oppdateres enheten.",
    synonymer: ["kode", "tag", "tagnr", "utstyrsnr", "utstyrsnummer", "nr", "nummer", "id", "equipmentid", "assetid", "assetcode"],
  },
  {
    id: "name",
    navn: "Navn",
    påkrevd: true,
    synonymer: ["navn", "beskrivelse", "benevnelse", "utstyr", "name", "description", "assetname"],
  },
  {
    id: "type",
    navn: "Type",
    hint: "Anlegg, system, utstyr eller komponent. Står det ingenting, blir det utstyr.",
    synonymer: ["type", "niva", "nivaa", "kategori", "level", "assettype"],
  },
  {
    id: "parentCode",
    navn: "Ligger under",
    hint: "Koden til enheten over i hierarkiet",
    synonymer: ["ligger under", "forelder", "overordnet", "tilhorer", "parent", "parentcode", "parenttag", "system"],
  },
  {
    id: "location",
    navn: "Plassering",
    synonymer: ["plassering", "sted", "lokasjon", "rom", "omrade", "location", "area"],
  },
  {
    id: "manufacturer",
    navn: "Produsent",
    synonymer: ["produsent", "fabrikat", "leverandor", "merke", "manufacturer", "make", "brand"],
  },
  {
    id: "modelNumber",
    navn: "Modell",
    synonymer: ["modell", "modellnr", "typebetegnelse", "model", "modelnumber"],
  },
  {
    id: "serialNumber",
    navn: "Serienummer",
    synonymer: ["serienummer", "serienr", "serial", "serialnumber", "sn"],
  },
  {
    id: "criticality",
    navn: "Kritikalitet",
    hint: "1 til 5, der 5 er kritisk for produksjonen",
    synonymer: ["kritikalitet", "kritisk", "viktighet", "criticality", "priority"],
  },
  {
    id: "runningHours",
    navn: "Driftstimer",
    synonymer: ["driftstimer", "timer", "runningtimer", "runninghours", "hours"],
  },
];

export const DEL_FELTER: Felt[] = [
  {
    id: "number",
    navn: "Delenummer",
    påkrevd: true,
    hint: "Deres eget nummer. Finnes det fra før, oppdateres delen.",
    synonymer: ["delenummer", "delenr", "varenummer", "varenr", "artikkelnr", "artikkelnummer", "nr", "nummer", "kode", "partnumber", "partno", "sku", "itemnumber"],
  },
  {
    id: "name",
    navn: "Navn",
    påkrevd: true,
    synonymer: ["navn", "beskrivelse", "benevnelse", "vare", "name", "description", "partname"],
  },
  {
    id: "manufacturer",
    navn: "Produsent",
    synonymer: ["produsent", "fabrikat", "merke", "manufacturer", "brand"],
  },
  {
    id: "manufacturerPartNo",
    navn: "Produsentens nummer",
    synonymer: ["produsentnr", "produsentnummer", "fabrikatnr", "oemnr", "manufacturerpartno", "mpn"],
  },
  {
    id: "unit",
    navn: "Enhet",
    hint: "stk, liter, meter. Står det ingenting, blir det stk.",
    synonymer: ["enhet", "benevning", "maleenhet", "unit", "uom"],
  },
  {
    id: "unitCost",
    navn: "Pris",
    hint: "Kroner per enhet",
    synonymer: ["pris", "kostpris", "enhetspris", "innkjopspris", "kost", "unitcost", "price", "cost"],
  },
  {
    id: "quantityOnHand",
    navn: "Beholdning",
    synonymer: ["beholdning", "antall", "lagerbeholdning", "pa lager", "palager", "quantity", "qty", "onhand", "stock"],
  },
  {
    id: "minStock",
    navn: "Minimum",
    hint: "Under dette skal delen bestilles",
    synonymer: ["minimum", "min", "minlager", "minimumsbeholdning", "bestillingspunkt", "minstock", "reorderpoint"],
  },
  {
    id: "maxStock",
    navn: "Maksimum",
    synonymer: ["maksimum", "maks", "maxlager", "makslager", "maxstock"],
  },
  {
    id: "binLocation",
    navn: "Hylleplass",
    synonymer: ["hylleplass", "hylle", "plassering", "lokasjon", "reol", "binlocation", "bin", "location", "shelf"],
  },
  {
    id: "supplierName",
    navn: "Leverandør",
    hint: "Finnes ikke leverandøren, opprettes den",
    synonymer: ["leverandor", "leverandornavn", "supplier", "vendor", "suppliername"],
  },
  {
    id: "leadTimeDays",
    navn: "Leveringstid",
    hint: "Antall dager",
    synonymer: ["leveringstid", "ledetid", "dager", "leadtime", "leadtimedays"],
  },
];

export function felterFor(type: Importtype): Felt[] {
  return type === "utstyr" ? UTSTYR_FELTER : DEL_FELTER;
}

/**
 * Gjør et kolonnenavn sammenliknbart.
 *
 * «Utstyrs-nr.» og «utstyrsnr» skal treffe hverandre, og «Størrelse» skal
 * kunne skrives uten norske tegn i synonymlista.
 */
function normaliser(tekst: string): string {
  return tekst
    .toLowerCase()
    .replace(/æ/g, "ae")
    .replace(/ø/g, "oe")
    .replace(/å/g, "aa")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Gjetter hvilken kolonne som hører til hvilket felt.
 *
 * Returnerer feltets id mot kolonnens plassering. Er ingen kolonne god nok,
 * står feltet ukoblet og brukeren velger selv.
 */
export function gjettKobling(
  kolonner: string[],
  felter: Felt[],
): Record<string, number> {
  const normaliserte = kolonner.map(normaliser);
  const kobling: Record<string, number> = {};
  const brukt = new Set<number>();

  // Eksakt treff først, slik at «Navn» ikke stjeles av et løsere treff
  for (const felt of felter) {
    const synonymer = new Set([normaliser(felt.navn), ...felt.synonymer.map(normaliser)]);

    const i = normaliserte.findIndex((k, n) => !brukt.has(n) && synonymer.has(k));
    if (i >= 0) {
      kobling[felt.id] = i;
      brukt.add(i);
    }
  }

  // Deretter kolonner som begynner med et synonym: «delenr (intern)»
  for (const felt of felter) {
    if (felt.id in kobling) continue;
    const synonymer = [normaliser(felt.navn), ...felt.synonymer.map(normaliser)];

    const i = normaliserte.findIndex(
      (k, n) =>
        !brukt.has(n) &&
        k.length > 2 &&
        synonymer.some((s) => s.length > 2 && k.startsWith(s)),
    );
    if (i >= 0) {
      kobling[felt.id] = i;
      brukt.add(i);
    }
  }

  return kobling;
}

/**
 * Leser et tall slik nordmenn skriver det.
 *
 * «1 234,50» er ett tusen to hundre og trettifire komma femti, ikke noe
 * JavaScript forstår av seg selv. Mellomrommet kan dessuten være et hardt
 * mellomrom fra Excel.
 */
export function tilTall(tekst: string): number | null {
  const renset = tekst
    .replace(/[\s ]/g, "")
    .replace(/kr|nok/gi, "")
    .replace(",", ".");

  if (!renset) return null;

  const n = Number(renset);
  return Number.isFinite(n) ? n : null;
}
