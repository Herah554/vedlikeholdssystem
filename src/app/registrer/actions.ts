"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { startSession } from "@/lib/auth";
import { opprettBedrift } from "@/lib/bedrift";
import { registreringStatus } from "@/lib/registrering";

export type Resultat = {
  ok: boolean;
  feil?: string;
  /** Det brukeren skrev, slik at skjemaet ikke tømmes ved feil. Passordet
   *  sendes med vilje ikke tilbake. */
  verdier?: { firma: string; orgNumber: string; navn: string; email: string };
};

/** Plukker ut feltene som skal fylles inn igjen etter en feil. */
function skrevet(formData: FormData): Resultat["verdier"] {
  const les = (n: string) => String(formData.get(n) ?? "");
  return {
    firma: les("firma"),
    orgNumber: les("orgNumber"),
    navn: les("navn"),
    email: les("email"),
  };
}

const skjema = z.object({
  firma: z.string().trim().min(2, "Skriv inn firmanavnet."),
  orgNumber: z.string().trim().optional(),
  navn: z.string().trim().min(2, "Skriv inn navnet ditt."),
  email: z.email("Skriv inn en gyldig e-postadresse."),
  password: z.string().min(8, "Passordet må ha minst åtte tegn."),
});

/**
 * Førstegangsoppsettet: oppretter den aller første bedriften og
 * plattformeierkontoen.
 *
 * Dette kan skje nøyaktig én gang, mens databasen er tom. Kontoen som lages
 * her er den eneste som fødes som plattformeier — alle senere bedrifter
 * oppretter du fra /plattform, og deres administratorer er administratorer i
 * sitt eget firma og ingenting mer.
 */
export async function registrerBedrift(
  _forrige: Resultat,
  formData: FormData,
): Promise<Resultat> {
  // Sperren håndheves her, ikke bare i grensesnittet. En stengt side hjelper
  // ikke hvis noen sender skjemaet direkte til serveren.
  const status = await registreringStatus();
  if (!status.apen) {
    return {
      ok: false,
      feil: "Registrering av nye bedrifter er slått av på denne serveren.",
      verdier: skrevet(formData),
    };
  }

  const parsed = skjema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      ok: false,
      feil: parsed.error.issues[0].message,
      verdier: skrevet(formData),
    };
  }
  const d = parsed.data;

  const { org, bruker } = await opprettBedrift({ ...d, plattformeier: true });

  await startSession({
    userId: bruker.id,
    organizationId: org.id,
    organizationName: org.name,
    name: bruker.name,
    email: bruker.email,
    role: bruker.role,
    superadmin: true,
  });

  redirect("/dashbord");
}
