"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword, startSession } from "@/lib/auth";
import { STANDARD_OPPSETT } from "@/components/widget-katalog";
import { kodeStemmer, registreringStatus } from "@/lib/registrering";

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
  kode: z.string().trim().optional(),
});

/** Lager en URL-vennlig kortform av firmanavnet. */
function lagSlug(navn: string): string {
  return (
    navn
      .toLowerCase()
      .replace(/æ/g, "ae")
      .replace(/ø/g, "oe")
      .replace(/å/g, "aa")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "firma"
  );
}

/**
 * Registrerer en ny bedrift med sin første administrator.
 *
 * Dette er inngangen for at systemet kan brukes av flere firmaer. Alt som
 * opprettes her får den nye organisasjonens id, og er dermed usynlig for
 * alle andre kunder fra første sekund.
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

  if (status.krevKode && !kodeStemmer(d.kode)) {
    return { ok: false, feil: "Feil invitasjonskode.", verdier: skrevet(formData) };
  }

  const epost = d.email.toLowerCase();

  // E-post er unik per organisasjon, ikke globalt — samme person kan være
  // registrert hos to firmaer. Men to kontoer i samme firma går ikke.
  const passordHash = await hashPassword(d.password);

  // Finn en ledig slug. Kollisjoner er sjeldne, men to firmaer kan hete det
  // samme, og da må den andre få et løpenummer.
  const basis = lagSlug(d.firma);
  let slug = basis;
  for (let i = 2; i < 100; i += 1) {
    const opptatt = await prisma.organization.findUnique({ where: { slug } });
    if (!opptatt) break;
    slug = `${basis}-${i}`;
  }

  const org = await prisma.$transaction(async (tx) => {
    const ny = await tx.organization.create({
      data: {
        slug,
        name: d.firma,
        orgNumber: d.orgNumber || null,
        email: epost,
      },
    });

    await tx.user.create({
      data: {
        organizationId: ny.id,
        name: d.navn,
        email: epost,
        role: "ADMIN",
        passwordHash: passordHash,
      },
    });

    // Et tomt dashbord er en dårlig førsteopplevelse, så den nye
    // organisasjonen får standardoppsettet med én gang.
    await tx.dashboard.create({
      data: {
        organizationId: ny.id,
        name: "Driftsoversikt",
        isDefault: true,
        layout: STANDARD_OPPSETT,
      },
    });

    return ny;
  });

  const bruker = await prisma.user.findFirstOrThrow({
    where: { organizationId: org.id, email: epost },
  });

  await startSession({
    userId: bruker.id,
    organizationId: org.id,
    organizationName: org.name,
    name: bruker.name,
    email: bruker.email,
    role: bruker.role,
  });

  redirect("/dashbord");
}
