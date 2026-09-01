import { prisma } from "@/lib/prisma";
import { beskyttedeModeller } from "@/lib/tenant";

/**
 * Alt én bedrift har lagt inn, ut av systemet i én fil.
 *
 * Den gjør tre jobber samtidig, og det er derfor den er verdt å bygge før
 * flere funksjoner:
 *
 *   Sikkerhetskopi. «Hva skjer hvis dere mister dataene våre» er det første
 *   en innkjøper spør om, og et svar som bare peker på leverandøren vår er
 *   ikke et svar.
 *
 *   Utgangen. En kunde som ikke kan få dataene sine ut, er en kunde som ikke
 *   tør å komme inn.
 *
 *   Plikten. Databehandleravtalen krever at dataene leveres tilbake når
 *   avtalen tar slutt.
 *
 * Tabellene utledes fra Prisma sine metadata, ikke fra en håndskrevet liste.
 * Legges det til en tabell i morgen, er den med i eksporten uten at noe her
 * må endres — og en glemt tabell er nettopp forskjellen mellom en
 * sikkerhetskopi og en falsk trygghet.
 */

/** Felter som aldri skal ut, uansett hvem som ber. */
const UTELATT: Record<string, string[]> = {
  User: ["passwordHash"],
};

/**
 * Mønster for noe som ser ut som en hemmelighet.
 *
 * Vakten er positiv og ikke negativ: i stedet for å liste opp hva som er
 * farlig, stopper eksporten hvis det dukker opp et felt som *ser* farlig ut
 * og ikke er uttrykkelig håndtert. Legger noen til «apiToken» på en tabell
 * neste år, stanser eksporten framfor å sende nøkkelen ut i et regneark.
 */
const SER_HEMMELIG_UT = /(passord|password|hash|secret|token|nokkel|apikey)/i;

export type Eksport = {
  bedrift: { id: string; navn: string; eksportertAt: string };
  tabeller: Record<string, Record<string, unknown>[]>;
};

/**
 * Fjerner det som ikke skal ut, og stopper hvis noe mistenkelig blir igjen.
 *
 * Kaster framfor å filtrere stille. Et felt ingen har tatt stilling til skal
 * ikke kunne skli ut i en fil kunden får — og en eksport som stopper er
 * mulig å oppdage, mens en lekkasje ikke er det.
 */
export function rensRader(
  tabell: string,
  rader: Record<string, unknown>[],
): Record<string, unknown>[] {
  const fjern = new Set(UTELATT[tabell] ?? []);

  return rader.map((rad) => {
    const ut: Record<string, unknown> = {};

    for (const [felt, verdi] of Object.entries(rad)) {
      if (fjern.has(felt)) continue;

      if (SER_HEMMELIG_UT.test(felt)) {
        throw new Error(
          `Feltet «${tabell}.${felt}» ser ut som en hemmelighet, men står ` +
            "ikke i UTELATT i src/lib/eksport.ts. Eksporten er stanset. " +
            "Ta stilling til feltet — enten hører det med, og da skal " +
            "navnet unntas her, eller så skal det utelates.",
        );
      }

      ut[felt] = verdi;
    }

    return ut;
  });
}

/** Henter alt for én organisasjon. */
export async function eksporterOrg(orgId: string): Promise<Eksport> {
  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: orgId },
    select: { id: true, name: true },
  });

  const klient = prisma as unknown as Record<
    string,
    { findMany?: (a: unknown) => Promise<Record<string, unknown>[]> }
  >;

  const tabeller: Record<string, Record<string, unknown>[]> = {};

  for (const modell of beskyttedeModeller()) {
    if (modell === "Organization") continue;

    const delegat = klient[modell[0].toLowerCase() + modell.slice(1)];
    if (!delegat?.findMany) continue;

    const rader = await delegat.findMany({ where: { organizationId: orgId } });
    tabeller[modell] = rensRader(modell, rader);
  }

  return {
    bedrift: {
      id: org.id,
      navn: org.name,
      eksportertAt: new Date().toISOString(),
    },
    tabeller,
  };
}

/**
 * Gjør en verdi om til noe som kan stå i en celle.
 *
 * Datoer skrives som ISO, slik at de kan leses igjen maskinelt. Objekter og
 * lister skrives som JSON framfor «[object Object]» — det er stygt, men det
 * er sant, og en eksport som mister innhold er verre enn en som er stygg.
 */
export function tilCelle(verdi: unknown): string | number | boolean | null {
  if (verdi == null) return null;
  if (verdi instanceof Date) return verdi.toISOString();
  if (typeof verdi === "bigint") return Number(verdi);
  if (
    typeof verdi === "string" ||
    typeof verdi === "number" ||
    typeof verdi === "boolean"
  ) {
    return verdi;
  }
  // Lister må sjekkes før toString. String([1, 2]) gir «1,2», som ser ut
  // som en verdi og ikke som en liste — og da er formen tapt i eksporten.
  if (Array.isArray(verdi)) return JSON.stringify(verdi);

  // Decimal fra Prisma, og alt annet sammensatt
  if (typeof verdi === "object" && "toString" in verdi) {
    const s = String(verdi);
    if (s !== "[object Object]") return s;
  }
  return JSON.stringify(verdi);
}

/**
 * Eksporten som regneark, ett ark per tabell.
 *
 * Regneark og ikke bare JSON fordi mottakeren er et menneske. En kunde som
 * ber om dataene sine skal kunne åpne dem, ikke bare arkivere dem — og en
 * fil ingen kan lese er ikke et svar på «kan vi få dataene våre».
 *
 * Tomme tabeller får også et ark. Et ark uten rader sier «vi har ingen
 * avvik»; et ark som mangler sier ingenting, og da må man gjette.
 */
export async function tilRegneark(ut: Eksport): Promise<ArrayBuffer> {
  const ExcelJS = (await import("exceljs")).default;

  const bok = new ExcelJS.Workbook();
  bok.creator = ut.bedrift.navn;

  const forside = bok.addWorksheet("Om filen");
  forside.columns = [
    { header: "Felt", key: "felt", width: 22 },
    { header: "Verdi", key: "verdi", width: 60 },
  ];
  forside.getRow(1).font = { bold: true };
  forside.addRow({ felt: "Bedrift", verdi: ut.bedrift.navn });
  forside.addRow({ felt: "Eksportert", verdi: ut.bedrift.eksportertAt });
  forside.addRow({
    felt: "Innhold",
    verdi: `${Object.keys(ut.tabeller).length} tabeller, ett ark per tabell`,
  });
  forside.addRow({
    felt: "Merk",
    verdi:
      "Passord er ikke med. De lagres bare som hash og kan ikke leses ut " +
      "av noen — heller ikke av oss.",
  });

  for (const [navn, rader] of Object.entries(ut.tabeller)) {
    // Excel tillater 31 tegn i arknavn. Modellnavnene er kortere, men
    // grensen står her så en lang tabell i framtiden ikke velter fila.
    const ark = bok.addWorksheet(navn.slice(0, 31));

    if (rader.length === 0) {
      ark.addRow(["(ingen rader)"]);
      continue;
    }

    // Kolonnene tas fra alle radene, ikke bare den første: et felt som er
    // null i rad én finnes likevel, og skal ha sin egen kolonne.
    const kolonner = [...new Set(rader.flatMap((r) => Object.keys(r)))];
    ark.columns = kolonner.map((k) => ({ header: k, key: k, width: 18 }));
    ark.getRow(1).font = { bold: true };

    for (const rad of rader) {
      ark.addRow(
        Object.fromEntries(kolonner.map((k) => [k, tilCelle(rad[k])])),
      );
    }
  }

  return bok.xlsx.writeBuffer() as Promise<ArrayBuffer>;
}

/** Filnavn med bedrift og dato, trygt å bruke i en Content-Disposition. */
export function filnavn(ut: Eksport, endelse: string): string {
  const navn = ut.bedrift.navn
    .toLowerCase()
    .replace(/æ/g, "ae")
    .replace(/ø/g, "oe")
    .replace(/å/g, "aa")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);

  return `${navn || "bedrift"}-${ut.bedrift.eksportertAt.slice(0, 10)}.${endelse}`;
}
