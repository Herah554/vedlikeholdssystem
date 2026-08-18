"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { authenticate, endSession, startSession } from "@/lib/auth";

const skjema = z.object({
  email: z.email("Skriv inn en gyldig e-postadresse."),
  password: z.string().min(1, "Skriv inn passordet ditt."),
});

export type LoginState = { error?: string };

export async function loggInn(
  _forrige: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = skjema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const resultat = await authenticate(parsed.data.email, parsed.data.password);
  if (!resultat.ok) {
    return { error: resultat.error };
  }

  await startSession(resultat.session);

  // redirect kaster en spesiell feil som Next.js fanger opp, så den må
  // stå utenfor try/catch for å virke.
  redirect("/dashbord");
}

export async function loggUt(): Promise<void> {
  await endSession();
  redirect("/logg-inn");
}
