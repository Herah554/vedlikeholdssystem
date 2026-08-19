"use server";

import { settNyttPassord } from "@/lib/passord";

export type Resultat = { ok: boolean; feil?: string };

/**
 * Setter nytt passord ut fra engangslenka.
 *
 * Tokenet kommer fra skjemaet og ikke fra adressefeltet på serveren, men det
 * gjør ingen forskjell for sikkerheten: det er tokenet i seg selv som er
 * beviset, og det kontrolleres mot databasen uansett hvor det kommer fra.
 */
export async function lagreNyttPassord(
  _forrige: Resultat,
  formData: FormData,
): Promise<Resultat> {
  const token = String(formData.get("token") ?? "");
  const passord = String(formData.get("password") ?? "");
  const gjentatt = String(formData.get("password2") ?? "");

  if (passord !== gjentatt) {
    return { ok: false, feil: "De to passordene er ikke like." };
  }

  return settNyttPassord(token, passord);
}
