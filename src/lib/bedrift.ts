import { prisma } from "@/lib/prisma";
import { beskyttedeModeller } from "@/lib/tenant";
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

/** Dokumenttyper en ny bedrift starter med. Ingen av dem er innebygde. */
const STANDARD_DOKUMENTTYPER = [
  { code: "KALIBRERING", name: "Kalibreringsbevis", description: "Måleutstyr som må kalibreres med jevne mellomrom", tone: "sky" },
  { code: "SERTIFIKAT", name: "Sertifikat", description: "Løfteutstyr, trykkbeholdere og annet med krav", tone: "emerald" },
  { code: "KONTROLL", name: "Kontrollrapport", description: "Periodisk kontroll utført av tredjepart", tone: "amber" },
  { code: "SAMSVAR", name: "Samsvarserklæring", description: "Dokumentasjon fra leverandøren", tone: "violet" },
  { code: "DATABLAD", name: "Datablad", description: "Teknisk beskrivelse av utstyret", tone: "noytral" },
  { code: "TEGNING", name: "Tegning", description: "Koblingsskjema, plantegning eller lignende", tone: "noytral" },
  { code: "MANUAL", name: "Bruksanvisning", description: "Manual fra produsenten", tone: "noytral" },
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
      data: [
        ...STANDARD_ORDRETYPER.map((t, i) => ({
          organizationId: org.id,
          list: "ordretype",
          sortOrder: i,
          ...t,
        })),
        ...STANDARD_DOKUMENTTYPER.map((t, i) => ({
          organizationId: org.id,
          list: "dokumenttype",
          sortOrder: i,
          ...t,
        })),
      ],
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

/**
 * Tømmer alle tabellene som tilhører én organisasjon.
 *
 * Ni fremmednøkler i schemaet er satt til Restrict. De er der med vilje: en
 * arbeidsordre skal ikke miste hvem som meldte den, og et deleuttak skal
 * ikke miste delen det gjaldt. Men de gjør samtidig at et enkelt
 * organization.delete() stopper med en fremmednøkkelfeil på enhver kunde som
 * har brukt systemet — noe man ikke oppdager på en tom testbedrift.
 *
 * Riktigheten ligger i løkken: tabellene prøves om igjen så lenge noe blir
 * borte. Kommer man ingen vei, står det stille, og da er det bedre å stoppe
 * med en tydelig feil enn å slette halvveis. Legger noen til en tabell i
 * morgen, er den dekket uten at noe her må endres — en håndskrevet
 * rekkefølge ville virket i dag og vært feil da.
 *
 * FORST og SIST er bare et hint som gjør at det normalt går rent i første
 * runde. Blir de utdaterte, tar løkken det igjen; det koster en runde og
 * noen fremmednøkkelfeil i loggen, ikke et galt resultat.
 *
 * Dette kan ikke kjøres i én transaksjon: i Postgres avbryter en feilende
 * setning hele transaksjonen, og da er det umulig å prøve neste tabell.
 * Organisasjonsraden slettes derfor til slutt av den som kaller — feiler noe
 * underveis, står kunden fortsatt der, og alt kan kjøres på nytt.
 */

/** Tabeller som peker på andre med Restrict, og må tømmes først. */
const FORST = [
  "PartUsage",
  "PurchaseOrder",
  "PartRequest",
  "TimeEntry",
  "Deviation",
  "WorkOrder",
];

/** Tabellene de peker på. Disse kan først tømmes når FORST er borte. */
const SIST = ["Part", "Supplier", "Asset", "User"];

export async function tomAlleTabeller(orgId: string): Promise<void> {
  const klient = prisma as unknown as Record<
    string,
    { deleteMany?: (a: unknown) => Promise<{ count: number }> }
  >;

  // Organisasjonen selv slettes til slutt, av den som kaller
  const alle = beskyttedeModeller().filter((m) => m !== "Organization");
  const midten = alle.filter((m) => !FORST.includes(m) && !SIST.includes(m));

  let igjen = [
    ...FORST.filter((m) => alle.includes(m)),
    ...midten,
    ...SIST.filter((m) => alle.includes(m)),
  ];

  while (igjen.length > 0) {
    const feilet: string[] = [];

    for (const modell of igjen) {
      const delegat = klient[modell[0].toLowerCase() + modell.slice(1)];
      if (!delegat?.deleteMany) continue;

      try {
        await delegat.deleteMany({ where: { organizationId: orgId } });
      } catch {
        // Noe peker hit fortsatt. Prøv igjen når det er borte.
        feilet.push(modell);
      }
    }

    if (feilet.length === igjen.length) {
      throw new Error(
        `Fikk ikke tømt ${feilet.join(", ")}. Ingenting er slettet av ` +
          "organisasjonen selv, så kunden står fortsatt der.",
      );
    }

    igjen = feilet;
  }
}
