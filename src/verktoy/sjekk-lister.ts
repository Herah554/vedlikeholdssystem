import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { dbForOrg } from "@/lib/tenant";
import { etikettFor, etikettOppslag, hentListe } from "@/lib/lister";
import { ordreType } from "@/lib/domene";
import { opprettBedrift } from "@/lib/bedrift";

/**
 * Kontrollerer at arbeidsordretypen tåler å være en liste firmaet styrer.
 *
 * Faren ved å bytte fra enum til kode er stille krasj: et oppslag som før
 * alltid traff, gir nå undefined for en type firmaet har funnet på selv, og
 * siden faller sammen. Derfor prøves nettopp en egendefinert type her.
 *
 * Kjør med: npm run sjekk:lister
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
  // ── Reserveetiketten skal aldri kunne slå feil ────────────
  sjekk("Kjent kode gir navnet", ordreType("KORREKTIV").tekst, "Korrektiv");
  sjekk("Ukjent kode gir koden", ordreType("GARANTI").tekst, "GARANTI");
  sjekk("Ukjent kode har en klasse", ordreType("GARANTI").klasse.length > 0, true);
  sjekk("Tom kode krasjer ikke", ordreType("").tekst, "");

  // ── En ny bedrift skal ha typene med én gang ──────────────
  const { org } = await opprettBedrift({
    firma: `Listetest ${Date.now()}`,
    navn: "Test Testesen",
    email: `test-${Date.now()}@listetest.no`,
    password: "et-langt-nok-passord",
  });

  const db = dbForOrg(org.id);

  try {
    const typer = await hentListe(db, "ordretype");
    sjekk("Ny bedrift får fire typer", typer.length, 4);
    sjekk(
      "Korrektiv og forebyggende er innebygde",
      typer.filter((t) => t.isBuiltIn).map((t) => t.code).sort(),
      ["FOREBYGGENDE", "KORREKTIV"],
    );
    sjekk(
      "Inspeksjon kan fjernes",
      typer.find((t) => t.code === "INSPEKSJON")?.isBuiltIn,
      false,
    );

    // ── Firmaet legger til sin egen type ────────────────────
    await db.listValue.create({
      data: {
        organizationId: org.id,
        list: "ordretype",
        code: "GARANTI",
        name: "Garantiarbeid",
        description: "Dekkes av leverandøren",
        tone: "amber",
        sortOrder: 4,
      },
    });

    const etter = await hentListe(db, "ordretype");
    sjekk("Den egne typen kom med", etter.length, 5);

    const oppslag = etikettOppslag(etter);
    sjekk("Egen type får sitt eget navn", oppslag("GARANTI").tekst, "Garantiarbeid");
    sjekk(
      "Egen type får sin egen farge",
      oppslag("GARANTI").klasse.includes("amber"),
      true,
    );

    // ── En arbeidsordre med den egne typen ──────────────────
    const bruker = await db.user.findFirstOrThrow({ select: { id: true } });
    const ordre = await db.workOrder.create({
      data: {
        organizationId: org.id,
        number: 1,
        title: "Bytte styreenhet under garanti",
        type: "GARANTI",
        requestedById: bruker.id,
      },
    });

    const lest = await db.workOrder.findFirstOrThrow({
      where: { id: ordre.id },
      select: { type: true },
    });
    sjekk("Typen lagres som koden", lest.type, "GARANTI");
    sjekk(
      "Reserveetiketten takler den også",
      ordreType(lest.type).tekst,
      "GARANTI",
    );

    // ── Tas typen ut av lista, skal ordren fortsatt vise noe ─
    await db.listValue.updateMany({
      where: { list: "ordretype", code: "GARANTI" },
      data: { isActive: false },
    });

    const aktive = await hentListe(db, "ordretype", true);
    sjekk("Utgåtte typer er borte fra valglista", aktive.length, 4);

    const alle = await hentListe(db, "ordretype");
    sjekk(
      "Men navnet vises fortsatt på gamle ordre",
      etikettFor("GARANTI", alle).tekst,
      "Garantiarbeid",
    );

    // ── Isolering ───────────────────────────────────────────
    const rader = await db.listValue.findMany({ select: { organizationId: true } });
    sjekk(
      "Ingen listeverdier fra andre bedrifter",
      rader.filter((r) => r.organizationId !== org.id).length,
      0,
    );
  } finally {
    await prisma.purchaseOrder.deleteMany({ where: { organizationId: org.id } });
    await prisma.organization.delete({ where: { id: org.id } });
  }

  console.log(feil === 0 ? "\nAlt stemmer." : `\n${feil} sjekk(er) feilet.`);
  process.exit(feil === 0 ? 0 : 1);
}

main();
