import { del, put } from "@vercel/blob";

/**
 * Lagring av bilder og dokumenter.
 *
 * Filene kan ikke ligge på serverens egen disk. Vercel kjører appen i en
 * beholder som kastes etter hver forespørsel, så et bilde lagret der ville
 * vært borte før teknikeren rakk å laste siden på nytt. Derfor går de til en
 * egen lagringstjeneste.
 *
 * Alt som har med lagringstjenesten å gjøre ligger her, slik at bytte til
 * S3 eller noe annet senere er én fil å skrive om — ikke hver eneste side
 * som viser et bilde.
 */

/** Filtypene systemet tar imot. Alt annet avvises. */
const TILLATTE = new Map<string, string[]>([
  ["image/jpeg", [".jpg", ".jpeg"]],
  ["image/png", [".png"]],
  ["image/webp", [".webp"]],
  ["image/heic", [".heic"]],
  ["application/pdf", [".pdf"]],
]);

/**
 * Fire megabyte per fil.
 *
 * Bildene krympes i nettleseren før de sendes, så et vanlig mobilbilde havner
 * langt under. Grensa er der for PDF-er og for den som prøver seg.
 */
export const MAKS_BYTES = 4 * 1024 * 1024;

export function harLagring(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

export type Lagret = { nokkel: string; url: string };

/** Renser filnavnet så det er trygt å bruke i en adresse. */
function trygtNavn(navn: string): string {
  return (
    navn
      .toLowerCase()
      .replace(/æ/g, "ae")
      .replace(/ø/g, "oe")
      .replace(/å/g, "aa")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "fil"
  );
}

export type Avvist = { ok: false; feil: string };
export type Godtatt = { ok: true };

/** Kontrollerer type og størrelse før noe sendes videre. */
export function sjekkFil(navn: string, mimeType: string, bytes: number): Avvist | Godtatt {
  if (bytes === 0) return { ok: false, feil: "Fila er tom." };

  if (bytes > MAKS_BYTES) {
    return {
      ok: false,
      feil: `«${navn}» er ${(bytes / 1024 / 1024).toFixed(1)} MB. Grensa er ${MAKS_BYTES / 1024 / 1024} MB.`,
    };
  }

  const endelser = TILLATTE.get(mimeType);
  const lav = navn.toLowerCase();

  // Både typen nettleseren oppgir og endelsen må stemme. Typen alene kan
  // settes fritt av den som sender forespørselen.
  if (!endelser || !endelser.some((e) => lav.endsWith(e))) {
    return {
      ok: false,
      feil: `«${navn}» er ikke en filtype systemet tar imot. Bruk bilde eller PDF.`,
    };
  }

  return { ok: true };
}

/**
 * Legger fila i lagringstjenesten.
 *
 * Nøkkelen begynner med organisasjonens id. Det gir ikke sikkerhet i seg selv
 * — adressen er offentlig for den som har den — men det gjør det mulig å
 * rydde bort alt som hører til én kunde, og å se hvem en fil tilhører uten å
 * slå opp i databasen.
 *
 * Filnavnet får et tilfeldig tillegg fra tjenesten, slik at to bilder som
 * begge heter «IMG_0042.jpg» ikke skriver over hverandre.
 */
export async function lagreFil(opts: {
  organizationId: string;
  filnavn: string;
  mimeType: string;
  data: ArrayBuffer | Uint8Array;
}): Promise<Lagret> {
  if (!harLagring()) {
    throw new Error(
      "Fillagring er ikke satt opp på denne serveren. Legg til en Blob-lagring i Vercel og sett BLOB_READ_WRITE_TOKEN.",
    );
  }

  const nokkel = `${opts.organizationId}/${trygtNavn(opts.filnavn)}`;

  const svar = await put(nokkel, opts.data as ArrayBuffer, {
    access: "public",
    contentType: opts.mimeType,
    addRandomSuffix: true,
  });

  return { nokkel: svar.pathname, url: svar.url };
}

/** Fjerner fila. Feiler den, er det ikke verdt å stoppe brukeren for det. */
export async function slettFil(url: string): Promise<void> {
  if (!harLagring()) return;
  try {
    await del(url);
  } catch {
    // Filen kan allerede være borte. Raden i databasen er det som betyr noe.
  }
}
