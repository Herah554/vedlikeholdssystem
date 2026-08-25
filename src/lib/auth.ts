import { cache } from "react";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { dbForOrg, type TenantDb } from "@/lib/tenant";
import {
  harFunksjon,
  lesUnntak,
  modulErKjopt,
  type Funksjon,
  type Unntak,
} from "@/lib/planer";
import type { Plan } from "@/generated/prisma/client";
import {
  kan,
  lesMatrise,
  STANDARD_MATRISE,
  type Matrise,
  type Modul,
  type Nivaa,
} from "@/lib/rettigheter";
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
  /** Bedriften økten ser på nå. For alle andre enn deg er dette din egen. */
  organizationId: string;
  organizationName: string;
  name: string;
  email: string;
  role: Role;
  /**
   * Plattformeier. Leses alltid fra databasen, aldri fra tokenet — ellers
   * ville en fjernet rettighet fortsatt gjelde i 30 dager.
   */
  superadmin?: boolean;
  /**
   * Satt bare når en plattformeier ser på en annen bedrift enn sin egen.
   * Da vet grensesnittet at det skal vise stripen på toppen, og hvor
   * veien hjem går.
   */
  hjemOrganisasjonId?: string;
  hjemOrganisasjonNavn?: string;
  /**
   * Hva rollen får se og gjøre i denne bedriften. Settes av gyldigSesjon()
   * ut fra organisasjonen, og legges med vilje ikke i tokenet: endrer
   * administratoren oppsettet, skal det gjelde ved neste sidevisning.
   */
  rettigheter?: Matrise;
  /**
   * Hva bedriften betaler for. Leses fra organisasjonen ved hver sidevisning,
   * ikke fra tokenet — sier du opp en funksjon, gjelder det med det samme.
   */
  plan?: Plan;
  unntak?: Unntak;
  /**
   * Når tokenet ble utstedt, i sekunder. Leses fra tokenet selv og brukes til
   * å kaste ut økter som er eldre enn siste passordbytte.
   */
  utstedt?: number;
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
  // Rettighetene hører hjemme i databasen, ikke i kapselen. Lagt inn her
  // ville de både blåst opp tokenet og blitt stående uendret i 30 dager.
  const {
    rettigheter: _,
    utstedt: __,
    plan: ___,
    unntak: ____,
    ...iToken
  } = session;

  return new SignJWT({ ...iToken })
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
      hjemOrganisasjonId: payload.hjemOrganisasjonId as string | undefined,
      hjemOrganisasjonNavn: payload.hjemOrganisasjonNavn as string | undefined,
      utstedt: payload.iat,
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
 *
 * cache() gjør at oppslaget skjer én gang per forespørsel, ikke én gang per
 * sted som spør. Både layouten og siden inni den kaller denne, og uten
 * cache() ble det to like spørringer for hver eneste sidevisning.
 */
export const gyldigSesjon = cache(async function gyldigSesjon(): Promise<Session | null> {
  const session = await getSession();
  if (!session) return null;

  const bruker = await prisma.user.findFirst({
    where: { id: session.userId, isActive: true },
    select: {
      id: true,
      organizationId: true,
      role: true,
      isSuperAdmin: true,
      sessionsValidFrom: true,
      organization: {
        select: {
          isActive: true,
          permissions: true,
          plan: true,
          features: true,
        },
      },
    },
  });

  if (!bruker) return null;

  // Passordet er byttet etter at denne innloggingen ble utstedt. Da skal den
  // ikke gjelde lenger — det er nettopp derfor man bytter passord.
  //
  // Sekundet rundes ned i tokenet, så vi gir ett sekund slingringsmonn.
  // Uten det ville den som nettopp satte nytt passord blitt kastet ut med
  // det samme, av sitt eget bytte.
  if (
    bruker.sessionsValidFrom &&
    session.utstedt !== undefined &&
    session.utstedt + 1 < Math.floor(bruker.sessionsValidFrom.getTime() / 1000)
  ) {
    return null;
  }

  // Det vanlige tilfellet: økten peker på brukerens egen bedrift.
  if (bruker.organizationId === session.organizationId) {
    if (!bruker.organization.isActive) return null;
    return {
      ...session,
      // Rollen hentes fra databasen, ikke fra tokenet. Degraderer en
      // administrator noen, skal det gjelde ved neste sidevisning — ikke
      // først når tokenet går ut om 30 dager.
      role: bruker.role,
      superadmin: bruker.isSuperAdmin,
      rettigheter: lesMatrise(bruker.organization.permissions),
      plan: bruker.organization.plan,
      unntak: lesUnntak(bruker.organization.features),
    };
  }

  // Økten peker på en annen bedrift enn brukeren tilhører. Det er bare
  // lovlig for en plattformeier. Merk at flagget hentes fra databasen —
  // står det i tokenet, betyr det ingenting her.
  if (!bruker.isSuperAdmin) return null;

  const besokt = await prisma.organization.findFirst({
    where: { id: session.organizationId, isActive: true },
    select: { id: true, permissions: true, plan: true, features: true },
  });
  if (!besokt) return null;

  // Rollen står som den er her. Plattformeieren fikk ADMIN da han åpnet
  // bedriften, og han har ingen rad i kundens brukertabell å lese den fra.
  return {
    ...session,
    superadmin: true,
    rettigheter: lesMatrise(besokt.permissions),
    plan: besokt.plan,
    unntak: lesUnntak(besokt.features),
  };
});

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
 * Sesjon for en plattformeier — deg som drifter systemet.
 *
 * Svarer «finnes ikke» i stedet for «ingen tilgang». En vanlig kunde skal
 * ikke engang få vite at plattformsiden er der.
 */
export async function requireSuperadmin(): Promise<Session> {
  const session = await requireSession();
  if (!session.superadmin) notFound();
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

// ─── Rettigheter ──────────────────────────────────────────────

/** Sant hvis den innloggede når opp til nivået i modulen. */
export function kanSession(
  session: Session,
  modul: Modul,
  nivaa: Nivaa = "se",
): boolean {
  // Planen først. Har ikke bedriften kjøpt modulen, hjelper det ikke hvilken
  // rolle man har — og en administrator skal ikke kunne gi seg selv noe
  // firmaet ikke betaler for ved å endre rettighetene.
  if (!modulErKjopt(session.plan ?? "BASIS", session.unntak ?? {}, modul)) {
    return false;
  }

  return kan(session.role, session.rettigheter ?? STANDARD_MATRISE, modul, nivaa);
}

/**
 * Kaster hvis den innloggede mangler rettigheten. Brukes i server-handlinger.
 *
 * Sperren må stå her og ikke bare i grensesnittet. En skjult knapp hindrer
 * ingen i å sende forespørselen rett til serveren.
 */
export function krev(session: Session, modul: Modul, nivaa: Nivaa): void {
  if (!kanSession(session, modul, nivaa)) {
    const hva =
      nivaa === "se"
        ? "se"
        : nivaa === "endre"
          ? "endre noe i"
          : "administrere";
    throw new Error(
      `Du har ikke tilgang til å ${hva} denne delen av systemet. Spør en administrator i firmaet ditt.`,
    );
  }
}

const ROLE_RANK: Record<Role, number> = {
  GJEST: 0,
  TEKNIKER: 1,
  DELELAGER: 1,
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
    include: {
      organization: { select: { id: true, name: true, isActive: true } },
    },
  });

  if (!user) {
    // Kjør en hashing likevel, slik at svartiden ikke røper om
    // e-postadressen finnes.
    await bcrypt.compare(password, "$2a$12$" + "x".repeat(53));
    return { ok: false, error: feilmelding };
  }

  const riktig = await verifyPassword(password, user.passwordHash);
  if (!riktig) return { ok: false, error: feilmelding };

  // Passordet stemte, men bedriften er stengt. Egen melding her, for nå
  // hjelper det ingen å skjule at kontoen finnes.
  if (!user.organization.isActive) {
    return {
      ok: false,
      error:
        "Denne bedriften er deaktivert. Ta kontakt med den som drifter systemet.",
    };
  }

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
      superadmin: user.isSuperAdmin,
    },
  };
}

/**
 * Sesjon og databaseklient, men bare hvis rollen har lov til å åpne modulen.
 *
 * Denne må stå på hver eneste side i en modul. Å utelate lenken fra menyen
 * hindrer ingen i å skrive adressen selv, og en side som laster likevel er
 * en lekkasje uansett hvor godt den er gjemt.
 *
 * Svarer «finnes ikke» framfor «ingen tilgang». Ellers kan hvem som helst
 * kartlegge hvilke deler firmaet bruker ved å prøve seg fram på adresser.
 */
export async function requireModul(
  modul: Modul,
  nivaa: Nivaa = "se",
): Promise<{ session: Session; db: TenantDb }> {
  const { session, db } = await requireTenant();
  if (!kanSession(session, modul, nivaa)) notFound();
  return { session, db };
}

/**
 * Sant hvis bedriften betaler for funksjonen.
 *
 * Brukes for det som ikke er en egen modul med egne rettigheter — import,
 * vedlegg og deling av dashbord. Modulene går gjennom kanSession(), som
 * sjekker planen selv.
 */
export function harFunksjonSession(
  session: Session,
  funksjon: Funksjon,
): boolean {
  return harFunksjon(session.plan ?? "BASIS", session.unntak ?? {}, funksjon);
}

/**
 * Som over, men avviser med «finnes ikke».
 *
 * En kunde som ikke har kjøpt noe skal ikke få vite hva de går glipp av ved
 * å prøve adresser — det er en salgssamtale, ikke en feilmelding.
 */
export function krevFunksjon(session: Session, funksjon: Funksjon): void {
  if (!harFunksjonSession(session, funksjon)) notFound();
}
