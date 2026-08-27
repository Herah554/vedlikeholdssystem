import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { opprettBedrift } from "@/lib/bedrift";
import { STANDARD_OPPSETT } from "@/components/widget-katalog";
import type { Priority, WorkOrderStatus } from "@/generated/prisma/client";

/**
 * Bygger en ferdig utfylt demobedrift.
 *
 * Et tomt system sier ingenting om hva det kan. Skal noen vurdere å kjøpe
 * dette, må de se et anlegg som ligner sitt eget: jobber i alle statuser,
 * deler som har gått under minimum, forebyggende vedlikehold som har forfalt,
 * og tall som beveger seg over året.
 *
 * Bedriften er en helt vanlig kunde i systemet. Den har sin egen
 * organisasjon og ser ikke noe fra de andre, akkurat som alle andre. Skal
 * den bort, deaktiverer du den fra plattformsiden.
 */

/**
 * Tilfeldighet som gjentar seg.
 *
 * En demobedrift skal se levende ut, men to kjøringer bør gi samme resultat
 * så lenge man ikke endrer koden. Det gjør feilsøking mulig — med
 * Math.random ville ingen kunne gjenskape et rart tilfelle.
 */
function terning(fro: number) {
  let tilstand = fro;
  return () => {
    tilstand = (tilstand * 1664525 + 1013904223) % 4294967296;
    return tilstand / 4294967296;
  };
}

const rull = terning(20260819);

function velg<T>(liste: readonly T[]): T {
  return liste[Math.floor(rull() * liste.length)];
}

function heltall(fra: number, til: number): number {
  return fra + Math.floor(rull() * (til - fra + 1));
}

/** Dato et gitt antall dager tilbake, med litt spredning på klokkeslettet. */
function dagerSiden(dager: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - dager);
  d.setHours(heltall(6, 18), heltall(0, 59), 0, 0);
  return d;
}

const AARSAKER = [
  { code: "LAGERSKADE", name: "Skadet lager", description: "Slitasje, feil montering eller manglende smøring" },
  { code: "LEKKASJE", name: "Lekkasje", description: "Olje, vann eller trykkluft" },
  { code: "ELEKTRISK", name: "Elektrisk feil", description: "Bryter, kabel, sensor eller styring" },
  { code: "SLITASJE", name: "Normal slitasje", description: "Delen har nådd levetiden sin" },
  { code: "BETJENING", name: "Feil betjening", description: "Utstyret ble brukt utenfor forutsetningene" },
  { code: "UKJENT", name: "Ukjent", description: "Årsaken ble ikke funnet" },
];

const UTSTYR = [
  { code: "PU-101", name: "Matepumpe 1", produsent: "Grundfos", kritikk: 5 },
  { code: "PU-102", name: "Matepumpe 2", produsent: "Grundfos", kritikk: 4 },
  { code: "KO-201", name: "Skruekompressor", produsent: "Atlas Copco", kritikk: 5 },
  { code: "TR-310", name: "Hovedtransportbånd", produsent: "Habasit", kritikk: 5 },
  { code: "TR-311", name: "Sidetransportbånd", produsent: "Habasit", kritikk: 2 },
  { code: "VE-420", name: "Avtrekksvifte", produsent: "Systemair", kritikk: 3 },
  { code: "TA-510", name: "Prosesstank", produsent: "Alfa Laval", kritikk: 4 },
  { code: "TR-600", name: "Truck", produsent: "Toyota", kritikk: 2 },
];

const DELER = [
  { number: "LAG-6205", name: "Kulelager 6205-2RS", enhet: "stk", pris: 189, min: 8, produsent: "SKF" },
  { number: "LAG-6308", name: "Kulelager 6308-2Z", enhet: "stk", pris: 412, min: 4, produsent: "SKF" },
  { number: "REM-A72", name: "Kilerem A72", enhet: "stk", pris: 245, min: 6, produsent: "Optibelt" },
  { number: "FIL-OLJE", name: "Oljefilter kompressor", enhet: "stk", pris: 690, min: 4, produsent: "Atlas Copco" },
  { number: "FIL-LUFT", name: "Luftfilter", enhet: "stk", pris: 520, min: 3, produsent: "Atlas Copco" },
  { number: "PAK-50", name: "Pakning DN50", enhet: "stk", pris: 95, min: 20, produsent: "Klinger" },
  { number: "OLJ-46", name: "Hydraulikkolje ISO 46", enhet: "liter", pris: 78, min: 60, produsent: "Statoil" },
  { number: "SMO-EP2", name: "Smørefett EP2", enhet: "patron", pris: 145, min: 10, produsent: "Mobil" },
  { number: "SEN-PT100", name: "Temperatursensor PT100", enhet: "stk", pris: 1250, min: 2, produsent: "Endress+Hauser" },
  { number: "KON-24V", name: "Kontaktor 24V", enhet: "stk", pris: 890, min: 3, produsent: "Siemens" },
];

const FEIL = [
  { tittel: "Unormal lyd fra pumpe", løsning: "Byttet lager på drivsiden og etterfylte smørefett. Vibrasjon målt til 2,1 mm/s etterpå, mot 7,8 før." },
  { tittel: "Oljelekkasje under kompressor", løsning: "Pakning på oljefilterhuset var sprukket. Byttet pakning og filter, etterfylte olje." },
  { tittel: "Transportbånd stopper tilfeldig", løsning: "Nødstoppsløyfa hadde en løs klemme i koblingsboksen. Strammet og merket." },
  { tittel: "Vifte gir for lite luft", løsning: "Kilerem var slakk og delvis slitt. Byttet rem og justerte stramming." },
  { tittel: "Temperaturalarm på tank", løsning: "PT100-føler viste 12 grader for høyt. Byttet føler og kalibrerte." },
  { tittel: "Truck starter ikke", løsning: "Batteripolene var korroderte. Rengjorde og smurte polene." },
  { tittel: "Vibrasjon i båndmotor", løsning: "Ett av festeboltene hadde løsnet. Strammet alle fire og satte på låsevæske." },
  { tittel: "Kompressor går varm", løsning: "Kjøleribbene var tette av støv. Blåste rene og la inn kvartalsvis rengjøring i planen." },
];

/**
 * Avvik som ligner på det et virkelig anlegg melder.
 *
 * Blandingen er med vilje: noen nestenulykker, noe kvalitet, ett miljøavvik.
 * Et demosystem der alle avvik er lukket og pene sier ingenting om hva
 * systemet er til for.
 */
const AVVIK = [
  {
    title: "Nesten truffet av last fra truck ved port 2",
    description:
      "Sto ved pakkelinja da trucken rygget ut fra port 2 uten å tute. Lasten svingte ut og passerte omtrent en halv meter fra meg. Ingen kom til skade.",
    type: "NAERULYKKE" as const,
    severity: "HOY" as const,
    location: "Port 2, lager",
    immediateAction: "Stoppet trucken og snakket med sjåføren. Sperret av området.",
    rootCause:
      "Trucken har ingen sikt mot porten, og det finnes verken speil eller lyssignal. Dette har vært meldt muntlig før uten at noe ble gjort.",
    correctiveAction:
      "Montert speil ved port 2 og malt opp gangfelt. Tatt opp på HMS-møtet.",
    status: "LUKKET" as const,
  },
  {
    title: "Oljesøl fra kompressor rant mot sluk",
    description:
      "Oppdaget en pøl olje under kompressoren ved morgenrunden. Sporet gikk mot sluket i gulvet.",
    type: "MILJO" as const,
    severity: "MIDDELS" as const,
    location: "Kompressorrom",
    immediateAction: "La ut absorbent og tettet sluket med matte.",
    rootCause: "Pakning på oljefilterhuset var sprukket.",
    correctiveAction:
      "Byttet pakning. Lagt inn kvartalsvis kontroll av pakninger i vedlikeholdsplanen.",
    status: "LUKKET" as const,
  },
  {
    title: "Manglende vern på transportbånd",
    description:
      "Vernet over drivvalsen på TR-310 sto åpent. Ingen visste hvor lenge det hadde vært slik.",
    type: "HMS" as const,
    severity: "KRITISK" as const,
    location: "Pakkelinje",
    immediateAction: "Stanset båndet og hengte opp lapp om at det ikke skal startes.",
    rootCause: null,
    correctiveAction: null,
    status: "UNDER_BEHANDLING" as const,
  },
  {
    title: "Feil merking på ferdigvarepall",
    description:
      "Pall merket med feil batchnummer. Oppdaget før utsending, men etter at pallen var registrert ut av lageret.",
    type: "KVALITET" as const,
    severity: "MIDDELS" as const,
    location: "Ferdigvarelager",
    immediateAction: "Trakk pallen tilbake og merket den på nytt.",
    rootCause: null,
    correctiveAction: null,
    status: "MELDT" as const,
  },
  {
    title: "Snublet i løs gulvrist",
    description:
      "Gulvristen ved trappa ligger løst og vipper når man tråkker på hjørnet. Snublet, men tok meg for.",
    type: "HMS" as const,
    severity: "LAV" as const,
    location: "Trapp mot kontrollrom",
    immediateAction: null,
    rootCause: "Festebolt mangler i ett hjørne.",
    correctiveAction: "Bestilt ny bolt. Rist sikret midlertidig med strips.",
    status: "TILTAK_IVERKSATT" as const,
  },
  {
    title: "Støvutvikling ved sliping uten avsug",
    description:
      "Sliping av sveis på tanken uten at avsuget var koblet til. Rommet ble fullt av støv.",
    type: "HMS" as const,
    severity: "MIDDELS" as const,
    location: "Verksted",
    immediateAction: "Stoppet arbeidet og luftet ut.",
    rootCause: null,
    correctiveAction: null,
    status: "MELDT" as const,
  },
];

type NyBruker = {
  navn: string;
  epost: string;
  rolle: "ADMIN" | "LEDER" | "PLANLEGGER" | "DELELAGER" | "TEKNIKER" | "GJEST";
};

const BRUKERE: NyBruker[] = [
  { navn: "Ingrid Berg", epost: "leder@demo.no", rolle: "LEDER" },
  { navn: "Petter Lund", epost: "planlegger@demo.no", rolle: "PLANLEGGER" },
  { navn: "Siri Haugen", epost: "lager@demo.no", rolle: "DELELAGER" },
  { navn: "Jonas Vik", epost: "tekniker@demo.no", rolle: "TEKNIKER" },
  { navn: "Mona Sæther", epost: "tekniker2@demo.no", rolle: "TEKNIKER" },
];

export type Demobedrift = {
  organisasjonId: string;
  navn: string;
  innlogging: string;
  passord: string;
};

/**
 * Oppretter demobedriften og fyller den med data.
 *
 * Passordet lages her og returneres én gang. Det lagres bare som hash, så
 * det finnes ikke noe sted å slå det opp senere — den som oppretter
 * bedriften må skrive det ned.
 */
export async function opprettDemobedrift(): Promise<Demobedrift> {
  const merke = new Date().toISOString().slice(2, 10).replace(/-/g, "");
  const passord = `demo-${merke}`;
  const firmanavn = `Demo Mekaniske AS (${merke})`;

  const { org, bruker: admin } = await opprettBedrift({
    firma: firmanavn,
    navn: "Demo Administrator",
    email: `admin+${merke}@demo.no`,
    password: passord,
    orgNumber: "999888777",
  });

  const orgId = org.id;
  const hash = await hashPassword(passord);

  // Demoen skal vise alt systemet kan, ellers er den ikke verdt å vise fram.
  await prisma.organization.update({
    where: { id: orgId },
    data: { plan: "PRO" },
  });

  // ── Brukere i alle roller ────────────────────────────────────
  const brukere = [admin];
  for (const b of BRUKERE) {
    brukere.push(
      await prisma.user.create({
        data: {
          organizationId: orgId,
          name: b.navn,
          email: b.epost.replace("@", `+${merke}@`),
          role: b.rolle,
          passwordHash: hash,
          hourlyRate: b.rolle === "TEKNIKER" ? 850 : null,
        },
      }),
    );
  }

  const teknikere = brukere.filter((b) => b.role === "TEKNIKER");
  const planlegger = brukere.find((b) => b.role === "PLANLEGGER") ?? admin;

  // ── Årsaker ─────────────────────────────────────────────────
  await prisma.failureCause.createMany({
    data: AARSAKER.map((a, i) => ({ ...a, organizationId: orgId, sortOrder: i })),
  });

  // ── Kostnadssteder og budsjett ──────────────────────────────
  const kostnadssteder = await Promise.all(
    [
      { code: "PROD", name: "Produksjon" },
      { code: "BYGG", name: "Bygg og infrastruktur" },
    ].map((k) =>
      prisma.costCenter.create({ data: { ...k, organizationId: orgId } }),
    ),
  );

  const aar = new Date().getFullYear();
  await prisma.budget.createMany({
    data: kostnadssteder.flatMap((k) => [
      {
        organizationId: orgId,
        costCenterId: k.id,
        name: `${k.name} ${aar}`,
        year: aar,
        category: "TOTALT" as const,
        amount: k.code === "PROD" ? 1_450_000 : 380_000,
      },
    ]),
  });

  // ── Anleggsstruktur ─────────────────────────────────────────
  const anlegg = await prisma.asset.create({
    data: {
      organizationId: orgId,
      type: "ANLEGG",
      code: "ANL-1",
      name: "Produksjonsanlegg Sør",
      location: "Bergen",
      criticality: 5,
      costCenterId: kostnadssteder[0].id,
    },
  });
  await prisma.asset.update({
    where: { id: anlegg.id },
    data: { path: `/${anlegg.id}` },
  });

  const systemer = [];
  for (const [i, s] of [
    { code: "SYS-PUMPE", name: "Pumpesystem" },
    { code: "SYS-TRANS", name: "Transportsystem" },
  ].entries()) {
    const sys = await prisma.asset.create({
      data: {
        organizationId: orgId,
        parentId: anlegg.id,
        depth: 1,
        type: "SYSTEM",
        code: s.code,
        name: s.name,
        criticality: 4,
        costCenterId: kostnadssteder[i % 2].id,
      },
    });
    await prisma.asset.update({
      where: { id: sys.id },
      data: { path: `/${anlegg.id}/${sys.id}` },
    });
    systemer.push(sys);
  }

  const utstyr = [];
  for (const [i, u] of UTSTYR.entries()) {
    const forelder = systemer[i % systemer.length];
    const enhet = await prisma.asset.create({
      data: {
        organizationId: orgId,
        parentId: forelder.id,
        depth: 2,
        type: "UTSTYR",
        code: u.code,
        name: u.name,
        manufacturer: u.produsent,
        criticality: u.kritikk,
        // Ett stykke utstyr står med vilje stanset, slik at
        // statusfargene i grensesnittet faktisk viser forskjell.
        status: i === UTSTYR.length - 1 ? "STANSET" : "I_DRIFT",
        runningHours: heltall(1200, 18000),
        installedAt: dagerSiden(heltall(400, 2600)),
        purchaseCost: heltall(45, 900) * 1000,
        costCenterId: forelder.costCenterId,
      },
    });
    await prisma.asset.update({
      where: { id: enhet.id },
      data: { path: `${forelder.path}/${enhet.id}` },
    });
    utstyr.push(enhet);
  }

  // ── Leverandører og deler ───────────────────────────────────
  const leverandorer = await Promise.all(
    [
      { name: "Nordisk Lagerteknikk AS", contactName: "Bjørn Aas", email: "ordre@nordisklager.no", phone: "55 12 34 56" },
      { name: "Industrideler Vest", contactName: "Hanne Moe", email: "salg@idvest.no", phone: "55 98 76 54" },
      { name: "Teknisk Forsyning AS", contactName: "Ola Rud", email: "post@tekforsyning.no", phone: "22 44 66 88" },
    ].map((l) => prisma.supplier.create({ data: { ...l, organizationId: orgId } })),
  );

  const deler = [];
  for (const [i, d] of DELER.entries()) {
    // Tre deler legges bevisst under minimum, slik at bestillingssiden og
    // widgeten «Deler under minimum» har noe å vise.
    const underMinimum = i < 3;
    deler.push(
      await prisma.part.create({
        data: {
          organizationId: orgId,
          number: d.number,
          name: d.name,
          unit: d.enhet,
          unitCost: d.pris,
          minStock: d.min,
          maxStock: d.min * 3,
          quantityOnHand: underMinimum
            ? Math.max(0, d.min - heltall(2, 5))
            : d.min + heltall(2, 20),
          manufacturer: d.produsent,
          binLocation: `${String.fromCharCode(65 + (i % 4))}-${heltall(1, 9)}`,
          supplierId: leverandorer[i % leverandorer.length].id,
          leadTimeDays: heltall(3, 21),
        },
      }),
    );
  }

  // ── Arbeidsordre ────────────────────────────────────────────
  const STATUSER: { status: WorkOrderStatus; andel: number }[] = [
    { status: "MELDT", andel: 3 },
    { status: "GODKJENT", andel: 2 },
    { status: "PLANLAGT", andel: 4 },
    { status: "PAAGAAR", andel: 2 },
    { status: "VENTER_DELER", andel: 1 },
    { status: "UTFORT", andel: 4 },
    { status: "LUKKET", andel: 8 },
  ];

  const PRIORITETER: Priority[] = ["KRITISK", "HOY", "NORMAL", "NORMAL", "LAV"];
  const TYPER: string[] = ["KORREKTIV", "KORREKTIV", "FOREBYGGENDE", "INSPEKSJON", "FORBEDRING"];

  let nummer = 0;
  for (const { status, andel } of STATUSER) {
    for (let i = 0; i < andel; i += 1) {
      nummer += 1;
      const feil = velg(FEIL);
      const enhet = velg(utstyr);
      const avsluttet = status === "UTFORT" || status === "LUKKET";
      const meldt = dagerSiden(heltall(1, 300));

      await prisma.workOrder.create({
        data: {
          organizationId: orgId,
          number: nummer,
          title: `${feil.tittel} — ${enhet.name}`,
          description: `Meldt av operatør på skift. ${feil.tittel.toLowerCase()} ved ${enhet.code}.`,
          type: velg(TYPER),
          status,
          priority: velg(PRIORITETER),
          assetId: enhet.id,
          requestedById: velg(brukere).id,
          assignedToId:
            status === "MELDT" ? null : velg(teknikere).id,
          estimatedHours: heltall(1, 12),
          createdAt: meldt,
          plannedDate:
            status === "PLANLAGT" || status === "PAAGAAR"
              ? dagerSiden(heltall(-6, 3))
              : null,
          startedAt: avsluttet || status === "PAAGAAR" ? meldt : null,
          completedAt: avsluttet ? dagerSiden(heltall(1, 200)) : null,
          closedAt: status === "LUKKET" ? dagerSiden(heltall(1, 190)) : null,
          resolution: avsluttet ? feil.løsning : null,
          failureCode: avsluttet ? velg(AARSAKER).code : null,
          downtimeMinutes: avsluttet ? heltall(0, 480) : null,
        },
      });
    }
  }

  await prisma.counter.create({
    data: { organizationId: orgId, name: "workOrder", value: nummer },
  });

  // ── Forebyggende vedlikehold ────────────────────────────────
  for (const [i, u] of utstyr.slice(0, 5).entries()) {
    // Den første planen har med vilje forfalt, slik at widgeten «Forfalt
    // forebyggende» og ukeplanen har noe å vise fra dag én.
    const forfalt = i === 0;
    await prisma.pmPlan.create({
      data: {
        organizationId: orgId,
        assetId: u.id,
        name: `${i % 2 === 0 ? "Månedlig" : "Kvartalsvis"} kontroll ${u.name}`,
        description: "Visuell kontroll, smøring og måling av vibrasjon.",
        trigger: "TID",
        intervalDays: i % 2 === 0 ? 30 : 90,
        estimatedHours: heltall(1, 4),
        priority: i === 0 ? "HOY" : "NORMAL",
        assignedToId: velg(teknikere).id,
        lastDoneAt: dagerSiden(forfalt ? 60 : heltall(5, 25)),
        nextDueAt: forfalt ? dagerSiden(14) : dagerSiden(-heltall(3, 40)),
        checklist: [
          "Kontroller for lekkasje",
          "Smør lagerpunkter",
          "Mål vibrasjon og noter verdi",
          "Sjekk at vern er på plass",
        ],
      },
    });
  }

  // ── Avvik ───────────────────────────────────────────────────
  for (const [i, a] of AVVIK.entries()) {
    const lukket = a.status === "LUKKET";
    const skjedde = dagerSiden(heltall(3, 180));

    await prisma.deviation.create({
      data: {
        organizationId: orgId,
        number: i + 1,
        title: a.title,
        description: a.description,
        type: a.type,
        severity: a.severity,
        status: a.status,
        location: a.location,
        assetId: i % 2 === 0 ? velg(utstyr).id : null,
        occurredAt: skjedde,
        createdAt: skjedde,
        reportedById: velg(brukere).id,
        assignedToId: a.status === "MELDT" ? null : planlegger.id,
        immediateAction: a.immediateAction,
        rootCause: a.rootCause,
        correctiveAction: a.correctiveAction,
        // Ett avvik står med vilje over frist, slik at lista viser hvordan
        // det ser ut når noe har blitt liggende.
        deadline:
          a.status === "MELDT" ? null : dagerSiden(i === 2 ? 10 : -heltall(5, 30)),
        closedAt: lukket ? dagerSiden(heltall(1, 60)) : null,
      },
    });
  }

  await prisma.counter.create({
    data: { organizationId: orgId, name: "deviation", value: AVVIK.length },
  });

  // ── Delebehov teknikerne har meldt ──────────────────────────
  // Uten dette står delelagerets arbeidsliste tom i demoen, og det er
  // nettopp den lista som viser hva systemet gjør for en innkjøper.
  const apneOrdrer = await prisma.workOrder.findMany({
    where: {
      organizationId: orgId,
      status: { in: ["PAAGAAR", "VENTER_DELER", "PLANLAGT"] },
    },
    take: 5,
  });

  const BEHOV = [
    { note: "Lekker olje ved akseltetningen, må byttes før oppstart", urgent: true },
    { note: "Siste på lager gikk med i forrige jobb", urgent: false },
    { note: "Trenger to i reserve, denne ryker ofte", urgent: false },
  ];

  for (const [i, ordre] of apneOrdrer.slice(0, BEHOV.length).entries()) {
    await prisma.partRequest.create({
      data: {
        organizationId: orgId,
        workOrderId: ordre.id,
        partId: deler[(i + 3) % deler.length].id,
        quantity: heltall(1, 4),
        note: BEHOV[i].note,
        urgent: BEHOV[i].urgent,
        requestedById: velg(teknikere).id,
        createdAt: dagerSiden(heltall(1, 6)),
      },
    });
  }

  // Ett behov teknikeren ikke fant delenummeret på — det er den bunken som
  // krever at noen faktisk gjør noe, og den bør synes i demoen.
  if (apneOrdrer.length > 0) {
    await prisma.partRequest.create({
      data: {
        organizationId: orgId,
        workOrderId: apneOrdrer[0].id,
        description: "Akseltetning til matepumpa, den store på drivsiden",
        quantity: 1,
        note: "Fant den ikke i registeret, den er merket med gult",
        requestedById: velg(teknikere).id,
        createdAt: dagerSiden(2),
      },
    });
  }

    // ── Dashbord delt med hele firmaet ──────────────────────────
  await prisma.dashboard.create({
    data: {
      organizationId: orgId,
      userId: planlegger.id,
      name: "Driftsmøte mandag",
      layout: [
        { id: "d1", type: "kritiske-ordrer", w: 1, h: 1 },
        { id: "d2", type: "forfalt-pm", w: 1, h: 1 },
        { id: "d3", type: "lav-beholdning", w: 2, h: 1 },
        { id: "d4", type: "ordrer-per-status", w: 4, h: 2 },
        { id: "d5", type: "nedetid-per-utstyr", w: 2, h: 2 },
        { id: "d6", type: "kostnad-per-maaned", w: 2, h: 2 },
      ],
      shares: { create: [{ userId: null }] },
    },
  });

  // Organisasjonens felles utgangspunkt for nye brukere
  await prisma.dashboard.updateMany({
    where: { organizationId: orgId, userId: null },
    data: { layout: STANDARD_OPPSETT },
  });

  return {
    organisasjonId: orgId,
    navn: firmanavn,
    innlogging: `admin+${merke}@demo.no`,
    passord,
  };
}
