/**
 * Leser teksten ut av en PDF.
 *
 * Poenget er at assistenten skal kunne søke i manualene og
 * kalibreringsbevisene kunden allerede har lastet opp, ikke bare i filnavnet.
 *
 * To ting den ikke kan: en PDF som bare inneholder skannede sider har ikke
 * noe tekstlag å lese, og et bilde av en side er fortsatt et bilde. Da blir
 * resultatet tomt, og systemet lar det være — det er ingen feil, bare en
 * grense.
 */

/** Lengste tekst vi tar vare på per fil. */
const MAKS_TEGN = 200_000;

/** Harde mellomrom og andre usynlige tegn PDF-er er fulle av. */
const USYNLIGE = /[   ​﻿]/g;

/**
 * Lesingen skal aldri stoppe en opplasting.
 *
 * En PDF kan være passordbeskyttet, ødelagt eller laget av et program som
 * gjør noe rart. Da er filen fortsatt verdt å ta vare på — den mister bare
 * muligheten til å bli søkt i.
 */
export async function lesPdfTekst(data: Uint8Array): Promise<string | null> {
  try {
    const { extractText, getDocumentProxy } = await import("unpdf");

    const dokument = await getDocumentProxy(data);
    const { text } = await extractText(dokument, { mergePages: true });

    const renset = String(text ?? "")
      .replace(USYNLIGE, " ")
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    // Under tjue tegn er det ikke noe tekstlag å snakke om — typisk en
    // skannet side der alt innhold er ett stort bilde.
    if (renset.length < 20) return null;

    return renset.slice(0, MAKS_TEGN);
  } catch {
    return null;
  }
}
