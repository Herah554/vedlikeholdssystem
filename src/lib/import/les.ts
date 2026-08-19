import ExcelJS from "exceljs";

/**
 * Leser en tabell ut av en fil kunden har liggende fra før.
 *
 * Det er her importen står og faller. Et regneark fra en norsk maskin er
 * sjelden den pene UTF-8-fila med komma som eksemplene viser: norsk Excel
 * skriver CSV med semikolon, og ofte i den gamle Windows-tegnkodingen der
 * æ, ø og å blir til rare tegn. Går det galt her, ser kunden en liste med
 * «Pumpest�rrelse» og konkluderer med at systemet ikke virker.
 */

export type Tabell = {
  kolonner: string[];
  rader: string[][];
};

/** Flere rader enn dette er neppe et forsøk på import. */
export const MAKS_RADER = 5000;

/**
 * Gjetter tegnkodingen.
 *
 * UTF-8 prøves først og strengt. Er fila noe annet, kaster dekodingen, og da
 * er Windows-1252 det klart mest sannsynlige på en norsk kontormaskin.
 */
function tilTekst(data: Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(data);
  } catch {
    return new TextDecoder("windows-1252").decode(data);
  }
}

/**
 * Finner skilletegnet ved å telle hva som gir flest kolonner på første linje.
 *
 * Å spørre brukeren ville vært å be dem om å vite noe de ikke har grunn til
 * å vite.
 */
function finnSkilletegn(forsteLinje: string): string {
  const kandidater = [";", ",", "\t", "|"];
  let best = ";";
  let flest = 0;

  for (const tegn of kandidater) {
    const antall = delLinje(forsteLinje, tegn).length;
    if (antall > flest) {
      flest = antall;
      best = tegn;
    }
  }

  return best;
}

/**
 * Deler én linje, med respekt for anførselstegn.
 *
 * Et felt som «Pumpe, stor» skal ikke bli til to kolonner fordi det står et
 * komma inni. To anførselstegn etter hverandre betyr ett ekte anførselstegn.
 */
function delLinje(linje: string, skilletegn: string): string[] {
  const felter: string[] = [];
  let felt = "";
  let iSitat = false;

  for (let i = 0; i < linje.length; i += 1) {
    const tegn = linje[i];

    if (tegn === '"') {
      if (iSitat && linje[i + 1] === '"') {
        felt += '"';
        i += 1;
      } else {
        iSitat = !iSitat;
      }
      continue;
    }

    if (tegn === skilletegn && !iSitat) {
      felter.push(felt);
      felt = "";
      continue;
    }

    felt += tegn;
  }

  felter.push(felt);
  return felter;
}

/**
 * Deler teksten i linjer, men bare der linjeskiftet er ekte.
 *
 * Et fritekstfelt kan inneholde linjeskift inni anførselstegn — en
 * utstyrsbeskrivelse over to linjer er ikke uvanlig — og da hører de fortsatt
 * til samme rad.
 */
function delLinjer(tekst: string): string[] {
  const linjer: string[] = [];
  let linje = "";
  let iSitat = false;

  for (let i = 0; i < tekst.length; i += 1) {
    const tegn = tekst[i];

    if (tegn === '"') {
      iSitat = !iSitat;
      linje += tegn;
      continue;
    }

    if ((tegn === "\n" || tegn === "\r") && !iSitat) {
      if (tegn === "\r" && tekst[i + 1] === "\n") i += 1;
      linjer.push(linje);
      linje = "";
      continue;
    }

    linje += tegn;
  }

  if (linje) linjer.push(linje);
  return linjer;
}

function lesCsv(data: Uint8Array): Tabell {
  // Excel legger et usynlig merke først i fila. Blir det stående, heter den
  // første kolonnen «﻿Kode» og treffer ingen gjenkjenning.
  const tekst = tilTekst(data).replace(/^﻿/, "");

  const linjer = delLinjer(tekst).filter((l) => l.trim().length > 0);
  if (linjer.length === 0) return { kolonner: [], rader: [] };

  const skilletegn = finnSkilletegn(linjer[0]);
  const alle = linjer.map((l) => delLinje(l, skilletegn).map((f) => f.trim()));

  const [kolonner, ...rader] = alle;
  return { kolonner, rader: rader.slice(0, MAKS_RADER) };
}

async function lesXlsx(data: Uint8Array): Promise<Tabell> {
  const bok = new ExcelJS.Workbook();
  // Kopien er nødvendig: exceljs vil ha en ekte ArrayBuffer, ikke en utsnitt
  // av en større buffer slik File.arrayBuffer() kan gi.
  await bok.xlsx.load(data.slice().buffer as ArrayBuffer);

  const ark = bok.worksheets[0];
  if (!ark) return { kolonner: [], rader: [] };

  const alle: string[][] = [];

  ark.eachRow({ includeEmpty: false }, (rad) => {
    if (alle.length > MAKS_RADER) return;

    // values[0] er alltid tom — exceljs teller kolonner fra 1
    const verdier = (rad.values as unknown[]).slice(1);
    alle.push(verdier.map(tilStreng));
  });

  if (alle.length === 0) return { kolonner: [], rader: [] };

  const [kolonner, ...rader] = alle;
  return { kolonner, rader };
}

/** Én celle kan være tekst, tall, dato, formel eller en lenke. */
function tilStreng(verdi: unknown): string {
  if (verdi === null || verdi === undefined) return "";
  if (verdi instanceof Date) return verdi.toISOString().slice(0, 10);

  if (typeof verdi === "object") {
    const o = verdi as Record<string, unknown>;
    // Formel: vi vil ha svaret, ikke regnestykket
    if ("result" in o) return tilStreng(o.result);
    if ("text" in o) return tilStreng(o.text);
    if ("richText" in o && Array.isArray(o.richText)) {
      return o.richText.map((d) => tilStreng((d as { text: unknown }).text)).join("");
    }
    return "";
  }

  return String(verdi).trim();
}

/** Leser fila ut fra navnet. Alt annet enn xlsx behandles som tekst. */
export async function lesTabell(
  filnavn: string,
  data: Uint8Array,
): Promise<Tabell> {
  const lav = filnavn.toLowerCase();

  if (lav.endsWith(".xlsx") || lav.endsWith(".xlsm")) {
    return lesXlsx(data);
  }

  if (lav.endsWith(".xls")) {
    throw new Error(
      "Gamle .xls-filer støttes ikke. Åpne fila i Excel og lagre den som .xlsx eller .csv.",
    );
  }

  return lesCsv(data);
}
