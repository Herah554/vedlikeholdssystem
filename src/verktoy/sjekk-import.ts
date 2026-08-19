import "dotenv/config";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { dbForOrg } from "@/lib/tenant";
import { lesTabell } from "@/lib/import/les";
import { felterFor, gjettKobling, tilTall } from "@/lib/import/felter";
import { importerDeler, importerUtstyr } from "@/lib/import/utfor";

/**
 * Kontrollerer importen mot data som ligner det kundene faktisk har.
 *
 * Norsk Excel skriver CSV med semikolon, i den gamle Windows-tegnkodingen,
 * med komma som desimalskille og hardt mellomrom som tusenskille. Et
 * regneark der alt dette er pent er unntaket, ikke regelen.
 *
 * Kjør med: npm run sjekk:import
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

/** Koder om til Windows-1252, slik norsk Excel gjør. */
function somWindows1252(tekst: string): Uint8Array {
  const ut = new Uint8Array(tekst.length);
  for (let i = 0; i < tekst.length; i += 1) ut[i] = tekst.charCodeAt(i) & 0xff;
  return ut;
}

async function main() {
  // ── Tallformater ──────────────────────────────────────────
  sjekk("«1 234,50» leses som tall", tilTall("1 234,50"), 1234.5);
  sjekk("«kr 690,-» gir tallet", tilTall("kr 690,"), 690);
  sjekk("Tomt felt gir null", tilTall(""), null);
  sjekk("Tekst gir null", tilTall("fire stykker"), null);

  // ── CSV med semikolon og norske tegn ──────────────────────
  const csv = [
    "Utstyrs-nr;Benevnelse;Nivå;Ligger under;Plassering;Kritikalitet",
    "ANL-1;Produksjonsanlegg Sør;Anlegg;;Bergen;5",
    "SYS-1;Pumpesystem;System;ANL-1;Hall A;4",
    "PU-101;Matepumpe størrelse 2;Utstyr;SYS-1;Hall A;5",
    'PU-102;"Matepumpe, reserve";Utstyr;SYS-1;Hall A;3',
    ";Rad uten kode;Utstyr;SYS-1;;",
    "PU-101;Duplikat av samme kode;Utstyr;SYS-1;;",
    "PU-103;Peker på noe som ikke finnes;Utstyr;FINNES-IKKE;;",
  ].join("\r\n");

  const tabell = await lesTabell("utstyr.csv", somWindows1252(csv));

  sjekk("Semikolon gjenkjennes som skilletegn", tabell.kolonner.length, 6);
  sjekk("Norske tegn overlever tegnkodingen", tabell.kolonner[2], "Nivå");
  sjekk("Anførselstegn skjuler komma i feltet", tabell.rader[3][1], "Matepumpe, reserve");
  sjekk("Æøå i innholdet er intakt", tabell.rader[0][1], "Produksjonsanlegg Sør");

  const kobling = gjettKobling(tabell.kolonner, felterFor("utstyr"));
  sjekk("«Utstyrs-nr» gjenkjennes som kode", kobling.code, 0);
  sjekk("«Benevnelse» gjenkjennes som navn", kobling.name, 1);
  sjekk("«Ligger under» gjenkjennes som forelder", kobling.parentCode, 3);

  // ── Import mot en egen testbedrift ────────────────────────
  const org = await prisma.organization.create({
    data: { slug: `import-test-${Date.now()}`, name: "Importtest AS" },
  });
  const db = dbForOrg(org.id);

  try {
    const svar = await importerUtstyr(db, org.id, tabell, kobling);

    // PU-103 opprettes selv om forelderen ikke finnes. Utstyret er ekte nok;
    // det er bare plasseringen i treet som mangler, og den kan rettes etterpå.
    // Å kaste bort raden ville vært å miste data for en skrivefeil.
    sjekk("Fem rader med kode og navn opprettes", svar.opprettet, 5);
    sjekk("Tre problemer meldes fra om", svar.feil.length, 3);

    const meldinger = svar.feil.map((f) => f.melding).join(" | ");
    sjekk("Rad uten kode meldes", meldinger.includes("Mangler kode"), true);
    sjekk("Duplikat meldes", meldinger.includes("flere ganger"), true);
    sjekk("Ukjent forelder meldes", meldinger.includes("FINNES-IKKE"), true);

    const pumpe = await db.asset.findFirstOrThrow({
      where: { code: "PU-101" },
      include: { parent: { select: { code: true } } },
    });
    sjekk("Hierarkiet kobles", pumpe.parent?.code, "SYS-1");
    sjekk("Dybden regnes ut", pumpe.depth, 2);
    sjekk("Stien har tre ledd", pumpe.path.split("/").filter(Boolean).length, 3);
    sjekk("Kritikalitet leses", pumpe.criticality, 5);

    // ── Samme fil på nytt skal oppdatere, ikke doble ────────
    const igjen = await importerUtstyr(db, org.id, tabell, kobling);
    sjekk("Ny kjøring oppretter ingenting", igjen.opprettet, 0);
    sjekk("Ny kjøring oppdaterer de fem", igjen.oppdatert, 5);
    sjekk("Antallet står stille", await db.asset.count(), 5);

    // ── Deler, med leverandør som ikke finnes ───────────────
    const deler = [
      "Varenr\tBeskrivelse\tAntall\tMin\tPris\tLeverandør",
      "LAG-6205\tKulelager 6205\t12\t8\t189,50\tSKF Norge",
      "REM-A72\tKilerem A72\t3\t6\t1 245,00\tSKF Norge",
      "FIL-01\tOljefilter\t0\t4\t690\tAtlas Copco",
    ].join("\n");

    const delTabell = await lesTabell("deler.csv", new TextEncoder().encode(deler));
    const delKobling = gjettKobling(delTabell.kolonner, felterFor("deler"));
    sjekk("Tabulator gjenkjennes som skilletegn", delTabell.kolonner.length, 6);

    const delSvar = await importerDeler(db, org.id, delTabell, delKobling);
    sjekk("Tre deler opprettes", delSvar.opprettet, 3);
    sjekk("To leverandører opprettes", await db.supplier.count(), 2);

    const rem = await db.part.findFirstOrThrow({ where: { number: "REM-A72" } });
    sjekk("Tusenskille og komma leses riktig", Number(rem.unitCost), 1245);
    sjekk("Beholdning under minimum bevares", Number(rem.quantityOnHand), 3);
    // ── Ekte .xlsx, ikke bare CSV ────────────────────────────
    const bok = new ExcelJS.Workbook();
    const ark = bok.addWorksheet("Utstyr");
    ark.addRow(["Kode", "Navn", "Kritikalitet"]);
    ark.addRow(["XL-1", "Enhet fra regneark æøå", 4]);
    ark.addRow(["XL-2", "Med formel", { formula: "2+2", result: 3 }]);
    const buffer = await bok.xlsx.writeBuffer();

    const xl = await lesTabell("utstyr.xlsx", new Uint8Array(buffer));
    sjekk("Excel-fil leses", xl.rader.length, 2);
    sjekk("Norske tegn i Excel overlever", xl.rader[0][1], "Enhet fra regneark æøå");
    sjekk("Formel gir svaret, ikke regnestykket", xl.rader[1][2], "3");

    const xlSvar = await importerUtstyr(
      db,
      org.id,
      xl,
      gjettKobling(xl.kolonner, felterFor("utstyr")),
    );
    sjekk("Excel-rader importeres", xlSvar.opprettet, 2);
  } finally {
    await prisma.organization.delete({ where: { id: org.id } });
  }

  console.log(feil === 0 ? "\nAlt stemmer." : `\n${feil} sjekk(er) feilet.`);
  process.exit(feil === 0 ? 0 : 1);
}

main();
