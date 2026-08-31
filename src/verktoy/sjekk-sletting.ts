import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { beskyttedeModeller, dbForOrg } from "@/lib/tenant";
import { tomAlleTabeller } from "@/lib/bedrift";
import { opprettDemobedrift } from "@/lib/demo";

/**
 * Kontrollerer at en kunde faktisk blir borte — og at ingen andre gjør det.
 *
 * Ni fremmednøkler i schemaet er satt til Restrict. De gjør at et enkelt
 * organization.delete() stopper med en fremmednøkkelfeil på enhver kunde som
 * har brukt systemet. Feilen viser seg ikke på en tom testbedrift, bare på en
 * ekte en — derfor slettes en fullt utfylt demobedrift her.
 *
 * Den andre halvparten er viktigere: slettingen filtrerer på organizationId i
 * hver eneste tabell, og går det galt der, tar man en annen kundes data med
 * seg. Derfor står det en nabobedrift ved siden av som telles før og etter.
 *
 * Kjør med: npm run sjekk:sletting
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

/** Teller rader i hver eierskapstabell for én organisasjon. */
async function tellAlt(orgId: string): Promise<Record<string, number>> {
  const klient = prisma as unknown as Record<
    string,
    { count?: (a: unknown) => Promise<number> }
  >;
  const tall: Record<string, number> = {};

  for (const modell of beskyttedeModeller()) {
    if (modell === "Organization") continue;
    const delegat = klient[modell[0].toLowerCase() + modell.slice(1)];
    if (!delegat?.count) continue;
    tall[modell] = await delegat.count({ where: { organizationId: orgId } });
  }

  return tall;
}

/** Fyller ut de tabellene demobedriften lar stå tomme. */
async function lagDetSomManglet(orgId: string): Promise<void> {
  const [bruker, ordre, del, leverandor] = await Promise.all([
    prisma.user.findFirstOrThrow({ where: { organizationId: orgId } }),
    prisma.workOrder.findFirstOrThrow({ where: { organizationId: orgId } }),
    prisma.part.findFirstOrThrow({ where: { organizationId: orgId } }),
    prisma.supplier.findFirstOrThrow({ where: { organizationId: orgId } }),
  ]);

  await prisma.timeEntry.create({
    data: {
      organizationId: orgId,
      workOrderId: ordre.id,
      userId: bruker.id,
      hours: 3,
      hourlyRate: 850,
      workedOn: new Date(),
    },
  });

  await prisma.partUsage.create({
    data: {
      organizationId: orgId,
      workOrderId: ordre.id,
      partId: del.id,
      quantity: 2,
      unitCost: del.unitCost,
    },
  });

  await prisma.purchaseOrder.create({
    data: {
      organizationId: orgId,
      number: 9001,
      supplierId: leverandor.id,
      createdById: bruker.id,
      status: "SENDT",
      lines: {
        create: [{ partId: del.id, quantity: 5, unitCost: del.unitCost }],
      },
    },
  });
}

async function main() {
  // Naboen skal stå urørt etterpå. Uten den beviser testen bare at noe ble
  // slettet, ikke at det var det riktige.
  const nabo = await opprettDemobedrift();
  const doomed = await opprettDemobedrift();

  try {
    // Demobedriften lager ikke timer, deleuttak eller bestillinger — og det
    // er nettopp de tre som henger i Restrict-nøkler mot User, Part og
    // Supplier. Uten dem beviser testen ingenting om det som er vanskelig.
    await lagDetSomManglet(doomed.organisasjonId);

    const forFør = await tellAlt(doomed.organisasjonId);
    const naboFør = await tellAlt(nabo.organisasjonId);

    const fylte = Object.entries(forFør).filter(([, n]) => n > 0);
    sjekk(
      "Bedriften som skal slettes har data i mange tabeller",
      fylte.length > 10,
      true,
    );

    // Nettopp disse tabellene henger i Restrict-nøkler. Er de tomme, beviser
    // testen ingenting om det som faktisk er vanskelig.
    for (const tabell of [
      "WorkOrder",
      "PartUsage",
      "PurchaseOrder",
      "TimeEntry",
      "Deviation",
      "Asset",
      "PartRequest",
    ]) {
      sjekk(`${tabell} har rader før slettingen`, (forFør[tabell] ?? 0) > 0, true);
    }

    // ── Selve slettingen ──────────────────────────────────────
    await tomAlleTabeller(doomed.organisasjonId);
    await prisma.organization.delete({ where: { id: doomed.organisasjonId } });

    const igjen = await tellAlt(doomed.organisasjonId);
    const restene = Object.entries(igjen).filter(([, n]) => n > 0);
    sjekk("Ingen rader er igjen etter kunden", restene, []);

    const finnes = await prisma.organization.findUnique({
      where: { id: doomed.organisasjonId },
    });
    sjekk("Selve bedriften er borte", finnes, null);

    // Barnetabellene uten organizationId arver tilhørigheten sin, så de skal
    // ha forsvunnet med foreldrene. De telles for seg, siden de ikke er med
    // i lista over.
    const linjer = await prisma.purchaseOrderLine.count({
      where: { purchaseOrder: { organizationId: doomed.organisasjonId } },
    });
    sjekk("Bestillingslinjene fulgte med", linjer, 0);

    // ── Naboen ────────────────────────────────────────────────
    const naboEtter = await tellAlt(nabo.organisasjonId);
    sjekk("Nabobedriften har nøyaktig like mange rader som før", naboEtter, naboFør);

    const naboFinnes = await prisma.organization.findUnique({
      where: { id: nabo.organisasjonId },
      select: { id: true },
    });
    sjekk("Nabobedriften står fortsatt der", Boolean(naboFinnes), true);

    // Og den virker fortsatt: filteret skal ikke ha blitt forvirret
    const naboDb = dbForOrg(nabo.organisasjonId);
    sjekk("Naboen ser fortsatt sine arbeidsordre", await naboDb.workOrder.count() > 0, true);
  } finally {
    await tomAlleTabeller(nabo.organisasjonId);
    await prisma.organization
      .delete({ where: { id: nabo.organisasjonId } })
      .catch(() => {});
    await prisma.organization
      .delete({ where: { id: doomed.organisasjonId } })
      .catch(() => {});
  }

  console.log(feil === 0 ? "\nAlt stemmer." : `\n${feil} sjekk(er) feilet.`);
  process.exit(feil === 0 ? 0 : 1);
}

main();
