/**
 * Kontroll av adresser brukere skriver inn selv.
 *
 * Hurtiglenkene på dashbordet er det ene stedet i systemet der én bruker
 * skriver inn en adresse som andre senere klikker på. Uten kontroll er det
 * en åpen dør: «javascript:...» i en href kjører kode i nettleseren til den
 * som klikker, med den påloggedes rettigheter. Samme med «data:» — en side
 * som ser ut som innloggingsvinduet vårt kan legges rett inn i en lenke.
 *
 * Derfor er dette en hviteliste, ikke en svarteliste. En svarteliste over
 * farlige protokoller er en liste man garantert glemmer noe fra, og
 * nettlesere godtar mer enn man tror: mellomrom, linjeskift og store
 * bokstaver inne i «java\nscript:» leses fortsatt som protokollen.
 */

/** Protokollene som slipper gjennom. Alt annet avvises. */
const TILLATTE = ["http:", "https:"];

export type Lenkesvar =
  | { ok: true; url: string }
  | { ok: false; feil: string };

/**
 * Gjør en innskrevet adresse om til noe det er trygt å legge i en href.
 *
 * Interne stier («/arbeidsordre») slipper gjennom som de er. Alt annet må
 * være en adresse nettleseren selv kan tolke som http eller https.
 */
export function trygLenke(rå: string): Lenkesvar {
  const tekst = rå.trim();

  if (tekst.length === 0) {
    return { ok: false, feil: "Skriv inn en adresse." };
  }

  // Intern sti. Doble skråstreker utelukkes: «//example.com» ser ut som en
  // sti, men nettleseren leser den som en annen nettstad.
  if (tekst.startsWith("/")) {
    if (tekst.startsWith("//")) {
      return {
        ok: false,
        feil: "Adressen peker ut av systemet. Skriv hele adressen med https://.",
      };
    }
    return { ok: true, url: tekst };
  }

  // Uten protokoll antar vi https. «idvest.no» er det folk skriver.
  const medProtokoll = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(tekst)
    ? tekst
    : `https://${tekst}`;

  let url: URL;
  try {
    url = new URL(medProtokoll);
  } catch {
    return { ok: false, feil: "Dette ser ikke ut som en adresse." };
  }

  if (!TILLATTE.includes(url.protocol)) {
    return {
      ok: false,
      feil: `Bare http, https og interne stier kan brukes — ikke «${url.protocol}».`,
    };
  }

  return { ok: true, url: url.toString() };
}
