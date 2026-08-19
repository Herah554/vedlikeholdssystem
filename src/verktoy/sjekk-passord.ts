import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { authenticate, verifyPassword } from "@/lib/auth";
import {
  bestillNyttPassord,
  settNyttPassord,
  sjekkToken,
} from "@/lib/passord";

/**
 * Kontrollerer flyten for glemt passord.
 *
 * Dette er den delen av systemet som er lettest å bygge nesten riktig. En
 * lenke som virker to ganger, eller som fortsatt virker etter at passordet
 * er byttet, er en åpen dør. Derfor prøves nettopp de tilfellene her.
 *
 * Kjør med: npm run sjekk:passord
 */

let feil = 0;

function sjekk(hva: string, faktisk: unknown, forventet: unknown) {
  const ok = JSON.stringify(faktisk) === JSON.stringify(forventet);
  if (!ok) feil += 1;
  console.log(`${ok ? "✓" : "✗"} ${hva}`);
  if (!ok) {
    console.log(
      `    forventet ${JSON.stringify(forventet)}, fikk ${JSON.stringify(faktisk)}`,
    );
  }
}

async function main() {
  const bruker = await prisma.user.findFirst({
    where: { email: "morten@nordvik.no" },
    select: { id: true, email: true, passwordHash: true },
  });
  if (!bruker) throw new Error("Kjør «npm run db:seed» først.");

  const opprinnelig = bruker.passwordHash;

  try {
    // ── Ukjent adresse skal ikke røpe noe ──────────────────────
    const ukjent = await bestillNyttPassord("finnes-ikke@ingensteds.no");
    sjekk("Ukjent e-post gir ingen lenke", ukjent.sendt, false);

    // ── Vanlig bestilling ─────────────────────────────────────
    const svar = await bestillNyttPassord(bruker.email);
    if (!svar.sendt) throw new Error("Fikk ingen lenke for en konto som finnes");
    sjekk("Kjent e-post gir en lenke", svar.sendt, true);

    // Tokenet skal ikke ligge i klartekst i databasen
    const iBasen = await prisma.passwordReset.findFirst({
      where: { userId: bruker.id },
      orderBy: { createdAt: "desc" },
      select: { tokenHash: true },
    });
    sjekk(
      "Tokenet lagres hashet, ikke i klartekst",
      iBasen?.tokenHash === svar.token,
      false,
    );

    // ── Tull-token avvises ────────────────────────────────────
    const tull = await sjekkToken("dette-er-ikke-et-token");
    sjekk("Oppdiktet token avvises", tull.gyldig, false);

    // ── For kort passord ──────────────────────────────────────
    const kort = await settNyttPassord(svar.token, "kort");
    sjekk("For kort passord avvises", kort.ok, false);
    sjekk(
      "Lenka er fortsatt gyldig etter et avvist forsøk",
      (await sjekkToken(svar.token)).gyldig,
      true,
    );

    // ── Passordet settes ──────────────────────────────────────
    const nyttPassord = "helt-nytt-passord-123";
    const satt = await settNyttPassord(svar.token, nyttPassord);
    sjekk("Nytt passord settes", satt.ok, true);

    const etterpå = await prisma.user.findUniqueOrThrow({
      where: { id: bruker.id },
      select: { passwordHash: true, sessionsValidFrom: true },
    });
    sjekk(
      "Det nye passordet virker",
      await verifyPassword(nyttPassord, etterpå.passwordHash),
      true,
    );
    sjekk(
      "Innlogging med det nye passordet går gjennom",
      (await authenticate(bruker.email, nyttPassord)).ok,
      true,
    );
    sjekk(
      "Det gamle passordet virker ikke lenger",
      (await authenticate(bruker.email, "passord123")).ok,
      false,
    );
    sjekk(
      "Gamle innlogginger merkes som ugyldige",
      etterpå.sessionsValidFrom !== null,
      true,
    );

    // ── Lenka kan ikke brukes om igjen ────────────────────────
    const igjen = await settNyttPassord(svar.token, "enda-et-passord-456");
    sjekk("Samme lenke kan ikke brukes to ganger", igjen.ok, false);
    sjekk(
      "Passordet står urørt etter det andre forsøket",
      await verifyPassword(
        nyttPassord,
        (
          await prisma.user.findUniqueOrThrow({
            where: { id: bruker.id },
            select: { passwordHash: true },
          })
        ).passwordHash,
      ),
      true,
    );
  } finally {
    // Sett testbrukeren tilbake slik README-en beskriver
    await prisma.user.update({
      where: { id: bruker.id },
      data: { passwordHash: opprinnelig, sessionsValidFrom: null },
    });
    await prisma.passwordReset.deleteMany({ where: { userId: bruker.id } });
  }

  console.log(feil === 0 ? "\nAlt stemmer." : `\n${feil} sjekk(er) feilet.`);
  process.exit(feil === 0 ? 0 : 1);
}

main();
