import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { dbForOrg, type TenantDb } from "@/lib/tenant";
import type { Role } from "@/generated/prisma/client";

const COOKIE_NAME = "vedlikehold_sesjon";
const SESSION_DAYS = 30;

/**
 * Verdier som har ligget i eksempelfiler og dokumentasjon.
 *
 * Havner en av dem i produksjon, kan hvem som helst som har lest koden lage
 * gyldige innloggingstokens for hvilken som helst bruker. Derfor nekter
 * systemet å starte i det hele tatt i stedet for å advare i en logg ingen leser.
 */
const KJENTE_PLASSHOLDERE = [
  "dev-only-secret",
  "generer-med-openssl",
  "minst-32-tegn-langt-tilfeldig-passord",
  "endre-meg",
  "change-me",
];

function secretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error(
      "AUTH_SECRET mangler eller er kortere enn 32 tegn. Sett den i .env — " +
        "uten den kan ikke innloggingstokens signeres trygt.\n" +
        "Generer en med: openssl rand -base64 32",
    );
  }

  if (process.env.NODE_ENV === "production") {
    const lav = secret.toLowerCase();

    if (KJENTE_PLASSHOLDERE.some((p) => lav.includes(p))) {
      throw new Error(
        "AUTH_SECRET er fortsatt eksempelverdien fra .env.example. Den står " +
          "i koden og kan leses av alle. Sett en ekte nøkkel før systemet " +
          "settes i drift:\n  openssl rand -base64 32",
      );
    }

    // En nøkkel som «aaaaaaaa…» er 32 tegn lang, men har ingen entropi
    if (new Set(secret).size < 12) {
      throw new Error(
        "AUTH_SECRET har for få forskjellige tegn til å være tilfeldig. " +
          "Generer en ekte nøkkel: openssl rand -base64 32",
      );
    }
  }

  return new TextEncoder().encode(secret);
}

export type Session = {
  userId: string;
  organizationId: string;
  organizationName: string;
  name: string;
  email: string;
  role: Role;
};

// ─── Passord ──────────────────────────────────────────────────

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

// ─── Sesjonstoken ─────────────────────────────────────────────

async function signSession(session: Session): Promise<string> {
  return new SignJWT({ ...session })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(session.userId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secretKey());
}

/** Skriver innloggingsinformasjonen til en httpOnly-informasjonskapsel. */
export async function startSession(session: Session): Promise<void> {
  const token = await signSession(session);
  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true, // gjør den uleselig for JavaScript i nettleseren
    sameSite: "lax", // beskytter mot forespørsler fra andre nettsteder
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export async function endSession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

/** Leser sesjonen, eller null hvis brukeren ikke er logget inn. */
export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, secretKey());
    return {
      userId: payload.userId as string,
      organizationId: payload.organizationId as string,
      organizationName: payload.organizationName as string,
      name: payload.name as string,
      email: payload.email as string,
      role: payload.role as Role,
    };
  } catch {
    // Utløpt eller manipulert token — behandles som utlogget.
    return null;
  }
}

/**
 * Sesjonen, men bare hvis kontoen fortsatt finnes og er aktiv.
 *
 * Tokenet alene er ikke nok. Det er signert og gyldig i 30 dager, så uten en
 * kontroll mot databasen ville en bruker som blir deaktivert — eller hvis
 * organisasjon blir slettet — fortsatt komme inn helt til tokenet gikk ut.
 * Det koster ett oppslag per sidevisning, og er verdt det.
 *
 * Både beskyttede sider og innloggingssiden må bruke denne. Bruker den ene
 * bare tokenet, ender de opp med å sende brukeren fram og tilbake mellom seg.
 */
export async function gyldigSesjon(): Promise<Session | null> {
  const session = await getSession();
  if (!session) return null;

  const bruker = await prisma.user.findFirst({
    where: {
      id: session.userId,
      organizationId: session.organizationId,
      isActive: true,
    },
    select: { id: true },
  });

  return bruker ? session : null;
}

/** Sesjon eller omdirigering til innlogging. Brukes i alle beskyttede sider. */
export async function requireSession(): Promise<Session> {
  const session = await gyldigSesjon();

  if (!session) {
    // Kapselen kan ikke slettes herfra — det er bare server-handlinger og
    // rutebehandlere som får endre informasjonskapsler. Det gjør ingenting:
    // den gir ikke tilgang lenger, og overskrives ved neste innlogging.
    redirect("/logg-inn?utlopt=1");
  }

  return session;
}

/**
 * Sesjon pluss en databaseklient som er låst til brukerens organisasjon.
 * Dette er inngangsporten all datatilgang i appen skal gå gjennom.
 */
export async function requireTenant(): Promise<{
  session: Session;
  db: TenantDb;
}> {
  const session = await requireSession();
  return { session, db: dbForOrg(session.organizationId) };
}

const ROLE_RANK: Record<Role, number> = {
  GJEST: 0,
  TEKNIKER: 1,
  PLANLEGGER: 2,
  LEDER: 3,
  ADMIN: 4,
};

/** Sant hvis rollen er på minst det angitte nivået. */
export function hasRole(role: Role, minimum: Role): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[minimum];
}

/** Kaster hvis brukeren mangler nødvendig rolle. Brukes i server-handlinger. */
export function assertRole(role: Role, minimum: Role): void {
  if (!hasRole(role, minimum)) {
    throw new Error(
      `Du har ikke tilgang til dette. Krever rollen ${minimum} eller høyere.`,
    );
  }
}

// ─── Innlogging ───────────────────────────────────────────────

export type LoginResult =
  | { ok: true; session: Session }
  | { ok: false; error: string };

/**
 * Sjekker e-post og passord mot databasen.
 *
 * Feilmeldingen er bevisst den samme enten e-posten ikke finnes eller
 * passordet er feil, slik at ingen kan bruke innloggingssiden til å
 * kartlegge hvilke e-postadresser som er registrert.
 */
export async function authenticate(
  email: string,
  password: string,
): Promise<LoginResult> {
  const feilmelding = "Feil e-post eller passord.";

  const user = await prisma.user.findFirst({
    where: { email: email.trim().toLowerCase(), isActive: true },
    include: { organization: { select: { id: true, name: true } } },
  });

  if (!user) {
    // Kjør en hashing likevel, slik at svartiden ikke røper om
    // e-postadressen finnes.
    await bcrypt.compare(password, "$2a$12$" + "x".repeat(53));
    return { ok: false, error: feilmelding };
  }

  const riktig = await verifyPassword(password, user.passwordHash);
  if (!riktig) return { ok: false, error: feilmelding };

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  return {
    ok: true,
    session: {
      userId: user.id,
      organizationId: user.organizationId,
      organizationName: user.organization.name,
      name: user.name,
      email: user.email,
      role: user.role,
    },
  };
}
