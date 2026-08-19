"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { bestillNyttPassord } from "@/lib/passord";
import { harSmtp, sendEpost } from "@/lib/epost";

export type Resultat = { sendt: boolean; feil?: string; utenEpost?: boolean };

const skjema = z.object({ email: z.email("Skriv inn en gyldig e-postadresse.") });

/**
 * Finner ut hvor systemet ligger, slik at lenka i e-posten peker riktig.
 *
 * Adressen tas fra forespørselen og ikke fra en miljøvariabel man kan glemme
 * å sette. Ligger systemet på et eget domene, virker det uten videre.
 */
async function grunnadresse(): Promise<string> {
  const h = await headers();
  const vert = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const protokoll = h.get("x-forwarded-proto") ?? (vert.startsWith("localhost") ? "http" : "https");
  return `${protokoll}://${vert}`;
}

/**
 * Ber om en engangslenke for å sette nytt passord.
 *
 * Svaret er det samme enten adressen finnes eller ikke. Ellers kunne hvem som
 * helst brukt siden til å finne ut hvem som jobber i hvilken bedrift.
 */
export async function bestillLenke(
  _forrige: Resultat,
  formData: FormData,
): Promise<Resultat> {
  const parsed = skjema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { sendt: false, feil: parsed.error.issues[0].message };
  }

  // Uten e-postoppsett kommer lenka aldri fram. Da er det ærligere å si det
  // enn å late som om det er sendt noe.
  if (!harSmtp()) {
    return { sendt: false, utenEpost: true };
  }

  const svar = await bestillNyttPassord(parsed.data.email);

  if (svar.sendt) {
    const lenke = `${await grunnadresse()}/nytt-passord?token=${svar.token}`;

    await sendEpost({
      til: svar.epost,
      emne: "Sett nytt passord",
      tekst: [
        `Hei ${svar.navn},`,
        "",
        "Noen har bedt om å sette nytt passord på kontoen din i vedlikeholdssystemet.",
        "Var det ikke deg, kan du se bort fra denne e-posten. Passordet ditt er uendret.",
        "",
        "Trykk her for å velge et nytt passord:",
        lenke,
        "",
        "Lenka virker i én time, og bare én gang.",
      ].join("\n"),
    });
  }

  // Samme svar uansett — se kommentaren over.
  return { sendt: true };
}
