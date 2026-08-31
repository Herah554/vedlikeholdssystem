import ExcelJS from "exceljs";
import { kanSession, requireTenant } from "@/lib/auth";
import { hentMaling, maalingTillater } from "@/lib/medarbeiderdata";
import { andel, leggTilTrend } from "@/lib/medarbeidere";

/**
 * Medarbeidertallene som regneark.
 *
 * En leder som forbereder en medarbeidersamtale vil ha tallene i et dokument,
 * ikke i en nettleserfane.
 *
 * Sperrene gjentas her og arves ikke fra sida. En nedlastingsadresse kan
 * skrives inn direkte, og et regneark med tall om navngitte kolleger er
 * nettopp det som ikke skal kunne hentes ved å gjette en adresse.
 */
export async function GET(request: Request): Promise<Response> {
  const { db, session } = await requireTenant();

  if (!kanSession(session, "rapporter", "se")) {
    return new Response("Ikke funnet", { status: 404 });
  }
  if (!kanSession(session, "arbeidsordre", "administrere")) {
    return new Response("Ikke funnet", { status: 404 });
  }

  const org = await db.organization.findUniqueOrThrow({
    where: { id: session.organizationId },
    select: { personMaling: true, name: true },
  });
  if (!maalingTillater(org.personMaling).andres) {
    return new Response("Ikke funnet", { status: 404 });
  }

  const url = new URL(request.url);
  const bedt = Number(url.searchParams.get("dager"));
  const dager = [30, 90, 365].includes(bedt) ? bedt : 90;

  const naa = new Date();
  const fra = new Date(naa.getTime() - dager * 86400_000);
  const forrigeFra = new Date(fra.getTime() - dager * 86400_000);

  const [denne, forrige] = await Promise.all([
    hentMaling(db, fra, naa),
    hentMaling(db, forrigeFra, fra),
  ]);

  const rader = leggTilTrend(denne, forrige).filter(
    (m) => m.utfort > 0 || m.timer > 0,
  );

  const bok = new ExcelJS.Workbook();
  bok.creator = org.name;
  bok.created = naa;

  const ark = bok.addWorksheet(`Medarbeidere ${dager} dager`);

  ark.columns = [
    { header: "Navn", key: "navn", width: 24 },
    { header: "Fullført", key: "utfort", width: 10 },
    { header: "Forrige periode", key: "forrige", width: 16 },
    { header: "Tunge", key: "tunge", width: 8 },
    { header: "Timer ført", key: "timer", width: 12 },
    { header: "Tilgjengelig", key: "tilgjengelig", width: 13 },
    { header: "Skrutid %", key: "skrutid", width: 11 },
    { header: "Mot anslag", key: "motAnslag", width: 12 },
    { header: "I tide %", key: "iTide", width: 10 },
    { header: "Jobber med frist", key: "medFrist", width: 17 },
    { header: "Dokumentert %", key: "dokumentert", width: 15 },
    { header: "Omganger", key: "omganger", width: 11 },
    { header: "Jobber på utstyr", key: "medUtstyr", width: 17 },
  ];
  ark.getRow(1).font = { bold: true };

  for (const m of rader) {
    ark.addRow({
      navn: m.navn,
      utfort: m.utfort,
      // Tom celle og ikke null: den som ikke fantes forrige periode har ingen
      // framgang å vise, og en null ville sett ut som et fall.
      forrige: m.forrige ? m.forrige.utfort : "",
      tunge: m.tunge,
      timer: Number(m.timer.toFixed(2)),
      tilgjengelig: m.tilgjengelig > 0 ? Number(m.tilgjengelig.toFixed(1)) : "",
      skrutid: m.skrutid == null ? "" : Math.round(m.skrutid * 100),
      motAnslag: m.motAnslag == null ? "" : Number(m.motAnslag.toFixed(2)),
      iTide: andel(m.iTide, m.medFrist) ?? "",
      medFrist: m.medFrist,
      dokumentert: andel(m.dokumentert, m.utfort) ?? "",
      omganger: m.omganger,
      medUtstyr: m.medUtstyr,
    });
  }

  // Forbeholdene følger med ut av systemet. Uten dem havner tallene i en
  // medarbeidersamtale uten det som forklarer dem.
  const noter = bok.addWorksheet("Slik leses tallene");
  noter.columns = [
    { header: "Kolonne", key: "kolonne", width: 18 },
    { header: "Hva den sier — og ikke sier", key: "tekst", width: 110 },
  ];
  noter.getRow(1).font = { bold: true };

  for (const n of [
    {
      kolonne: "Fullført",
      tekst:
        "Antall jobber. Favoriserer den som tar de korte — les sammen med Tunge.",
    },
    {
      kolonne: "Tunge",
      tekst:
        "Kritiske og høy prioritet. To med like mange fullførte kan ha hatt helt ulik uke.",
    },
    {
      kolonne: "Timer ført",
      tekst:
        "Fra timeføringen, ikke fra ordrene. Timene tilhører den som førte dem, også på en jobb tildelt en annen.",
    },
    {
      kolonne: "Skrutid",
      tekst:
        "Timer ført delt på tiden personen normalt var på jobb. Sier mest om driften: er den lav, går tiden til venting på deler, leting og møter. Helligdager er ikke trukket fra.",
    },
    {
      kolonne: "Mot anslag",
      tekst:
        "Timer delt på anslåtte timer. Sier mest om hvor gode anslagene er — de settes ofte av en annen enn den som gjør jobben.",
    },
    {
      kolonne: "I tide",
      tekst: "Bare av jobbene som hadde en frist. Tom celle betyr ingen frister.",
    },
    {
      kolonne: "Dokumentert",
      tekst:
        "Andel med skrevet løsning. Fullt i egen kontroll, og det er denne teksten søket finner igjen senere.",
    },
    {
      kolonne: "Omganger",
      tekst:
        "Utstyret fikk ny korrektiv jobb innen tretti dager. En maskin kan ryke av noe helt annet — pekepinn, ikke dom.",
    },
    {
      kolonne: "",
      tekst:
        "Det finnes ikke ett tall for hvor god en tekniker er. Les kolonnene sammen.",
    },
  ]) {
    noter.addRow(n);
  }

  const bytes = await bok.xlsx.writeBuffer();
  const filnavn = `medarbeidere-${dager}dager-${naa.toISOString().slice(0, 10)}.xlsx`;

  return new Response(bytes as ArrayBuffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filnavn}"`,
      // Tall om navngitte personer skal ikke ligge i en mellomlagring
      "Cache-Control": "no-store",
    },
  });
}
