import nodemailer from "nodemailer";
import { kroner, tall, toNumber } from "@/lib/format";

/**
 * E-post til leverandør.
 *
 * Systemet kan sende selv når det er satt opp en SMTP-server, men fungerer
 * like fullt uten: da får brukeren den ferdige teksten og en knapp som åpner
 * hens egen e-postklient med alt utfylt. De fleste små vedlikeholdsavdelinger
 * har ingen SMTP-server å peke på, og skal ikke måtte skaffe en for å kunne
 * bestille et lager.
 */

export type BestillingForEpost = {
  number: number;
  reference: string | null;
  note: string | null;
  expectedAt: Date | null;
  supplier: {
    name: string;
    contactName: string | null;
    email: string | null;
  };
  lines: {
    quantity: number;
    unitCost: unknown;
    part: {
      number: string;
      name: string;
      unit: string;
      manufacturer: string | null;
      manufacturerPartNo: string | null;
    };
  }[];
};

export type Avsender = {
  name: string;
  orgNumber: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  postalCode: string | null;
  city: string | null;
};

export function bestillingsNummer(n: number): string {
  return `BE-${String(n).padStart(4, "0")}`;
}

/** Bygger emne og brødtekst. Ren tekst — det er det leverandører faktisk leser. */
export function byggBestillingsEpost(
  bestilling: BestillingForEpost,
  avsender: Avsender,
  bestiltAv: string,
): { emne: string; tekst: string; til: string | null } {
  const nr = bestillingsNummer(bestilling.number);
  const hilsenNavn = bestilling.supplier.contactName ?? bestilling.supplier.name;

  const linjer = bestilling.lines.map((l, i) => {
    const produsent = [l.part.manufacturer, l.part.manufacturerPartNo]
      .filter(Boolean)
      .join(" ");
    return [
      `${i + 1}. ${l.part.name}`,
      `   Vårt delenummer: ${l.part.number}`,
      produsent ? `   Produsent: ${produsent}` : null,
      `   Antall: ${tall(l.quantity)} ${l.part.unit}`,
      `   Veiledende pris: ${kroner(toNumber(l.unitCost))} per ${l.part.unit}`,
    ]
      .filter(Boolean)
      .join("\n");
  });

  const sum = bestilling.lines.reduce(
    (s, l) => s + l.quantity * toNumber(l.unitCost),
    0,
  );

  const leveringsadresse = [
    avsender.name,
    avsender.address,
    [avsender.postalCode, avsender.city].filter(Boolean).join(" ") || null,
  ]
    .filter(Boolean)
    .join("\n");

  const tekst = [
    `Hei ${hilsenNavn},`,
    "",
    `Vi ønsker å bestille følgende deler. Vår referanse er ${bestilling.reference ?? nr}.`,
    "",
    linjer.join("\n\n"),
    "",
    `Sum veiledende: ${kroner(sum)} eks. mva.`,
    bestilling.expectedAt
      ? `\nØnsket leveringsdato: ${new Intl.DateTimeFormat("nb-NO", { dateStyle: "long" }).format(bestilling.expectedAt)}`
      : null,
    bestilling.note ? `\nMerknad:\n${bestilling.note}` : null,
    "",
    "Leveringsadresse:",
    leveringsadresse,
    "",
    "Vennligst bekreft pris og leveringstid.",
    "",
    "Med vennlig hilsen",
    bestiltAv,
    avsender.name,
    avsender.phone ? `Telefon: ${avsender.phone}` : null,
    avsender.email ? `E-post: ${avsender.email}` : null,
    avsender.orgNumber ? `Org.nr: ${avsender.orgNumber}` : null,
  ]
    .filter((l) => l !== null)
    .join("\n");

  return {
    emne: `Bestilling ${nr} — ${avsender.name}`,
    tekst,
    til: bestilling.supplier.email,
  };
}

/** Sant når systemet er satt opp til å sende e-post selv. */
export function harSmtp(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_FROM);
}

export type Sendt =
  | { ok: true; metode: "smtp" }
  | { ok: false; feil: string };

/**
 * Sender e-posten gjennom SMTP-serveren som er satt opp i miljøvariablene.
 * Kalles bare når harSmtp() er sann.
 */
export async function sendEpost(opts: {
  til: string;
  emne: string;
  tekst: string;
  svarTil?: string | null;
}): Promise<Sendt> {
  const port = Number(process.env.SMTP_PORT ?? 587);

  try {
    const transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      // 465 er implisitt kryptert; øvrige porter starter i klartekst og
      // oppgraderer med STARTTLS
      secure: port === 465,
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
        : undefined,
    });

    await transport.sendMail({
      from: process.env.SMTP_FROM,
      to: opts.til,
      replyTo: opts.svarTil ?? undefined,
      subject: opts.emne,
      text: opts.tekst,
    });

    return { ok: true, metode: "smtp" };
  } catch (e) {
    return {
      ok: false,
      feil:
        e instanceof Error
          ? `E-posten kunne ikke sendes: ${e.message}`
          : "E-posten kunne ikke sendes.",
    };
  }
}

/** Lenke som åpner brukerens egen e-postklient med alt ferdig utfylt. */
export function mailtoLenke(til: string | null, emne: string, tekst: string): string {
  const adresse = til ?? "";
  return `mailto:${adresse}?subject=${encodeURIComponent(emne)}&body=${encodeURIComponent(tekst)}`;
}
