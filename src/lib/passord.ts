import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";

/**
 * Engangslenker for å sette nytt passord.
 *
 * Oppslagene her går bevisst utenom flerklient-filteret. Den som har glemt
 * passordet sitt er ikke logget inn, og vi vet ikke hvilken bedrift hen
 * tilhører før tokenet er slått opp. Til gjengjeld er det ingenting å velge
 * mellom: tokenet peker på nøyaktig én bruker.
 */

/** En time. Lang nok til at man rekker å åpne e-posten, kort nok til å bety noe. */
const LEVETID_MINUTTER = 60;

/** Hvor mange lenker én konto kan be om i timen, før vi slutter å svare. */
const MAKS_PER_TIME = 5;

function hashAvToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export type Forespørsel =
  | { sendt: true; token: string; navn: string; epost: string }
  /** Vi sier aldri fra om adressen ikke finnes — se kommentaren under. */
  | { sendt: false };

/**
 * Lager en engangslenke for e-postadressen, hvis den finnes.
 *
 * Svaret skiller ikke mellom «adressen finnes ikke» og «alt gikk bra». Gjorde
 * det det, kunne hvem som helst bruke siden til å finne ut hvem som jobber i
 * hvilken bedrift. Den som ikke får e-post, får det heller ikke vite her.
 */
export async function bestillNyttPassord(epost: string): Promise<Forespørsel> {
  const bruker = await prisma.user.findFirst({
    where: { email: epost.trim().toLowerCase(), isActive: true },
    select: {
      id: true,
      name: true,
      email: true,
      organization: { select: { isActive: true } },
    },
  });

  if (!bruker || !bruker.organization.isActive) return { sendt: false };

  // En enkel sperre mot å bruke siden til å oversvømme noens innboks.
  const enTimeSiden = new Date(Date.now() - 60 * 60 * 1000);
  const nylige = await prisma.passwordReset.count({
    where: { userId: bruker.id, createdAt: { gt: enTimeSiden } },
  });
  if (nylige >= MAKS_PER_TIME) return { sendt: false };

  const token = randomBytes(32).toString("base64url");

  await prisma.passwordReset.create({
    data: {
      userId: bruker.id,
      tokenHash: hashAvToken(token),
      expiresAt: new Date(Date.now() + LEVETID_MINUTTER * 60 * 1000),
    },
  });

  return { sendt: true, token, navn: bruker.name, epost: bruker.email };
}

export type Sjekk =
  | { gyldig: true; brukerId: string; navn: string }
  | { gyldig: false; grunn: "ukjent" | "brukt" | "utlopt" };

/** Slår opp tokenet uten å sette noe passord. Brukes til å tegne skjemaet. */
export async function sjekkToken(token: string): Promise<Sjekk> {
  if (!token) return { gyldig: false, grunn: "ukjent" };

  const rad = await prisma.passwordReset.findUnique({
    where: { tokenHash: hashAvToken(token) },
    select: {
      id: true,
      usedAt: true,
      expiresAt: true,
      user: { select: { id: true, name: true, isActive: true } },
    },
  });

  if (!rad || !rad.user.isActive) return { gyldig: false, grunn: "ukjent" };
  if (rad.usedAt) return { gyldig: false, grunn: "brukt" };
  if (rad.expiresAt < new Date()) return { gyldig: false, grunn: "utlopt" };

  return { gyldig: true, brukerId: rad.user.id, navn: rad.user.name };
}

/**
 * Setter nytt passord og forbruker tokenet.
 *
 * Alt skjer i én transaksjon, og tokenet merkes som brukt i samme slengen.
 * To forespørsler med samme lenke skal ikke kunne sette to forskjellige
 * passord fordi de kom samtidig.
 *
 * Alle gamle innlogginger kastes ut. Har noen kommet seg inn på kontoen, er
 * det hele poenget med å bytte passord at de mister tilgangen — ikke at de
 * beholder den i tretti dager til.
 */
export async function settNyttPassord(
  token: string,
  passord: string,
): Promise<{ ok: boolean; feil?: string }> {
  if (passord.length < 8) {
    return { ok: false, feil: "Passordet må ha minst åtte tegn." };
  }

  const sjekk = await sjekkToken(token);
  if (!sjekk.gyldig) {
    return {
      ok: false,
      feil:
        sjekk.grunn === "utlopt"
          ? "Lenken er for gammel. Be om en ny."
          : sjekk.grunn === "brukt"
            ? "Lenken er allerede brukt. Be om en ny."
            : "Lenken er ikke gyldig.",
    };
  }

  const hash = await hashPassword(passord);

  await prisma.$transaction([
    prisma.passwordReset.updateMany({
      where: { tokenHash: hashAvToken(token), usedAt: null },
      data: { usedAt: new Date() },
    }),
    prisma.user.update({
      where: { id: sjekk.brukerId },
      data: { passwordHash: hash, sessionsValidFrom: new Date() },
    }),
    // Andre ubrukte lenker for samme konto skal ikke bli liggende
    prisma.passwordReset.updateMany({
      where: { userId: sjekk.brukerId, usedAt: null },
      data: { usedAt: new Date() },
    }),
  ]);

  return { ok: true };
}

/** Sammenlikning som tar like lang tid uansett hvor verdiene skiller seg. */
export function likeVerdier(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  if (x.length !== y.length) return false;
  return timingSafeEqual(x, y);
}

/**
 * Lager en engangslenke for en bruker administratoren har pekt ut.
 *
 * Alternativet, som er det systemet hadde før, er at administratoren skriver
 * inn et passord og forteller det videre. Da kjenner administratoren
 * passordet til en kollega og kan logge inn som hen — og i loggen ser det ut
 * som om vedkommende gjorde det selv. Med en lenke setter brukeren sitt eget
 * passord, og ingen andre får vite det.
 *
 * Dette er også den eneste veien inn så lenge serveren ikke sender e-post.
 * Og selv med e-post på plass er den verdt å ha: mange teknikere deler en
 * terminal i verkstedet og har ingen jobbadresse å få lenka på.
 *
 * Kalleren har allerede kontrollert at den innloggede er administrator i
 * samme bedrift. Denne funksjonen slår opp brukeren uten flerklient-filteret,
 * på samme måte som resten av fila, og krever derfor at kontrollen er gjort.
 */
export async function lagLenkeForBruker(
  brukerId: string,
): Promise<{ ok: true; token: string; navn: string } | { ok: false; feil: string }> {
  const bruker = await prisma.user.findFirst({
    where: { id: brukerId, isActive: true },
    select: { id: true, name: true },
  });

  if (!bruker) return { ok: false, feil: "Fant ikke brukeren." };

  // Samme sperre som den offentlige veien. En administrator har ingen grunn
  // til å lage fem lenker i timen, og skjer det, er det verdt å stoppe.
  const enTimeSiden = new Date(Date.now() - 60 * 60 * 1000);
  const nylige = await prisma.passwordReset.count({
    where: { userId: bruker.id, createdAt: { gt: enTimeSiden } },
  });
  if (nylige >= MAKS_PER_TIME) {
    return {
      ok: false,
      feil: `Det er laget ${MAKS_PER_TIME} lenker for denne brukeren den siste timen. Vent litt.`,
    };
  }

  const token = randomBytes(32).toString("base64url");

  await prisma.passwordReset.create({
    data: {
      userId: bruker.id,
      tokenHash: hashAvToken(token),
      expiresAt: new Date(Date.now() + LEVETID_MINUTTER * 60 * 1000),
    },
  });

  return { ok: true, token, navn: bruker.name };
}
