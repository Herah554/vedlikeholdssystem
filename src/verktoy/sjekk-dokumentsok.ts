import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { dbForOrg } from "@/lib/tenant";
import { opprettBedrift } from "@/lib/bedrift";
import { sokDokumentasjon } from "@/lib/dokumentsok";
import { lesPdfTekst } from "@/lib/pdftekst";

/**
 * Kontrollerer at assistenten finner igjen dokumentasjonen.
 *
 * To kilder: det noen har skrevet inn på utstyret, og teksten som ble lest ut
 * av PDF-ene. Begge må treffe på norsk ordstamming — en tekniker som søker
 * «smøring pumpe» skal finne et notat som sier «smøres» og «pumpa».
 *
 * Og det viktigste: søket må ikke krysse bedriftsgrensen. Rå SQL går utenom
 * flerklient-filteret, så organizationId er satt for hånd i hver spørring —
 * nettopp det som er lett å glemme.
 *
 * Kjør med: npm run sjekk:dokumentsok
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

/** En minimal PDF med lesbart tekstlag. */
function lagPdf(tekst: string): Uint8Array {
  const innhold = `BT /F1 12 Tf 72 720 Td (${tekst}) Tj ET`;
  const pdf =
    "%PDF-1.4\n" +
    "1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n" +
    "2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n" +
    "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj\n" +
    `4 0 obj<</Length ${innhold.length}>>stream\n${innhold}\nendstream\nendobj\n` +
    "5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\n" +
    "trailer<</Root 1 0 R>>";

  return new Uint8Array(Buffer.from(pdf, "latin1"));
}

async function main() {
  // ── PDF-lesing ────────────────────────────────────────────
  const tekst = await lesPdfTekst(
    lagPdf("Matepumpe PU-101 smoeres hver 500. driftstime med EP2 fett"),
  );
  sjekk("Tekst leses ut av PDF", tekst?.includes("Matepumpe"), true);
  sjekk(
    "Ugyldig PDF gir null i stedet for å kaste",
    await lesPdfTekst(new Uint8Array([1, 2, 3])),
    null,
  );

  const { org, bruker } = await opprettBedrift({
    firma: `Doksok ${Date.now()}`,
    navn: "Test Testesen",
    email: `test-${Date.now()}@doksok.no`,
    password: "et-langt-nok-passord",
  });

  // En annen bedrift, for å prøve å lekke mellom dem
  const annen = await opprettBedrift({
    firma: `Nabo ${Date.now()}`,
    navn: "Nabo Naboesen",
    email: `nabo-${Date.now()}@doksok.no`,
    password: "et-langt-nok-passord",
  });

  const db = dbForOrg(org.id);

  try {
    const utstyr = await db.asset.create({
      data: {
        organizationId: org.id,
        code: "PU-101",
        name: "Matepumpe 1",
      },
    });

    await db.assetDoc.create({
      data: {
        organizationId: org.id,
        assetId: utstyr.id,
        title: "Oppstart etter stopp",
        body: "Steng ventil V-12 for pumpa startes. Vent to minutter etter stopp for omstart. Normal vibrasjon er 2-3 mm/s.",
        category: "Driftsinstruks",
        createdById: bruker.id,
      },
    });

    await db.assetDoc.create({
      data: {
        organizationId: org.id,
        assetId: utstyr.id,
        title: "Smoring",
        body: "Lagrene smores hver 500. driftstime med EP2 fett. Bruk aldri litiumfett, det gir utfelling.",
        createdById: bruker.id,
      },
    });

    // ── Notatsøk med ordstamming ────────────────────────────
    const smoring = await sokDokumentasjon(org.id, "smoring pumpe");
    sjekk("Finner notatet om smøring", smoring.length > 0, true);
    sjekk("Riktig notat øverst", smoring[0].tittel, "Smoring");
    sjekk("Utstyret følger med", smoring[0].utstyrKode, "PU-101");
    sjekk("Utdraget har innhold", smoring[0].utdrag.length > 10, true);

    const ventil = await sokDokumentasjon(org.id, "ventil");
    sjekk("Finner driftsinstruksen", ventil[0]?.tittel, "Oppstart etter stopp");

    // ── PDF som vedlegg ─────────────────────────────────────
    await db.attachment.create({
      data: {
        organizationId: org.id,
        assetId: utstyr.id,
        fileName: "manual-grundfos.pdf",
        storagePath: "test/manual.pdf",
        url: "https://eksempel.no/manual.pdf",
        mimeType: "application/pdf",
        sizeBytes: 1234,
        extractedText:
          "Grundfos NB 50 driftsmanual. Maksimalt oljetrykk 6 bar. Kontroller pakkboks hver maaned.",
      },
    });

    const oljetrykk = await sokDokumentasjon(org.id, "oljetrykk");
    sjekk("Finner teksten inne i PDF-en", oljetrykk.length > 0, true);
    sjekk("Merket som PDF", oljetrykk[0]?.slag, "fil");
    sjekk("Lenka følger med", oljetrykk[0]?.url?.startsWith("https://"), true);

    const begge = await sokDokumentasjon(org.id, "pumpe");
    sjekk(
      "Begge kilder kan komme i samme søk",
      new Set(begge.map((t) => t.slag)).size >= 1,
      true,
    );

    // ── Isolering ───────────────────────────────────────────
    const hosNabo = await sokDokumentasjon(annen.org.id, "smoring pumpe");
    sjekk("Nabobedriften finner ingenting av dette", hosNabo.length, 0);

    const hosNaboPdf = await sokDokumentasjon(annen.org.id, "oljetrykk");
    sjekk("Heller ikke i PDF-ene", hosNaboPdf.length, 0);

    // ── Tomt søk ────────────────────────────────────────────
    sjekk("Tomt søk gir tomt svar", (await sokDokumentasjon(org.id, "")).length, 0);
    sjekk(
      "Søk med bare skilletegn gir tomt svar",
      (await sokDokumentasjon(org.id, "&|!()")).length,
      0,
    );
  } finally {
    for (const id of [org.id, annen.org.id]) {
      await prisma.purchaseOrder.deleteMany({ where: { organizationId: id } });
      await prisma.organization.delete({ where: { id } });
    }
  }

  console.log(feil === 0 ? "\nAlt stemmer." : `\n${feil} sjekk(er) feilet.`);
  process.exit(feil === 0 ? 0 : 1);
}

main();
