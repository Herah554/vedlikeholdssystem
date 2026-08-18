import "dotenv/config";
/**
 * Testdata for utvikling.
 *
 * Bygger opp et realistisk produksjonsanlegg med historikk, slik at alle
 * modulene har noe å vise fram. Historikken inneholder med vilje flere
 * liknende feil på samme utstyr — det er nettopp slike mønstre assistenten
 * skal kunne finne igjen når en tekniker søker.
 *
 * Kjøres med: npm run db:seed
 */

import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

const NÅ = new Date("2026-08-18T09:00:00Z");

/** Dato et gitt antall dager før referansetidspunktet. */
function dagerSiden(dager: number, time = 9): Date {
  const d = new Date(NÅ);
  d.setDate(d.getDate() - dager);
  d.setHours(time, 0, 0, 0);
  return d;
}

function dagerFram(dager: number, time = 9): Date {
  return dagerSiden(-dager, time);
}

async function main() {
  // Denne filen sletter alt og legger inn kontoer med et kjent passord.
  // Kjøres den mot en produksjonsdatabase, er både dataene borte og systemet
  // åpent for alle som har lest koden.
  if (
    process.env.NODE_ENV === "production" &&
    process.env.TILLAT_SEED_I_PRODUKSJON?.toLowerCase() !== "ja"
  ) {
    throw new Error(
      "Nekter å legge inn testdata i produksjon — dette sletter ALT som ligger " +
        "i databasen og oppretter kontoer med et kjent passord.\n" +
        "Er det virkelig meningen, sett TILLAT_SEED_I_PRODUKSJON=\"ja\".",
    );
  }

  // En tom variabel i .env teller som «ikke satt» — ellers ville
  // SEED_PASSWORD="" gitt et tomt passord i stedet for standardverdien.
  const passord = process.env.SEED_PASSWORD?.trim() || "passord123";
  if (passord.length < 8) {
    throw new Error("SEED_PASSWORD må ha minst åtte tegn.");
  }

  console.log("Tømmer eksisterende data …");

  // Bestillingslinjer peker på reservedeler med Restrict — med vilje, slik at
  // ingen kan slette en del som står på en bestilling og dermed rive bort
  // historikken. Da kan ikke sletting av organisasjonen kaskadere fritt, så
  // bestillingene må ryddes først.
  await prisma.purchaseOrder.deleteMany();

  // Resten henger under Organization via kaskadesletting.
  await prisma.organization.deleteMany();

  const passordHash = await bcrypt.hash(passord, 12);

  // ─────────────────────────────────────────────────────────
  // Organisasjon 1 — hovedkunden i testdataene
  // ─────────────────────────────────────────────────────────

  const org = await prisma.organization.create({
    data: {
      slug: "nordvik",
      name: "Nordvik Industri AS",
      orgNumber: "912345678",
      hourlyRate: 950,
      // Brukes som avsender og leveringsadresse på bestillinger
      email: "vedlikehold@nordvik.eksempel.no",
      phone: "69 20 15 00",
      address: "Verkstedveien 12",
      postalCode: "1517",
      city: "Moss",
    },
  });

  console.log(`Opprettet ${org.name}`);

  const [admin, leder, planlegger, tekniker1, tekniker2, tekniker3] =
    await Promise.all(
      [
        { email: "admin@nordvik.no", name: "David Hasselberg", role: "ADMIN" as const, hourlyRate: 1100 },
        { email: "leder@nordvik.no", name: "Kari Aasen", role: "LEDER" as const, hourlyRate: 1100 },
        { email: "planlegger@nordvik.no", name: "Ove Restad", role: "PLANLEGGER" as const, hourlyRate: 980 },
        { email: "morten@nordvik.no", name: "Morten Lie", role: "TEKNIKER" as const, hourlyRate: 950 },
        { email: "silje@nordvik.no", name: "Silje Bakken", role: "TEKNIKER" as const, hourlyRate: 950 },
        { email: "jonas@nordvik.no", name: "Jonas Ødegård", role: "TEKNIKER" as const, hourlyRate: 900 },
      ].map((u) =>
        prisma.user.create({
          data: { ...u, organizationId: org.id, passwordHash: passordHash },
        }),
      ),
    );

  const teknikere = [tekniker1, tekniker2, tekniker3];

  // ─── Kostnadssteder ──────────────────────────────────────

  const [ksProduksjon, ksTeknisk, ksBygg] = await Promise.all(
    [
      { code: "100", name: "Produksjon" },
      { code: "200", name: "Teknisk drift" },
      { code: "300", name: "Bygg og infrastruktur" },
    ].map((k) => prisma.costCenter.create({ data: { ...k, organizationId: org.id } })),
  );

  // ─── Anleggsstruktur ─────────────────────────────────────

  const anlegg = await prisma.asset.create({
    data: {
      organizationId: org.id,
      type: "ANLEGG",
      code: "MOSS",
      name: "Produksjonsanlegg Moss",
      description: "Hovedanlegget med tre produksjonslinjer og tilhørende teknisk infrastruktur.",
      location: "Moss",
      criticality: 5,
      depth: 0,
      costCenterId: ksProduksjon.id,
    },
  });
  await prisma.asset.update({
    where: { id: anlegg.id },
    data: { path: `/${anlegg.id}` },
  });

  async function lagSystem(code: string, name: string, kostnadssted: string, kritikalitet = 4) {
    const s = await prisma.asset.create({
      data: {
        organizationId: org.id,
        parentId: anlegg.id,
        type: "SYSTEM",
        code,
        name,
        depth: 1,
        criticality: kritikalitet,
        costCenterId: kostnadssted,
        path: "",
      },
    });
    return prisma.asset.update({
      where: { id: s.id },
      data: { path: `/${anlegg.id}/${s.id}` },
    });
  }

  const sysKjol = await lagSystem("SYS-KJOL", "Kjølesystem", ksTeknisk.id, 5);
  const sysTrykk = await lagSystem("SYS-TRYKK", "Trykkluftanlegg", ksTeknisk.id, 5);
  const sysPakk = await lagSystem("SYS-PAKK", "Pakkelinje 1", ksProduksjon.id, 5);
  const sysEl = await lagSystem("SYS-EL", "Elkraft", ksBygg.id, 5);

  async function lagUtstyr(
    forelder: { id: string; path: string },
    data: {
      code: string;
      name: string;
      criticality: number;
      manufacturer?: string;
      modelNumber?: string;
      serialNumber?: string;
      installedAt?: Date;
      purchaseCost?: number;
      runningHours?: number;
      costCenterId?: string;
      description?: string;
    },
  ) {
    const u = await prisma.asset.create({
      data: {
        organizationId: org.id,
        parentId: forelder.id,
        type: "UTSTYR",
        depth: 2,
        path: "",
        ...data,
      },
    });
    return prisma.asset.update({
      where: { id: u.id },
      data: { path: `${forelder.path}/${u.id}` },
    });
  }

  const p101 = await lagUtstyr(sysKjol, {
    code: "P-101",
    name: "Kjølevannspumpe 1",
    description: "Hovedpumpe for kjølevannskretsen. Går kontinuerlig i produksjonstiden.",
    criticality: 5,
    manufacturer: "Grundfos",
    modelNumber: "NK 80-250/270",
    serialNumber: "GF-2019-88421",
    installedAt: new Date("2019-04-12"),
    purchaseCost: 148000,
    runningHours: 38420,
    costCenterId: ksTeknisk.id,
  });

  const p102 = await lagUtstyr(sysKjol, {
    code: "P-102",
    name: "Kjølevannspumpe 2",
    description: "Reservepumpe, veksler drift med P-101 hver 14. dag.",
    criticality: 4,
    manufacturer: "Grundfos",
    modelNumber: "NK 80-250/270",
    serialNumber: "GF-2019-88422",
    installedAt: new Date("2019-04-12"),
    purchaseCost: 148000,
    runningHours: 31160,
    costCenterId: ksTeknisk.id,
  });

  const kj201 = await lagUtstyr(sysKjol, {
    code: "KJ-201",
    name: "Kjøletårn",
    criticality: 4,
    manufacturer: "Baltimore Aircoil",
    modelNumber: "VXI-36",
    installedAt: new Date("2015-06-01"),
    purchaseCost: 420000,
    runningHours: 51200,
    costCenterId: ksTeknisk.id,
  });

  const komp301 = await lagUtstyr(sysTrykk, {
    code: "KOMP-301",
    name: "Skruekompressor",
    description: "Forsyner hele anlegget med instrumentluft. Stopp her stanser pakkelinja.",
    criticality: 5,
    manufacturer: "Atlas Copco",
    modelNumber: "GA 55 VSD+",
    serialNumber: "AC-2021-55193",
    installedAt: new Date("2021-09-20"),
    purchaseCost: 610000,
    runningHours: 22840,
    costCenterId: ksTeknisk.id,
  });

  const trk302 = await lagUtstyr(sysTrykk, {
    code: "TRK-302",
    name: "Trykklufttørker",
    criticality: 3,
    manufacturer: "Atlas Copco",
    modelNumber: "FD 260",
    installedAt: new Date("2021-09-20"),
    purchaseCost: 96000,
    runningHours: 22840,
    costCenterId: ksTeknisk.id,
  });

  const pl401 = await lagUtstyr(sysPakk, {
    code: "PL-401",
    name: "Innmater",
    criticality: 3,
    manufacturer: "Marel",
    installedAt: new Date("2018-03-15"),
    purchaseCost: 230000,
    runningHours: 29100,
    costCenterId: ksProduksjon.id,
  });

  const pl402 = await lagUtstyr(sysPakk, {
    code: "PL-402",
    name: "Fyllemaskin",
    description: "Volumetrisk fylling, 120 enheter i minuttet.",
    criticality: 5,
    manufacturer: "Krones",
    modelNumber: "Modulfill 24",
    serialNumber: "KR-2018-3391",
    installedAt: new Date("2018-03-15"),
    purchaseCost: 1450000,
    runningHours: 29100,
    costCenterId: ksProduksjon.id,
  });

  const pl403 = await lagUtstyr(sysPakk, {
    code: "PL-403",
    name: "Etikettmaskin",
    criticality: 3,
    manufacturer: "Herma",
    modelNumber: "500",
    installedAt: new Date("2020-11-02"),
    purchaseCost: 310000,
    runningHours: 24800,
    costCenterId: ksProduksjon.id,
  });

  const pl404 = await lagUtstyr(sysPakk, {
    code: "PL-404",
    name: "Pallreiser",
    criticality: 2,
    manufacturer: "TMI",
    installedAt: new Date("2018-03-15"),
    purchaseCost: 540000,
    runningHours: 29100,
    costCenterId: ksProduksjon.id,
  });

  const trf501 = await lagUtstyr(sysEl, {
    code: "TRF-501",
    name: "Transformator T1",
    criticality: 5,
    manufacturer: "ABB",
    modelNumber: "1250 kVA",
    installedAt: new Date("2012-05-30"),
    purchaseCost: 890000,
    costCenterId: ksBygg.id,
  });

  const agg502 = await lagUtstyr(sysEl, {
    code: "AGG-502",
    name: "Nødstrømsaggregat",
    criticality: 4,
    manufacturer: "Caterpillar",
    modelNumber: "C15",
    installedAt: new Date("2016-08-11"),
    purchaseCost: 720000,
    runningHours: 412,
    costCenterId: ksBygg.id,
  });

  console.log("Opprettet anleggsstruktur med 12 utstyrsenheter");

  // ─── Leverandører og reservedeler ────────────────────────

  const [ahlsell, tess, atlas] = await Promise.all(
    [
      // E-postadressene er oppdiktede — bestillinger fra testdataene skal
      // ikke kunne havne hos en ekte leverandør ved et uhell.
      { name: "Ahlsell Norge AS", contactName: "Kundesenter", email: "ordre@ahlsell.eksempel.no", phone: "51 81 85 00", website: "https://www.ahlsell.no" },
      { name: "Tess AS", contactName: "Avd. Moss", email: "moss@tess.eksempel.no", phone: "69 24 20 00", website: "https://www.tess.no" },
      { name: "Atlas Copco Norge AS", contactName: "Service", email: "service@atlascopco.eksempel.no", phone: "64 86 03 00", website: "https://www.atlascopco.no" },
    ].map((l) => prisma.supplier.create({ data: { ...l, organizationId: org.id } })),
  );

  const deler = await Promise.all(
    [
      { number: "LAG-6205", name: "Kulelager SKF 6205-2RS", manufacturer: "SKF", manufacturerPartNo: "6205-2RSH", unitCost: 289, quantityOnHand: 8, minStock: 4, binLocation: "A1-03", supplierId: ahlsell.id, leadTimeDays: 3 },
      { number: "LAG-6308", name: "Kulelager SKF 6308-2RS", manufacturer: "SKF", manufacturerPartNo: "6308-2RSH", unitCost: 615, quantityOnHand: 2, minStock: 4, binLocation: "A1-04", supplierId: ahlsell.id, leadTimeDays: 3 },
      { number: "PAK-P101", name: "Akseltetning pumpe NK 80", manufacturer: "Grundfos", manufacturerPartNo: "96455213", unitCost: 2450, quantityOnHand: 3, minStock: 2, binLocation: "A2-01", supplierId: ahlsell.id, leadTimeDays: 10 },
      { number: "FIL-LUFT", name: "Luftfilter GA 55", manufacturer: "Atlas Copco", manufacturerPartNo: "1621574200", unitCost: 890, quantityOnHand: 4, minStock: 2, binLocation: "B1-01", supplierId: atlas.id, leadTimeDays: 5 },
      { number: "FIL-OLJE", name: "Oljefilter GA 55", manufacturer: "Atlas Copco", manufacturerPartNo: "1622065200", unitCost: 640, quantityOnHand: 1, minStock: 3, binLocation: "B1-02", supplierId: atlas.id, leadTimeDays: 5 },
      { number: "OLJ-VG46", name: "Kompressorolje Roto-Xtend 20 l", manufacturer: "Atlas Copco", manufacturerPartNo: "1630201600", unit: "kanne", unitCost: 3200, quantityOnHand: 2, minStock: 1, binLocation: "B2-01", supplierId: atlas.id, leadTimeDays: 7 },
      { number: "REM-A45", name: "Kilerem A45", manufacturer: "Optibelt", unitCost: 185, quantityOnHand: 12, minStock: 4, binLocation: "C1-02", supplierId: tess.id, leadTimeDays: 2 },
      { number: "KON-24V", name: "Kontaktor 24 V DC", manufacturer: "Schneider", manufacturerPartNo: "LC1D09BD", unitCost: 720, quantityOnHand: 5, minStock: 2, binLocation: "D1-01", supplierId: ahlsell.id, leadTimeDays: 2 },
      { number: "SIK-C16", name: "Automatsikring C16 3-pol", manufacturer: "ABB", unitCost: 410, quantityOnHand: 14, minStock: 6, binLocation: "D1-02", supplierId: ahlsell.id, leadTimeDays: 2 },
      { number: "SEN-PT100", name: "Temperaturføler Pt100", manufacturer: "Endress+Hauser", unitCost: 1850, quantityOnHand: 3, minStock: 2, binLocation: "D2-01", supplierId: ahlsell.id, leadTimeDays: 6 },
      { number: "SLA-HYD25", name: "Hydraulikkslange 1/4\" 2,5 m", manufacturer: "Tess", unit: "stk", unitCost: 540, quantityOnHand: 6, minStock: 3, binLocation: "C2-01", supplierId: tess.id, leadTimeDays: 1 },
      { number: "PAK-DUS40", name: "Dyse fyllemaskin 40 mm", manufacturer: "Krones", unitCost: 4100, quantityOnHand: 0, minStock: 2, binLocation: "E1-01", leadTimeDays: 21 },
    ].map((d) => prisma.part.create({ data: { ...d, organizationId: org.id } })),
  );

  const delEtterNummer = new Map(deler.map((d) => [d.number, d]));
  const del = (nr: string) => {
    const d = delEtterNummer.get(nr);
    if (!d) throw new Error(`Ukjent del i testdata: ${nr}`);
    return d;
  };

  // Hvilke deler hører til hvilket utstyr
  await prisma.assetPart.createMany({
    data: [
      { assetId: p101.id, partId: del("LAG-6308").id, quantity: 2 },
      { assetId: p101.id, partId: del("PAK-P101").id, quantity: 1 },
      { assetId: p102.id, partId: del("LAG-6308").id, quantity: 2 },
      { assetId: p102.id, partId: del("PAK-P101").id, quantity: 1 },
      { assetId: komp301.id, partId: del("FIL-LUFT").id, quantity: 1 },
      { assetId: komp301.id, partId: del("FIL-OLJE").id, quantity: 1 },
      { assetId: komp301.id, partId: del("OLJ-VG46").id, quantity: 1 },
      { assetId: kj201.id, partId: del("REM-A45").id, quantity: 2 },
      { assetId: pl402.id, partId: del("PAK-DUS40").id, quantity: 24 },
      { assetId: pl403.id, partId: del("LAG-6205").id, quantity: 4 },
      { assetId: trf501.id, partId: del("SEN-PT100").id, quantity: 3 },
      { assetId: agg502.id, partId: del("SIK-C16").id, quantity: 1 },
    ],
  });

  // Startbeholdning som lagerbevegelse, slik at reskontroen stemmer
  await prisma.stockMovement.createMany({
    data: deler
      .filter((d) => Number(d.quantityOnHand) > 0)
      .map((d) => ({
        organizationId: org.id,
        partId: d.id,
        type: "INN" as const,
        quantity: Number(d.quantityOnHand),
        unitCost: d.unitCost,
        note: "Registrert startbeholdning",
        createdAt: dagerSiden(540),
      })),
  });

  console.log(`Opprettet ${deler.length} reservedeler`);

  // ─── Arbeidsordre ────────────────────────────────────────

  let løpenummer = 0;

  type OrdreMal = {
    tittel: string;
    beskrivelse?: string;
    løsning?: string;
    feilkode?: string;
    utstyr?: { id: string };
    type?: "KORREKTIV" | "FOREBYGGENDE" | "INSPEKSJON" | "FORBEDRING";
    status?: "MELDT" | "GODKJENT" | "PLANLAGT" | "PAAGAAR" | "VENTER_DELER" | "UTFORT" | "LUKKET" | "AVVIST";
    prioritet?: "KRITISK" | "HOY" | "NORMAL" | "LAV";
    dagerSiden: number;
    nedetid?: number;
    timer?: { bruker: { id: string; hourlyRate: unknown }; antall: number }[];
    deler?: { nummer: string; antall: number }[];
    planlagtOm?: number;
    tildelt?: { id: string };
  };

  async function lagOrdre(m: OrdreMal) {
    løpenummer += 1;
    const opprettet = dagerSiden(m.dagerSiden);
    const status = m.status ?? "LUKKET";
    const erFerdig = ["UTFORT", "LUKKET"].includes(status);

    const ordre = await prisma.workOrder.create({
      data: {
        organizationId: org.id,
        number: løpenummer,
        title: m.tittel,
        description: m.beskrivelse,
        resolution: m.løsning,
        failureCode: m.feilkode,
        type: m.type ?? "KORREKTIV",
        status,
        priority: m.prioritet ?? "NORMAL",
        assetId: m.utstyr?.id,
        requestedById: (m.tildelt ?? teknikere[løpenummer % 3]).id,
        assignedToId: (m.tildelt ?? teknikere[løpenummer % 3]).id,
        downtimeMinutes: m.nedetid,
        createdAt: opprettet,
        startedAt: erFerdig || status === "PAAGAAR" ? opprettet : null,
        completedAt: erFerdig ? new Date(opprettet.getTime() + 6 * 3600_000) : null,
        closedAt: status === "LUKKET" ? new Date(opprettet.getTime() + 30 * 3600_000) : null,
        plannedDate: m.planlagtOm != null ? dagerFram(m.planlagtOm) : null,
        estimatedHours: m.timer?.reduce((s, t) => s + t.antall, 0) ?? 2,
      },
    });

    for (const t of m.timer ?? []) {
      await prisma.timeEntry.create({
        data: {
          organizationId: org.id,
          workOrderId: ordre.id,
          userId: t.bruker.id,
          workedOn: opprettet,
          hours: t.antall,
          hourlyRate: t.bruker.hourlyRate as never,
        },
      });
    }

    for (const d of m.deler ?? []) {
      const p = del(d.nummer);
      await prisma.partUsage.create({
        data: {
          organizationId: org.id,
          workOrderId: ordre.id,
          partId: p.id,
          quantity: d.antall,
          unitCost: p.unitCost,
        },
      });
      await prisma.stockMovement.create({
        data: {
          organizationId: org.id,
          partId: p.id,
          type: "UT",
          quantity: -d.antall,
          unitCost: p.unitCost,
          workOrderId: ordre.id,
          userId: (m.tildelt ?? teknikere[løpenummer % 3]).id,
          createdAt: opprettet,
        },
      });
    }

    return ordre;
  }

  // Gjentakende lagerhavari på kjølevannspumpene. Dette mønsteret er
  // hovedeksempelet assistenten skal kunne gjenkjenne.
  await lagOrdre({
    tittel: "Unormale rystelser på kjølevannspumpe P-101",
    beskrivelse:
      "Operatør meldte kraftig vibrasjon og ulyd fra pumpe P-101 under morgenskiftet. Vibrasjonsmåling viste 11,2 mm/s mot normalt 2,8 mm/s.",
    løsning:
      "Demonterte pumpe og fant kraftig slitasje i drivsidelager 6308. Lageret var tørrkjørt fordi smørenippelen var tettet igjen. Byttet begge lagre og akseltetning, renset smørekanal og etterfylte fett. Vibrasjon etter jobb: 2,4 mm/s. Anbefaler å legge smøring inn som fast rutine hver 3. måned.",
    feilkode: "LAGERSKADE",
    utstyr: p101,
    prioritet: "KRITISK",
    dagerSiden: 412,
    nedetid: 310,
    timer: [{ bruker: tekniker1, antall: 5.5 }, { bruker: tekniker2, antall: 3 }],
    deler: [{ nummer: "LAG-6308", antall: 2 }, { nummer: "PAK-P101", antall: 1 }],
  });

  await lagOrdre({
    tittel: "Vibrasjon og varmgang på P-102",
    beskrivelse:
      "Samme symptom som på søsterpumpa i fjor. Lagerhus målte 78 °C, vibrasjon 9,4 mm/s.",
    løsning:
      "Lagerskade på drivside, samme årsak som på P-101: manglende smøring. Byttet lager 6308 x2. Smørerutine er nå lagt inn som forebyggende plan på begge pumpene.",
    feilkode: "LAGERSKADE",
    utstyr: p102,
    prioritet: "HOY",
    dagerSiden: 233,
    nedetid: 240,
    timer: [{ bruker: tekniker2, antall: 4.5 }],
    deler: [{ nummer: "LAG-6308", antall: 2 }],
  });

  await lagOrdre({
    tittel: "Lekkasje ved akseltetning P-101",
    beskrivelse: "Dryppende lekkasje under pumpehus, ca. 2 dl per time.",
    løsning:
      "Akseltetning slitt. Byttet tetning og kontrollerte akselslag — innenfor toleranse. Lekkasje borte.",
    feilkode: "LEKKASJE",
    utstyr: p101,
    prioritet: "NORMAL",
    dagerSiden: 96,
    nedetid: 120,
    timer: [{ bruker: tekniker1, antall: 3 }],
    deler: [{ nummer: "PAK-P101", antall: 1 }],
  });

  await lagOrdre({
    tittel: "Kompressor stopper på høy temperatur",
    beskrivelse:
      "KOMP-301 slår seg ut på alarm «element outlet temperature high» etter ca. 40 minutters drift.",
    løsning:
      "Oljekjøler var tilstoppet av støv og oljefilteret var over anbefalt levetid. Renset kjøler med trykkluft, byttet olje- og luftfilter samt olje. Temperaturen stabiliserte seg på 78 °C. Merk: kjøleren bør renses hver 6. måned i dette miljøet.",
    feilkode: "OVEROPPHETING",
    utstyr: komp301,
    prioritet: "KRITISK",
    dagerSiden: 178,
    nedetid: 195,
    timer: [{ bruker: tekniker3, antall: 6 }],
    deler: [{ nummer: "FIL-OLJE", antall: 1 }, { nummer: "FIL-LUFT", antall: 1 }, { nummer: "OLJ-VG46", antall: 1 }],
  });

  await lagOrdre({
    tittel: "Kompressor går varm igjen",
    beskrivelse: "Samme alarm som i vinter. Temperatur kryper opp mot 95 °C.",
    løsning:
      "Oljekjøleren var igjen full av støv. Rensing løste det på under en time. Har foreslått å øke rensefrekvensen til hver 4. måned og montere forfilter på kjøleluftinntaket.",
    feilkode: "OVEROPPHETING",
    utstyr: komp301,
    prioritet: "HOY",
    dagerSiden: 47,
    nedetid: 65,
    timer: [{ bruker: tekniker3, antall: 1.5 }],
  });

  await lagOrdre({
    tittel: "Fyllemaskin gir ujevn fyllemengde",
    beskrivelse:
      "Avvik opptil 12 ml mellom hoder på PL-402. Kvalitetskontroll stoppet linja.",
    løsning:
      "Tre fylledyser var delvis tilstoppet av produktrester. Demonterte og renset alle 24 dyser, byttet to som var slitt i setet. Kalibrerte på nytt — avvik nå under 2 ml.",
    feilkode: "KALIBRERING",
    utstyr: pl402,
    prioritet: "HOY",
    dagerSiden: 128,
    nedetid: 420,
    timer: [{ bruker: tekniker2, antall: 7 }, { bruker: tekniker1, antall: 2 }],
  });

  await lagOrdre({
    tittel: "Etikettmaskin skjærer skjevt",
    beskrivelse: "Etiketter legger seg 3–4 mm skjevt på flaska.",
    løsning:
      "Slitasje i føringslager på matevalsen. Byttet fire lagre 6205 og justerte føringen. Etikettene ligger nå rett.",
    feilkode: "SLITASJE",
    utstyr: pl403,
    prioritet: "NORMAL",
    dagerSiden: 74,
    nedetid: 150,
    timer: [{ bruker: tekniker3, antall: 4 }],
    deler: [{ nummer: "LAG-6205", antall: 4 }],
  });

  await lagOrdre({
    tittel: "Kjøletårn gir dårlig kjøleeffekt",
    beskrivelse: "Returtemperatur 6 °C høyere enn normalt på varm dag.",
    løsning:
      "Vifterem var slakk og delvis oppsprukket. Byttet begge kilereimer og strammet etter innkjøring. Kjøleeffekt tilbake til normalt.",
    feilkode: "SLITASJE",
    utstyr: kj201,
    prioritet: "HOY",
    dagerSiden: 59,
    nedetid: 90,
    timer: [{ bruker: tekniker1, antall: 3.5 }],
    deler: [{ nummer: "REM-A45", antall: 2 }],
  });

  await lagOrdre({
    tittel: "Termografering av transformator T1",
    type: "INSPEKSJON",
    beskrivelse: "Årlig termografering av hovedtransformator og tilhørende tavle.",
    løsning:
      "Ingen varmgang påvist. Høyeste måling 41 °C på fase L2, godt innenfor grenseverdi. Neste kontroll om 12 måneder.",
    utstyr: trf501,
    prioritet: "NORMAL",
    dagerSiden: 205,
    timer: [{ bruker: tekniker1, antall: 2 }],
  });

  await lagOrdre({
    tittel: "Nødstrømsaggregat startet ikke ved prøvekjøring",
    beskrivelse: "Aggregatet dro ikke rundt ved månedlig test.",
    løsning:
      "Startbatteriene hadde falt under 10,5 V. Byttet begge batterier og kontrollerte ladekrets — laderen leverte kun 12,9 V og ble justert til 13,8 V.",
    feilkode: "ELEKTRISK",
    utstyr: agg502,
    prioritet: "HOY",
    dagerSiden: 152,
    timer: [{ bruker: tekniker2, antall: 3 }],
  });

  await lagOrdre({
    tittel: "Innmater stopper tilfeldig",
    beskrivelse: "PL-401 stopper 3–4 ganger per skift uten alarm.",
    løsning:
      "Løs kontakt i klemme X4 på motorvernet. Etterdro alle klemmer i tavla og byttet en kontaktor som hadde brente kontakter.",
    feilkode: "ELEKTRISK",
    utstyr: pl401,
    prioritet: "NORMAL",
    dagerSiden: 88,
    nedetid: 75,
    timer: [{ bruker: tekniker3, antall: 4 }],
    deler: [{ nummer: "KON-24V", antall: 1 }],
  });

  await lagOrdre({
    tittel: "Pallreiser går sakte",
    beskrivelse: "Løftesyklus tar 40 % lengre tid enn normalt.",
    løsning:
      "Hydraulikkslange hadde indre kollaps. Byttet slange og etterfylte olje.",
    feilkode: "SLITASJE",
    utstyr: pl404,
    prioritet: "LAV",
    dagerSiden: 39,
    nedetid: 60,
    timer: [{ bruker: tekniker1, antall: 2.5 }],
    deler: [{ nummer: "SLA-HYD25", antall: 1 }],
  });

  // ─── Åpne ordrer som gir noe å jobbe med i grensesnittet ──

  await lagOrdre({
    tittel: "Ulyd fra kjølevannspumpe P-101",
    beskrivelse:
      "Operatør melder om periodisk ulyd fra pumpa, særlig ved oppstart. Vibrasjonsmåling ikke utført ennå.",
    utstyr: p101,
    status: "MELDT",
    prioritet: "HOY",
    dagerSiden: 1,
    tildelt: tekniker1,
  });

  await lagOrdre({
    tittel: "Bytt dyser på fyllemaskin",
    beskrivelse: "To dyser viser begynnende slitasje ved siste kontroll.",
    utstyr: pl402,
    status: "VENTER_DELER",
    prioritet: "NORMAL",
    dagerSiden: 9,
    planlagtOm: 4,
    tildelt: tekniker2,
  });

  await lagOrdre({
    tittel: "Skift oljefilter på kompressor",
    type: "FOREBYGGENDE",
    beskrivelse: "Planlagt filterskift etter 4 000 driftstimer.",
    utstyr: komp301,
    status: "PLANLAGT",
    prioritet: "NORMAL",
    dagerSiden: 3,
    planlagtOm: 1,
    tildelt: tekniker3,
  });

  await lagOrdre({
    tittel: "Kontroller lekkasje ved kjøletårn",
    beskrivelse: "Vannsøl observert under tårnet.",
    utstyr: kj201,
    status: "PAAGAAR",
    prioritet: "NORMAL",
    dagerSiden: 2,
    tildelt: tekniker1,
  });

  await lagOrdre({
    tittel: "Månedlig prøvekjøring nødstrøm",
    type: "FOREBYGGENDE",
    utstyr: agg502,
    status: "PLANLAGT",
    prioritet: "NORMAL",
    dagerSiden: 1,
    planlagtOm: 2,
    tildelt: tekniker2,
  });

  await lagOrdre({
    tittel: "Smøring og vibrasjonsmåling P-102",
    type: "FOREBYGGENDE",
    utstyr: p102,
    status: "GODKJENT",
    prioritet: "NORMAL",
    dagerSiden: 5,
    planlagtOm: 3,
    tildelt: tekniker3,
  });

  await lagOrdre({
    tittel: "Rengjør kjøleluftinntak kompressorrom",
    type: "FOREBYGGENDE",
    beskrivelse: "Følger opp anbefalingen fra siste overopphetingssak.",
    utstyr: komp301,
    status: "PLANLAGT",
    prioritet: "HOY",
    dagerSiden: 4,
    planlagtOm: 0,
    tildelt: tekniker3,
  });

  await lagOrdre({
    tittel: "Kalibrer fyllemaskin",
    type: "FOREBYGGENDE",
    utstyr: pl402,
    status: "PLANLAGT",
    prioritet: "NORMAL",
    dagerSiden: 2,
    planlagtOm: 5,
    tildelt: tekniker2,
  });

  await lagOrdre({
    tittel: "Skift lysarmatur i lager B",
    beskrivelse: "Tre armaturer blinker.",
    status: "MELDT",
    prioritet: "LAV",
    dagerSiden: 6,
    tildelt: tekniker3,
  });

  await lagOrdre({
    tittel: "Forbedring: forfilter på kompressorinntak",
    type: "FORBEDRING",
    beskrivelse:
      "Monter forfilter for å redusere støvinntrengning i oljekjøleren. Forventes å halvere rensefrekvensen.",
    utstyr: komp301,
    status: "GODKJENT",
    prioritet: "NORMAL",
    dagerSiden: 12,
    planlagtOm: 6,
    tildelt: tekniker1,
  });

  // Fyll på med eldre, lukket historikk for statistikkens del
  const historiskeMaler = [
    { t: "Skiftet slitt kilerem", f: "SLITASJE", u: kj201, d: 300 },
    { t: "Justert endebryter på innmater", f: "MEKANISK", u: pl401, d: 268 },
    { t: "Byttet defekt temperaturføler", f: "ELEKTRISK", u: trf501, d: 246 },
    { t: "Renset kondensavløp på trykklufttørker", f: "TILSTOPPING", u: trk302, d: 221 },
    { t: "Etterdro klemmer i hovedtavle", f: "ELEKTRISK", u: trf501, d: 190 },
    { t: "Byttet pakning på pumpehus", f: "LEKKASJE", u: p102, d: 165 },
    { t: "Skiftet oljefilter etter plan", f: "PLANLAGT", u: komp301, d: 140 },
    { t: "Rettet opp skjev pallstabling", f: "MEKANISK", u: pl404, d: 118 },
    { t: "Byttet sikring etter kortslutning", f: "ELEKTRISK", u: agg502, d: 101 },
    { t: "Renset dyser på fyllemaskin", f: "TILSTOPPING", u: pl402, d: 83 },
    { t: "Justert etikettføring", f: "KALIBRERING", u: pl403, d: 66 },
    { t: "Smurte lager på kjøletårnvifte", f: "PLANLAGT", u: kj201, d: 51 },
    { t: "Byttet slitt matevalse", f: "SLITASJE", u: pl403, d: 34 },
    { t: "Kontrollerte vibrasjon på begge pumper", f: "PLANLAGT", u: p101, d: 22 },
  ];

  for (const h of historiskeMaler) {
    await lagOrdre({
      tittel: h.t,
      feilkode: h.f,
      utstyr: h.u,
      løsning: "Utført som beskrevet. Funksjon kontrollert og godkjent etter arbeidet.",
      dagerSiden: h.d,
      nedetid: h.f === "PLANLAGT" ? undefined : 30 + (h.d % 90),
      timer: [{ bruker: teknikere[h.d % 3], antall: 1 + (h.d % 4) }],
    });
  }

  // Løpenummeret må stå riktig, ellers krasjer neste ordre brukeren lager
  await prisma.counter.create({
    data: { organizationId: org.id, name: "workOrder", value: løpenummer },
  });

  console.log(`Opprettet ${løpenummer} arbeidsordre`);

  // ─── Forebyggende planer ─────────────────────────────────

  await Promise.all([
    prisma.pmPlan.create({
      data: {
        organizationId: org.id, assetId: p101.id, name: "Smøring og vibrasjonsmåling P-101",
        description: "Smør begge lagre og mål vibrasjon. Grenseverdi 4,5 mm/s.",
        trigger: "TID", intervalDays: 90, leadTimeDays: 7, estimatedHours: 1.5,
        assignedToId: tekniker1.id, lastDoneAt: dagerSiden(22), nextDueAt: dagerFram(68),
        checklist: ["Mål vibrasjon før smøring", "Smør drivside og fri side", "Mål vibrasjon etter", "Kontroller lekkasje", "Noter driftstimer"],
      },
    }),
    prisma.pmPlan.create({
      data: {
        organizationId: org.id, assetId: p102.id, name: "Smøring og vibrasjonsmåling P-102",
        trigger: "TID", intervalDays: 90, leadTimeDays: 7, estimatedHours: 1.5,
        assignedToId: tekniker3.id, lastDoneAt: dagerSiden(85), nextDueAt: dagerFram(5),
        checklist: ["Mål vibrasjon før smøring", "Smør begge lagre", "Mål vibrasjon etter"],
      },
    }),
    prisma.pmPlan.create({
      data: {
        organizationId: org.id, assetId: komp301.id, name: "Oljeskift kompressor",
        description: "Skift olje og oljefilter etter 4 000 driftstimer.",
        trigger: "DRIFTSTIMER", intervalHours: 4000, leadTimeDays: 14, estimatedHours: 3,
        assignedToId: tekniker3.id, lastDoneHours: 20000, lastDoneAt: dagerSiden(140),
        nextDueAt: dagerFram(12),
        checklist: ["Tapp gammel olje", "Bytt oljefilter", "Fyll ny olje", "Kontroller for lekkasje", "Nullstill timeteller"],
      },
    }),
    prisma.pmPlan.create({
      data: {
        organizationId: org.id, assetId: komp301.id, name: "Rens oljekjøler og bytt luftfilter",
        description: "Erfaringen fra to overopphetingssaker tilsier hver 4. måned i dette miljøet.",
        trigger: "TID", intervalDays: 120, leadTimeDays: 10, estimatedHours: 2,
        assignedToId: tekniker3.id, lastDoneAt: dagerSiden(47), nextDueAt: dagerFram(73),
        checklist: ["Rens oljekjøler med trykkluft", "Bytt luftfilter", "Kontroller temperatur etter 1 time drift"],
      },
    }),
    prisma.pmPlan.create({
      data: {
        organizationId: org.id, assetId: pl402.id, name: "Kalibrering fyllemaskin",
        trigger: "TID", intervalDays: 30, leadTimeDays: 5, estimatedHours: 2,
        assignedToId: tekniker2.id, lastDoneAt: dagerSiden(26), nextDueAt: dagerFram(4),
        checklist: ["Mål fyllemengde på alle 24 hoder", "Juster avvik over 2 ml", "Loggfør resultat"],
      },
    }),
    prisma.pmPlan.create({
      data: {
        organizationId: org.id, assetId: kj201.id, name: "Rengjøring og kontroll kjøletårn",
        trigger: "TID", intervalDays: 180, leadTimeDays: 14, estimatedHours: 4,
        assignedToId: tekniker1.id, lastDoneAt: dagerSiden(51), nextDueAt: dagerFram(129),
        checklist: ["Spyl fyllmasse", "Kontroller kilereimer", "Sjekk vannbehandling", "Kontroller vifteopplagring"],
      },
    }),
    prisma.pmPlan.create({
      data: {
        organizationId: org.id, assetId: trf501.id, name: "Årlig termografering",
        trigger: "TID", intervalDays: 365, leadTimeDays: 30, estimatedHours: 2,
        assignedToId: tekniker1.id, lastDoneAt: dagerSiden(205), nextDueAt: dagerFram(160),
        checklist: ["Termografer transformator", "Termografer hovedtavle", "Dokumenter med bilder"],
      },
    }),
    prisma.pmPlan.create({
      data: {
        organizationId: org.id, assetId: agg502.id, name: "Månedlig prøvekjøring nødstrøm",
        trigger: "TID", intervalDays: 30, leadTimeDays: 3, estimatedHours: 1,
        assignedToId: tekniker2.id, lastDoneAt: dagerSiden(28), nextDueAt: dagerFram(2),
        checklist: ["Start aggregat", "Kjør 30 min med last", "Kontroller batterispenning", "Kontroller drivstoffnivå"],
      },
    }),
    prisma.pmPlan.create({
      data: {
        organizationId: org.id, assetId: trk302.id, name: "Kontroll av kondensavløp",
        trigger: "TID", intervalDays: 90, leadTimeDays: 7, estimatedHours: 0.5,
        assignedToId: tekniker3.id, lastDoneAt: dagerSiden(221), nextDueAt: dagerSiden(131),
        checklist: ["Kontroller avløp", "Rens filter", "Test automatisk tømming"],
      },
    }),
  ]);

  console.log("Opprettet 9 forebyggende planer");

  // ─── Budsjett ────────────────────────────────────────────

  await prisma.budget.createMany({
    data: [
      { organizationId: org.id, name: "Produksjon 2026", year: 2026, category: "TOTALT", amount: 1850000, costCenterId: ksProduksjon.id },
      { organizationId: org.id, name: "Teknisk drift 2026", year: 2026, category: "TOTALT", amount: 1200000, costCenterId: ksTeknisk.id },
      { organizationId: org.id, name: "Bygg og infrastruktur 2026", year: 2026, category: "TOTALT", amount: 640000, costCenterId: ksBygg.id },
      { organizationId: org.id, name: "Arbeid produksjon 2026", year: 2026, category: "ARBEID", amount: 1100000, costCenterId: ksProduksjon.id },
      { organizationId: org.id, name: "Deler produksjon 2026", year: 2026, category: "DELER", amount: 620000, costCenterId: ksProduksjon.id },
      { organizationId: org.id, name: "Arbeid teknisk 2026", year: 2026, category: "ARBEID", amount: 780000, costCenterId: ksTeknisk.id },
      { organizationId: org.id, name: "Deler teknisk 2026", year: 2026, category: "DELER", amount: 380000, costCenterId: ksTeknisk.id },
    ],
  });

  // ─── Bestillinger ────────────────────────────────────────
  // Tre bestillinger i hver sin fase, slik at modulen viser noe fra start.

  let bestillingsnummer = 0;

  async function lagBestilling(m: {
    leverandor: { id: string };
    linjer: { nummer: string; antall: number; mottatt?: number }[];
    status: "UTKAST" | "SENDT" | "DELVIS_MOTTATT" | "MOTTATT";
    dagerSidenOpprettet: number;
    referanse?: string;
    notat?: string;
    sendtTil?: string;
  }) {
    bestillingsnummer += 1;
    const opprettet = dagerSiden(m.dagerSidenOpprettet);
    const erSendt = m.status !== "UTKAST";

    return prisma.purchaseOrder.create({
      data: {
        organizationId: org.id,
        number: bestillingsnummer,
        supplierId: m.leverandor.id,
        createdById: planlegger.id,
        status: m.status,
        reference: m.referanse,
        note: m.notat,
        createdAt: opprettet,
        expectedAt: erSendt ? dagerSiden(m.dagerSidenOpprettet - 14) : null,
        sentAt: erSendt ? new Date(opprettet.getTime() + 3600_000) : null,
        sentToEmail: erSendt ? (m.sendtTil ?? null) : null,
        sentMethod: erSendt ? "manuell" : null,
        receivedAt: m.status === "MOTTATT" ? dagerSiden(m.dagerSidenOpprettet - 12) : null,
        lines: {
          create: m.linjer.map((l) => {
            const d = del(l.nummer);
            return {
              partId: d.id,
              quantity: l.antall,
              unitCost: d.unitCost,
              receivedQuantity: l.mottatt ?? 0,
            };
          }),
        },
      },
    });
  }

  await lagBestilling({
    leverandor: ahlsell,
    status: "MOTTATT",
    dagerSidenOpprettet: 60,
    referanse: "REK-2026-0412",
    sendtTil: "ordre@ahlsell.eksempel.no",
    linjer: [
      { nummer: "LAG-6205", antall: 8, mottatt: 8 },
      { nummer: "SIK-C16", antall: 10, mottatt: 10 },
    ],
  });

  await lagBestilling({
    leverandor: atlas,
    status: "DELVIS_MOTTATT",
    dagerSidenOpprettet: 21,
    referanse: "REK-2026-0455",
    notat: "Send gjerne oljen samlet med filtrene.",
    sendtTil: "service@atlascopco.eksempel.no",
    linjer: [
      { nummer: "FIL-LUFT", antall: 4, mottatt: 4 },
      { nummer: "OLJ-VG46", antall: 2, mottatt: 0 },
    ],
  });

  await lagBestilling({
    leverandor: tess,
    status: "UTKAST",
    dagerSidenOpprettet: 2,
    linjer: [{ nummer: "SLA-HYD25", antall: 4 }],
  });

  await prisma.counter.create({
    data: { organizationId: org.id, name: "purchaseOrder", value: bestillingsnummer },
  });

  console.log(`Opprettet ${bestillingsnummer} bestillinger`);

  // ─── Standard dashbord ───────────────────────────────────

  await prisma.dashboard.create({
    data: {
      organizationId: org.id,
      name: "Driftsoversikt",
      isDefault: true,
      layout: [
        { id: "w1", type: "apne-ordrer", w: 1 },
        { id: "w2", type: "kritiske-ordrer", w: 1 },
        { id: "w3", type: "forfalt-pm", w: 1 },
        { id: "w4", type: "lav-beholdning", w: 1 },
        { id: "w5", type: "ordrer-per-status", w: 2 },
        { id: "w6", type: "kostnad-per-maaned", w: 2 },
        { id: "w7", type: "nedetid-per-utstyr", w: 2 },
        { id: "w8", type: "mine-jobber", w: 2 },
      ],
    },
  });

  // ─────────────────────────────────────────────────────────
  // Organisasjon 2 — finnes for å bevise at data er adskilt.
  // Logger du inn her skal du ikke se noe som helst fra Nordvik.
  // ─────────────────────────────────────────────────────────

  const org2 = await prisma.organization.create({
    data: { slug: "fjordkraft", name: "Fjordkraft Vedlikehold AS", hourlyRate: 890 },
  });

  const bruker2 = await prisma.user.create({
    data: {
      organizationId: org2.id,
      email: "post@fjordkraft.no",
      name: "Ingrid Solheim",
      role: "ADMIN",
      passwordHash: passordHash,
    },
  });

  const anlegg2 = await prisma.asset.create({
    data: {
      organizationId: org2.id, type: "ANLEGG", code: "BERGEN",
      name: "Kraftstasjon Bergen", criticality: 5, depth: 0, path: "",
    },
  });
  await prisma.asset.update({ where: { id: anlegg2.id }, data: { path: `/${anlegg2.id}` } });

  const turbin = await prisma.asset.create({
    data: {
      organizationId: org2.id, parentId: anlegg2.id, type: "UTSTYR", code: "TUR-1",
      name: "Turbin 1", criticality: 5, depth: 1, path: `/${anlegg2.id}`,
    },
  });
  await prisma.asset.update({ where: { id: turbin.id }, data: { path: `/${anlegg2.id}/${turbin.id}` } });

  await prisma.workOrder.create({
    data: {
      organizationId: org2.id, number: 1, title: "Årlig revisjon turbin 1",
      type: "FOREBYGGENDE", status: "PLANLAGT", priority: "HOY",
      assetId: turbin.id, requestedById: bruker2.id, assignedToId: bruker2.id,
      plannedDate: dagerFram(10),
    },
  });
  await prisma.counter.create({
    data: { organizationId: org2.id, name: "workOrder", value: 1 },
  });

  console.log(`Opprettet ${org2.name} (for å teste dataadskillelse)`);

  const standardPassord = passord === "passord123";

  console.log("\n─────────────────────────────────────────────");
  console.log("Testdata er lagt inn. Logg inn med:");
  console.log(`  admin@nordvik.no       (Administrator)`);
  console.log(`  leder@nordvik.no       (Leder)`);
  console.log(`  planlegger@nordvik.no  (Planlegger)`);
  console.log(`  morten@nordvik.no      (Tekniker)`);
  console.log(`  post@fjordkraft.no     (annet firma)`);
  console.log(`\n  Passord: ${passord}`);

  if (standardPassord) {
    console.log(
      "\n  ⚠  Dette passordet står i koden og er kjent for alle som har lest\n" +
        "     den. Greit til utprøving på egen maskin — men skal systemet\n" +
        "     brukes av folk, sett SEED_PASSWORD, eller bytt passordene under\n" +
        "     Innstillinger etter innlogging.",
    );
  }
  console.log("─────────────────────────────────────────────\n");

  // Unngå ubrukt-variabel-advarsler for brukere som kun finnes i testdataene
  void admin;
  void leder;
  void planlegger;
}

main()
  .catch((e) => {
    console.error("Feil under innlegging av testdata:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
