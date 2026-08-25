import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { STANDARD_OPPSETT } from "@/components/widget-katalog";
import type { Organization, User } from "@/generated/prisma/client";

/** Lager en URL-vennlig kortform av firmanavnet. */
export function lagSlug(navn: string): string {
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

/** Finner en ledig slug. To firmaer kan hete det samme. */
async function ledigSlug(firmanavn: string): Promise<string> {
  const basis = lagSlug(firmanavn);
  let slug = basis;

  for (let i = 2; i < 1000; i += 1) {
    const opptatt = await prisma.organization.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!opptatt) return slug;
    slug = `${basis}-${i}`;
  }

  throw new Error("Fant ingen ledig kortform av firmanavnet.");
}

/**
 * Verdiene en ny bedrift starter med.
 *
 * De to første kan ikke fjernes: systemet lager selv forebyggende ordre fra
 * planer, og en korrektiv jobb er det en feilmelding blir til. De to andre er
 * bare et fornuftig utgangspunkt og kan slettes fritt.
 */
const STANDARD_ORDRETYPER = [
  { code: "KORREKTIV", name: "Korrektiv", description: "Retter en feil som har oppstått", tone: "rose", isBuiltIn: true },
  { code: "FOREBYGGENDE", name: "Forebyggende", description: "Planlagt vedlikehold, ofte fra en plan", tone: "emerald", isBuiltIn: true },
  { code: "INSPEKSJON", name: "Inspeksjon", description: "Kontroll uten at noe er meldt galt", tone: "sky", isBuiltIn: false },
  { code: "FORBEDRING", name: "Forbedring", description: "Endring som gjør noe bedre enn før", tone: "violet", isBuiltIn: false },
];

export type NyBedrift = {
  firma: string;
  orgNumber?: string;
  navn: string;
  email: string;
  password: string;
  /**
   * Gjør den første brukeren til plattformeier. Brukes kun ved
   * førstegangsoppsettet — kunder du oppretter selv skal aldri ha den.
   */
  plattformeier?: boolean;
};

/**
 * Oppretter en bedrift med sin første administrator.
 *
 * Alt som lages her får den nye organisasjonens id, og er dermed usynlig for
 * alle andre kunder fra første sekund. Kalles fra to steder: førstegangs-
 * oppsettet på /registrer, og plattformsiden der du oppretter kunder.
 */
export async function opprettBedrift(
  d: NyBedrift,
): Promise<{ org: Organization; bruker: User }> {
  const epost = d.email.trim().toLowerCase();
  const passordHash = await hashPassword(d.password);
  const slug = await ledigSlug(d.firma);

  return prisma.$transaction(async (tx) => {
    const org = await tx.organization.create({
      data: {
        slug,
        name: d.firma.trim(),
        orgNumber: d.orgNumber?.trim() || null,
        email: epost,
      },
    });

    const bruker = await tx.user.create({
      data: {
        organizationId: org.id,
        name: d.navn.trim(),
        email: epost,
        role: "ADMIN",
        passwordHash: passordHash,
        isSuperAdmin: d.plattformeier === true,
      },
    });

    // Uten typer i lista ville skjemaet for ny arbeidsordre hatt et tomt
    // nedtrekk, og ingen ville skjønt hvorfor.
    await tx.listValue.createMany({
      data: STANDARD_ORDRETYPER.map((t, i) => ({
        organizationId: org.id,
        list: "ordretype",
        sortOrder: i,
        ...t,
      })),
    });

    // Et tomt dashbord er en dårlig førsteopplevelse, så den nye
    // organisasjonen får standardoppsettet med én gang.
    await tx.dashboard.create({
      data: {
        organizationId: org.id,
        name: "Driftsoversikt",
        isDefault: true,
        layout: STANDARD_OPPSETT,
      },
    });

    return { org, bruker };
  });
}
