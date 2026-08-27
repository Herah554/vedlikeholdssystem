import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { dbForOrg, nextCounterValue } from "@/lib/tenant";
import { opprettDemobedrift } from "@/lib/demo";
import {
  grupperBehov,
  slaaSammenLinjer,
  type BehovForGruppering,
} from "@/lib/delebehov";
import { BEHOV_NESTE, BEHOV_STATUS } from "@/lib/domene";

/**
 * Kontrollerer veien fra «jeg mangler en del» til varene på lager.
 *
 * To ting er lette å bygge nesten riktig her, og begge er stille feil:
 *
 * Ber to teknikere om samme del, må det bli én bestillingslinje med summert
 * antall. En bestilling kan bare ha én linje per del, så to linjer hadde
 * stoppet midt i med en databasefeil — og da mister begge sitt behov.
 *
 * Og når varene kommer inn, må behovet bli markert som mottatt. Skjer ikke
 * det, stopper sporet i det innkjøperen trykker send, og teknikeren må gå og
 * spørre likevel. Da er ingenting vunnet.
 *
 * Kjør med: npm run sjekk:delebehov
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

function lag(
  id: string,
  opts: {
    antall?: number;
    haster?: boolean;
    del?: string | null;
    leverandor?: string | null;
    navn?: string;
    pris?: number;
  } = {},
): BehovForGruppering {
  const delId = opts.del === undefined ? "del-1" : opts.del;
  return {
    id,
    quantity: opts.antall ?? 1,
    urgent: opts.haster ?? false,
    part: delId
      ? {
          id: delId,
          supplierId: opts.leverandor === undefined ? "lev-1" : opts.leverandor,
          supplierNavn: opts.navn ?? "Alfa Teknikk",
          unitCost: opts.pris ?? 100,
        }
      : null,
  };
}

async function main() {
  // ── Gruppering ────────────────────────────────────────────
  const gruppert = grupperBehov([
    lag("a"),
    lag("b", { leverandor: "lev-2", navn: "Beta Deler" }),
    lag("c", { leverandor: null }),
    lag("d", { del: null }),
  ]);

  sjekk("Behov deles på leverandør", gruppert.klare.length, 2);
  sjekk("Del uten leverandør kan ikke bestilles", gruppert.utenLeverandor.length, 1);
  sjekk("Fritekstbehov må kobles først", gruppert.maaKobles.length, 1);
  sjekk(
    "Leverandørene kommer alfabetisk",
    gruppert.klare.map((g) => g.navn),
    ["Alfa Teknikk", "Beta Deler"],
  );

  // Den som stopper produksjonen skal ligge øverst, ikke i innkommet rekkefølge
  const haster = grupperBehov([
    lag("rolig"),
    lag("kritisk", { haster: true }),
    lag("ogsaa-rolig"),
  ]);
  sjekk(
    "Det som haster ligger øverst",
    haster.klare[0].behov.map((b) => b.id),
    ["kritisk", "rolig", "ogsaa-rolig"],
  );

  // ── Sammenslåing ──────────────────────────────────────────
  // Dette er den som ville stoppet en hel bestilling om den var feil.
  const slaatt = slaaSammenLinjer([
    lag("t1", { del: "pakning", antall: 2 }),
    lag("t2", { del: "pakning", antall: 3 }),
    lag("t3", { del: "lager", antall: 1 }),
  ]);
  sjekk("Samme del blir én linje", slaatt.length, 2);
  sjekk(
    "Antallet summeres",
    slaatt.find((l) => l.partId === "pakning")?.quantity,
    5,
  );
  sjekk(
    "Linja husker hvilke behov den dekker",
    slaatt.find((l) => l.partId === "pakning")?.behovIder,
    ["t1", "t2"],
  );

  // Man kan ikke bestille en halv pakning, og å runde ned gir teknikeren
  // for lite.
  const brok = slaaSammenLinjer([
    lag("x", { del: "olje", antall: 0.5 }),
    lag("y", { del: "olje", antall: 0.7 }),
  ]);
  sjekk("Brøkdeler rundes opp", brok[0].quantity, 2);

  const bittelite = slaaSammenLinjer([lag("z", { del: "skrue", antall: 0.1 })]);
  sjekk("Aldri under én", bittelite[0].quantity, 1);

  sjekk("Fritekstbehov blir ingen linje", slaaSammenLinjer([lag("q", { del: null })]).length, 0);

  // ── Etikettene ────────────────────────────────────────────
  // Hver status må ha både en tekst og et neste steg. Mangler det ene,
  // står teknikeren igjen uten å vite om hen får delen.
  for (const status of ["ONSKET", "BESTILT", "MOTTATT", "AVVIST"] as const) {
    sjekk(`«${status}» har etikett`, Boolean(BEHOV_STATUS[status]?.tekst), true);
    sjekk(`«${status}» sier hva som skjer videre`, Boolean(BEHOV_NESTE[status]), true);
  }

  // ── Hele veien gjennom databasen ──────────────────────────
  const demo = await opprettDemobedrift();
  const db = dbForOrg(demo.organisasjonId);

  try {
    const [leverandor, bruker] = await Promise.all([
      db.supplier.findFirst(),
      db.user.findFirst(),
    ]);
    if (!leverandor || !bruker) throw new Error("Demobedriften mangler grunndata.");

    const ordre = await db.workOrder.findFirst();
    if (!ordre) throw new Error("Demobedriften mangler arbeidsordre.");

    const del = await db.part.create({
      data: {
        organizationId: demo.organisasjonId,
        number: "TEST-BEHOV-1",
        name: "Testpakning",
        unit: "stk",
        unitCost: 250,
        supplierId: leverandor.id,
        quantityOnHand: 0,
      },
    });

    // ── Søket ─────────────────────────────────────────────
    // Dette er grunnen til at nedtrekkslista ble byttet ut. Finner ikke
    // søket delen, er teknikeren like langt som før.
    await db.part.createMany({
      data: [
        {
          organizationId: demo.organisasjonId,
          number: "SKF-6205-2RS",
          name: "Kulelager 25x52x15",
          manufacturer: "SKF",
          unit: "stk",
          unitCost: 180,
        },
        {
          organizationId: demo.organisasjonId,
          number: "TETN-9911",
          name: "Akseltetning 40mm",
          manufacturer: "Trelleborg",
          manufacturerPartNo: "TB-40-A",
          unit: "stk",
          unitCost: 95,
        },
      ],
    });

    async function sok(q: string) {
      return db.part.findMany({
        where: {
          isActive: true,
          OR: [
            { number: { contains: q, mode: "insensitive" } },
            { name: { contains: q, mode: "insensitive" } },
            { manufacturer: { contains: q, mode: "insensitive" } },
            { manufacturerPartNo: { contains: q, mode: "insensitive" } },
          ],
        },
        select: { number: true },
      });
    }

    sjekk(
      "Søk midt i navnet finner delen",
      (await sok("tetning")).some((d) => d.number === "TETN-9911"),
      true,
    );
    sjekk(
      "Store og små bokstaver spiller ingen rolle",
      (await sok("KULELAGER")).some((d) => d.number === "SKF-6205-2RS"),
      true,
    );
    sjekk(
      "Delenummer treffer",
      (await sok("6205")).some((d) => d.number === "SKF-6205-2RS"),
      true,
    );
    sjekk(
      "Fabrikat treffer",
      (await sok("trelleborg")).some((d) => d.number === "TETN-9911"),
      true,
    );
    sjekk(
      "Produsentens eget nummer treffer",
      (await sok("TB-40")).some((d) => d.number === "TETN-9911"),
      true,
    );
    sjekk("Tull gir ingen treff", (await sok("zzzqqq")).length, 0);

    // To teknikere ber om samme del til samme jobb
    await db.partRequest.createMany({
      data: [
        {
          organizationId: demo.organisasjonId,
          workOrderId: ordre.id,
          partId: del.id,
          quantity: 2,
          note: "Lekker på drivsiden",
          requestedById: bruker.id,
        },
        {
          organizationId: demo.organisasjonId,
          workOrderId: ordre.id,
          partId: del.id,
          quantity: 3,
          urgent: true,
          requestedById: bruker.id,
        },
      ],
    });

    const ventende = await db.partRequest.findMany({
      where: { partId: del.id, status: "ONSKET" },
      include: { part: { select: { id: true, supplierId: true, unitCost: true } } },
    });
    sjekk("Begge behovene er lagret", ventende.length, 2);

    // Gjør dem om til én bestilling, slik bestillBehov gjør det
    const linjer = slaaSammenLinjer(
      ventende.map((v) => ({
        id: v.id,
        quantity: v.quantity,
        urgent: v.urgent,
        part: v.part
          ? {
              id: v.part.id,
              supplierId: v.part.supplierId,
              supplierNavn: leverandor.name,
              unitCost: Number(v.part.unitCost),
            }
          : null,
      })),
    );
    sjekk("De to behovene blir én linje", linjer.length, 1);
    sjekk("Med fem stykker til sammen", linjer[0].quantity, 5);

    const nummer = await nextCounterValue(demo.organisasjonId, "purchaseOrder");
    const bestilling = await db.purchaseOrder.create({
      data: {
        organizationId: demo.organisasjonId,
        number: nummer,
        supplierId: leverandor.id,
        createdById: bruker.id,
        status: "SENDT",
        lines: {
          create: linjer.map((l) => ({
            partId: l.partId,
            quantity: l.quantity,
            unitCost: l.unitCost,
          })),
        },
      },
      include: { lines: true },
    });

    await db.partRequest.updateMany({
      where: { id: { in: linjer[0].behovIder } },
      data: { status: "BESTILT", purchaseOrderId: bestilling.id },
    });

    const bestilte = await db.partRequest.count({
      where: { partId: del.id, status: "BESTILT" },
    });
    sjekk("Begge behovene er koblet til bestillingen", bestilte, 2);

    // Beviset for at sammenslåingen må finnes: uten den hadde det andre
    // behovet forsøkt å legge inn en linje til på samme del, og databasen
    // hadde stoppet hele bestillingen.
    let stoppet = false;
    try {
      await db.purchaseOrderLine.create({
        data: {
          purchaseOrderId: bestilling.id,
          partId: del.id,
          quantity: 1,
          unitCost: 250,
        },
      });
    } catch {
      stoppet = true;
    }
    sjekk("To linjer på samme del avvises av databasen", stoppet, true);

    // Varene kommer inn — dette er returen til teknikeren
    await db.$transaction(async (tx) => {
      await tx.purchaseOrderLine.update({
        where: { id: bestilling.lines[0].id },
        data: { receivedQuantity: 5 },
      });
      await tx.part.update({
        where: { id: del.id },
        data: { quantityOnHand: { increment: 5 } },
      });
      await tx.purchaseOrder.update({
        where: { id: bestilling.id },
        data: { status: "MOTTATT", receivedAt: new Date() },
      });
      await tx.partRequest.updateMany({
        where: { purchaseOrderId: bestilling.id, status: "BESTILT" },
        data: { status: "MOTTATT" },
      });
    });

    const mottatte = await db.partRequest.count({
      where: { partId: del.id, status: "MOTTATT" },
    });
    sjekk("Teknikeren ser at delene er kommet", mottatte, 2);

    const paaLager = await db.part.findFirst({ where: { id: del.id } });
    sjekk("Beholdningen stemmer med det som ble bestilt", paaLager?.quantityOnHand, 5);

    // ── Isolering ───────────────────────────────────────────
    // Et delebehov røper hva slags utstyr en bedrift har og hva som er i
    // stykker. Det skal ingen andre kunder se.
    const iAlt = await prisma.partRequest.count();
    const synlig = await db.partRequest.count();
    const rader = await db.partRequest.findMany({
      select: { organizationId: true },
    });
    const fremmede = rader.filter((r) => r.organizationId !== demo.organisasjonId);
    sjekk("Ingen behov fra andre bedrifter er synlige", fremmede.length, 0);
    sjekk("Bedriften ser færre enn alle i basen", synlig <= iAlt, true);
  } finally {
    await prisma.purchaseOrder.deleteMany({
      where: { organizationId: demo.organisasjonId },
    });
    await prisma.organization.delete({ where: { id: demo.organisasjonId } });
  }

  console.log(feil === 0 ? "\nAlt stemmer." : `\n${feil} sjekk(er) feilet.`);
  process.exit(feil === 0 ? 0 : 1);
}

main();
