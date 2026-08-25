import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { dbForOrg } from "@/lib/tenant";
import { opprettBedrift } from "@/lib/bedrift";
import {
  framdrift,
  lesFelter,
  lesSvar,
  manglerSvar,
  SJA_MAL,
} from "@/lib/skjema";

/**
 * Kontrollerer at et utfylt skjema aldri endrer innhold.
 *
 * Dette er hele poenget med skjemadelen. Et SJA er et sikkerhetsdokument noen
 * har satt navnet sitt på. Endrer noen malen i mars, skal ikke et skjema
 * signert i januar plutselig ha andre spørsmål enn det den som signerte
 * faktisk svarte på — da er dokumentet verdiløst som bevis.
 *
 * Kjør med: npm run sjekk:skjema
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
  // ── Vasking av felter ─────────────────────────────────────
  sjekk("Tull i feltlista forkastes", lesFelter("ikke en liste").length, 0);
  sjekk("Felt uten etikett forkastes", lesFelter([{ type: "tekst" }]).length, 0);
  sjekk(
    "Ukjent felttype blir til tekst",
    lesFelter([{ id: "a", type: "finnesikke", etikett: "Noe" }])[0].type,
    "tekst",
  );
  sjekk("SJA-forslaget er gyldig", lesFelter(SJA_MAL).length, SJA_MAL.length);

  const { org, bruker } = await opprettBedrift({
    firma: `Skjematest ${Date.now()}`,
    navn: "Test Testesen",
    email: `test-${Date.now()}@skjematest.no`,
    password: "et-langt-nok-passord",
  });

  const db = dbForOrg(org.id);

  try {
    // ── Malen opprettes ─────────────────────────────────────
    const mal = await db.formTemplate.create({
      data: {
        organizationId: org.id,
        name: "SJA",
        scope: "ARBEIDSORDRE",
        fields: [
          { id: "arbeid", type: "langtekst", etikett: "Hva skal gjøres?", pakrevd: true },
          { id: "farer", type: "flervalg", etikett: "Farer", pakrevd: true, valg: ["Fall", "Klem"] },
          { id: "godkjent", type: "avkryssing", etikett: "Gjennomgått", pakrevd: true },
        ],
      },
    });

    const ordre = await db.workOrder.create({
      data: {
        organizationId: org.id,
        number: 1,
        title: "Bytte lager",
        requestedById: bruker.id,
      },
    });

    // ── Skjemaet startes og tar en kopi av malen ────────────
    const skjema = await db.formResponse.create({
      data: {
        organizationId: org.id,
        templateId: mal.id,
        templateName: mal.name,
        templateVersion: mal.version,
        schemaSnapshot: mal.fields ?? [],
        workOrderId: ordre.id,
        startedById: bruker.id,
        answers: {
          arbeid: "Bytte lager på drivsiden",
          farer: ["Klem"],
          godkjent: true,
        },
      },
    });

    const felterFor = lesFelter(skjema.schemaSnapshot);
    sjekk("Kopien har tre felter", felterFor.length, 3);
    sjekk(
      "Alle påkrevde er besvart",
      manglerSvar(felterFor, lesSvar(skjema.answers, felterFor)).length,
      0,
    );
    sjekk("Framdriften er full", framdrift(felterFor, lesSvar(skjema.answers, felterFor)), {
      utfylt: 3,
      totalt: 3,
    });

    // ── Malen endres kraftig etterpå ────────────────────────
    await db.formTemplate.updateMany({
      where: { id: mal.id },
      data: {
        fields: [
          { id: "helt-nytt", type: "tekst", etikett: "Et helt annet spørsmål", pakrevd: true },
        ],
        version: mal.version + 1,
      },
    });

    const etterEndring = await db.formResponse.findFirstOrThrow({
      where: { id: skjema.id },
    });
    const felterEtter = lesFelter(etterEndring.schemaSnapshot);

    sjekk("Det utfylte skjemaet har fortsatt tre felter", felterEtter.length, 3);
    sjekk(
      "Spørsmålene er de samme",
      felterEtter.map((f) => f.id),
      ["arbeid", "farer", "godkjent"],
    );
    sjekk(
      "Svarene står urørt",
      lesSvar(etterEndring.answers, felterEtter).arbeid,
      "Bytte lager på drivsiden",
    );
    sjekk(
      "Versjonen viser hvilken utgave det ble fylt ut fra",
      etterEndring.templateVersion,
      1,
    );

    const oppdatertMal = await db.formTemplate.findFirstOrThrow({
      where: { id: mal.id },
    });
    sjekk("Malen selv er på ny versjon", oppdatertMal.version, 2);

    // ── Et halvferdig skjema kan ikke låses ─────────────────
    const halvferdig = await db.formResponse.create({
      data: {
        organizationId: org.id,
        templateId: mal.id,
        templateName: mal.name,
        templateVersion: 1,
        schemaSnapshot: skjema.schemaSnapshot ?? [],
        workOrderId: ordre.id,
        answers: { arbeid: "Bare halvveis" },
      },
    });

    const felterHalv = lesFelter(halvferdig.schemaSnapshot);
    const mangler = manglerSvar(
      felterHalv,
      lesSvar(halvferdig.answers, felterHalv),
    );
    sjekk("To påkrevde mangler", mangler.length, 2);
    sjekk(
      "Og systemet vet hvilke",
      mangler.map((f) => f.etikett),
      ["Farer", "Gjennomgått"],
    );

    // ── Isolering ───────────────────────────────────────────
    const rader = await db.formResponse.findMany({
      select: { organizationId: true },
    });
    sjekk(
      "Ingen skjemaer fra andre bedrifter",
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
