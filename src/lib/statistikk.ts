import { prisma } from "@/lib/prisma";
import { APNE_STATUSER } from "@/lib/domene";
import { toNumber } from "@/lib/format";
import type { TenantDb } from "@/lib/tenant";

/**
 * Delte spørringer for dashbord og rapporter.
 *
 * Kostnad regnes gjennomgående som timer × sats pluss deler × enhetspris,
 * hentet fra de historiske satsene som ble lagret på hver postering.
 * Da endrer ikke fjorårets tall seg selv om timeprisen justeres i år.
 */

export type Nokkeltall = {
  apneOrdrer: number;
  kritiskeOrdrer: number;
  forfalteOrdrer: number;
  forfaltePmPlaner: number;
  delerUnderMinimum: number;
  nedetidSiste30Dager: number;
  kostnadHittilIAr: number;
};

export async function hentNokkeltall(
  db: TenantDb,
  organizationId: string,
): Promise<Nokkeltall> {
  const nå = new Date();
  const tredveDagerSiden = new Date(nå.getTime() - 30 * 86400_000);
  const arsstart = new Date(nå.getFullYear(), 0, 1);

  const [
    apneOrdrer,
    kritiskeOrdrer,
    forfalteOrdrer,
    forfaltePmPlaner,
    deler,
    nedetid,
    timekost,
    delekost,
  ] = await Promise.all([
    db.workOrder.count({ where: { status: { in: APNE_STATUSER } } }),
    db.workOrder.count({
      where: { status: { in: APNE_STATUSER }, priority: "KRITISK" },
    }),
    db.workOrder.count({
      where: { status: { in: APNE_STATUSER }, dueDate: { lt: nå } },
    }),
    db.pmPlan.count({ where: { isActive: true, nextDueAt: { lt: nå } } }),
    // Postgres kan ikke sammenlikne to kolonner gjennom Prisma sitt vanlige
    // filter, så beholdning mot minimumsnivå gjøres med rå SQL.
    prisma.$queryRaw<{ antall: bigint }[]>`
      SELECT count(*) AS antall
      FROM parts
      WHERE "organizationId" = ${organizationId}
        AND "isActive" = true
        AND "quantityOnHand" < "minStock"
    `,
    db.workOrder.aggregate({
      _sum: { downtimeMinutes: true },
      where: { createdAt: { gte: tredveDagerSiden } },
    }),
    db.timeEntry.findMany({
      where: { workedOn: { gte: arsstart } },
      select: { hours: true, hourlyRate: true },
    }),
    db.partUsage.findMany({
      where: { createdAt: { gte: arsstart } },
      select: { quantity: true, unitCost: true },
    }),
  ]);

  const kostnadHittilIAr =
    timekost.reduce((s, t) => s + t.hours * toNumber(t.hourlyRate), 0) +
    delekost.reduce((s, d) => s + d.quantity * toNumber(d.unitCost), 0);

  return {
    apneOrdrer,
    kritiskeOrdrer,
    forfalteOrdrer,
    forfaltePmPlaner,
    delerUnderMinimum: Number(deler[0]?.antall ?? 0),
    nedetidSiste30Dager: nedetid._sum.downtimeMinutes ?? 0,
    kostnadHittilIAr,
  };
}

/** Antall arbeidsordre per status, til søylediagram. */
export async function ordrerPerStatus(db: TenantDb) {
  const rader = await db.workOrder.groupBy({
    by: ["status"],
    _count: { _all: true },
  });
  return rader.map((r) => ({ status: r.status, antall: r._count._all }));
}

/** Vedlikeholdskostnad per måned de siste tolv månedene. */
export async function kostnadPerManed(organizationId: string) {
  const rader = await prisma.$queryRaw<
    { maned: Date; arbeid: number; deler: number }[]
  >`
    WITH maneder AS (
      SELECT generate_series(
        date_trunc('month', now()) - interval '11 months',
        date_trunc('month', now()),
        interval '1 month'
      ) AS maned
    ),
    arbeid AS (
      SELECT date_trunc('month', "workedOn") AS maned,
             sum(hours * "hourlyRate") AS belop
      FROM time_entries
      WHERE "organizationId" = ${organizationId}
      GROUP BY 1
    ),
    deler AS (
      SELECT date_trunc('month', "createdAt") AS maned,
             sum(quantity * "unitCost") AS belop
      FROM part_usages
      WHERE "organizationId" = ${organizationId}
      GROUP BY 1
    )
    SELECT m.maned,
           coalesce(a.belop, 0)::float8 AS arbeid,
           coalesce(d.belop, 0)::float8 AS deler
    FROM maneder m
    LEFT JOIN arbeid a ON a.maned = m.maned
    LEFT JOIN deler d ON d.maned = m.maned
    ORDER BY m.maned
  `;

  return rader.map((r) => ({
    maned: new Intl.DateTimeFormat("nb-NO", { month: "short" }).format(r.maned),
    arbeid: Math.round(r.arbeid),
    deler: Math.round(r.deler),
  }));
}

/** Utstyret som har kostet mest nedetid det siste året. */
export async function nedetidPerUtstyr(organizationId: string, antall = 8) {
  return prisma.$queryRaw<
    { kode: string; navn: string; minutter: number; antallOrdrer: number }[]
  >`
    SELECT a.code AS kode,
           a.name AS navn,
           coalesce(sum(w."downtimeMinutes"), 0)::int AS minutter,
           count(w.id)::int AS "antallOrdrer"
    FROM work_orders w
    JOIN assets a ON a.id = w."assetId"
    WHERE w."organizationId" = ${organizationId}
      AND w."downtimeMinutes" IS NOT NULL
      AND w."createdAt" >= now() - interval '12 months'
    GROUP BY a.code, a.name
    ORDER BY minutter DESC
    LIMIT ${antall}
  `;
}

/** Kostnad per utstyr, brukt i rapporten «hva koster maskinene oss». */
export async function kostnadPerUtstyr(organizationId: string, antall = 15) {
  return prisma.$queryRaw<
    {
      id: string;
      kode: string;
      navn: string;
      arbeid: number;
      deler: number;
      antallOrdrer: number;
    }[]
  >`
    SELECT a.id,
           a.code AS kode,
           a.name AS navn,
           coalesce(t.belop, 0)::float8 AS arbeid,
           coalesce(p.belop, 0)::float8 AS deler,
           coalesce(o.antall, 0)::int AS "antallOrdrer"
    FROM assets a
    LEFT JOIN (
      SELECT w."assetId", sum(te.hours * te."hourlyRate") AS belop
      FROM time_entries te
      JOIN work_orders w ON w.id = te."workOrderId"
      WHERE te."organizationId" = ${organizationId}
      GROUP BY w."assetId"
    ) t ON t."assetId" = a.id
    LEFT JOIN (
      SELECT w."assetId", sum(pu.quantity * pu."unitCost") AS belop
      FROM part_usages pu
      JOIN work_orders w ON w.id = pu."workOrderId"
      WHERE pu."organizationId" = ${organizationId}
      GROUP BY w."assetId"
    ) p ON p."assetId" = a.id
    LEFT JOIN (
      SELECT "assetId", count(*) AS antall
      FROM work_orders
      WHERE "organizationId" = ${organizationId}
      GROUP BY "assetId"
    ) o ON o."assetId" = a.id
    WHERE a."organizationId" = ${organizationId}
      AND a.type = 'UTSTYR'
    ORDER BY (coalesce(t.belop, 0) + coalesce(p.belop, 0)) DESC
    LIMIT ${antall}
  `;
}

/**
 * Andel forebyggende arbeid som ble utført innen fristen.
 * Et vanlig styringstall: under 80 % betyr at planlagt vedlikehold
 * blir skjøvet unna til fordel for brannslukking.
 */
export async function pmEtterlevelse(db: TenantDb, organizationId: string) {
  const [totalt, iTide] = await Promise.all([
    db.workOrder.count({
      where: { type: "FOREBYGGENDE", status: { in: ["UTFORT", "LUKKET"] } },
    }),
    // Rå SQL går utenom flerklient-filteret, så organisasjonen må oppgis her.
    prisma.$queryRaw<{ antall: bigint }[]>`
      SELECT count(*) AS antall FROM work_orders
      WHERE "organizationId" = ${organizationId}
        AND type = 'FOREBYGGENDE'
        AND status IN ('UTFORT', 'LUKKET')
        AND ("dueDate" IS NULL OR "completedAt" <= "dueDate")
    `,
  ]);

  const antallITide = Number(iTide[0]?.antall ?? 0);
  return {
    totalt,
    iTide: antallITide,
    prosent: totalt === 0 ? 100 : Math.round((antallITide / totalt) * 100),
  };
}

/**
 * Budsjett mot faktisk forbruk per kostnadssted.
 *
 * Kostnaden knyttes til kostnadsstedet gjennom utstyret arbeidsordren gjelder.
 * Jobber uten utstyr havner derfor ikke på noe kostnadssted — de vises
 * separat som «ufordelt» i budsjettvisningen.
 */
export async function budsjettMotForbruk(organizationId: string, ar: number) {
  const fra = new Date(ar, 0, 1);
  const til = new Date(ar + 1, 0, 1);

  return prisma.$queryRaw<
    {
      id: string;
      kode: string;
      navn: string;
      budsjett: number;
      arbeid: number;
      deler: number;
    }[]
  >`
    SELECT c.id,
           c.code AS kode,
           c.name AS navn,
           coalesce(b.belop, 0)::float8 AS budsjett,
           coalesce(t.belop, 0)::float8 AS arbeid,
           coalesce(p.belop, 0)::float8 AS deler
    FROM cost_centers c
    LEFT JOIN (
      SELECT "costCenterId", sum(amount) AS belop
      FROM budgets
      WHERE "organizationId" = ${organizationId}
        AND year = ${ar}
        AND category = 'TOTALT'
      GROUP BY "costCenterId"
    ) b ON b."costCenterId" = c.id
    LEFT JOIN (
      SELECT a."costCenterId", sum(te.hours * te."hourlyRate") AS belop
      FROM time_entries te
      JOIN work_orders w ON w.id = te."workOrderId"
      JOIN assets a ON a.id = w."assetId"
      WHERE te."organizationId" = ${organizationId}
        AND te."workedOn" >= ${fra} AND te."workedOn" < ${til}
      GROUP BY a."costCenterId"
    ) t ON t."costCenterId" = c.id
    LEFT JOIN (
      SELECT a."costCenterId", sum(pu.quantity * pu."unitCost") AS belop
      FROM part_usages pu
      JOIN work_orders w ON w.id = pu."workOrderId"
      JOIN assets a ON a.id = w."assetId"
      WHERE pu."organizationId" = ${organizationId}
        AND pu."createdAt" >= ${fra} AND pu."createdAt" < ${til}
      GROUP BY a."costCenterId"
    ) p ON p."costCenterId" = c.id
    WHERE c."organizationId" = ${organizationId}
    ORDER BY c.code
  `;
}

/** De mest brukte reservedelene, til innkjøps- og lagerstyring. */
export async function delerMestBrukt(organizationId: string, antall = 12) {
  return prisma.$queryRaw<
    { id: string; nummer: string; navn: string; enhet: string; forbruk: number; kostnad: number }[]
  >`
    SELECT p.id,
           p.number AS nummer,
           p.name AS navn,
           p.unit AS enhet,
           sum(pu.quantity)::float8 AS forbruk,
           sum(pu.quantity * pu."unitCost")::float8 AS kostnad
    FROM part_usages pu
    JOIN parts p ON p.id = pu."partId"
    WHERE pu."organizationId" = ${organizationId}
      AND pu."createdAt" >= now() - interval '12 months'
    GROUP BY p.id, p.number, p.name, p.unit
    ORDER BY kostnad DESC
    LIMIT ${antall}
  `;
}

/**
 * Fordeling mellom korrektivt og forebyggende arbeid.
 * Jo høyere andel forebyggende, desto mer kontroll har man på anlegget.
 */
export async function arbeidsfordeling(db: TenantDb) {
  const rader = await db.workOrder.groupBy({
    by: ["type"],
    _count: { _all: true },
    where: { createdAt: { gte: new Date(Date.now() - 365 * 86400_000) } },
  });
  return rader.map((r) => ({ type: r.type, antall: r._count._all }));
}

/**
 * Meldt mot utført per måned.
 *
 * Det viktigste tallet i et vedlikeholdssystem er ikke hvor mange jobber som
 * er gjort, men om man holder tritt. Kommer det inn femti og gjøres førti,
 * vokser etterslepet med ti i måneden — og det synes ikke på noen enkelttall.
 *
 * Rå SQL fordi den utvidede klienten ikke kan gruppere på måned.
 * organizationId settes eksplisitt — se kommentaren øverst i denne filen.
 */
export async function meldtMotUtfort(organizationId: string, maneder = 12) {
  return prisma.$queryRaw<
    { maned: string; meldt: number; utfort: number; lukket: number }[]
  >`
    WITH serie AS (
      SELECT generate_series(
        date_trunc('month', now()) - make_interval(months => ${maneder - 1}),
        date_trunc('month', now()),
        interval '1 month'
      ) AS m
    )
    SELECT
      to_char(s.m, 'YYYY-MM') AS maned,
      (SELECT count(*) FROM work_orders w
        WHERE w."organizationId" = ${organizationId}
          AND date_trunc('month', w."createdAt") = s.m)::int AS meldt,
      (SELECT count(*) FROM work_orders w
        WHERE w."organizationId" = ${organizationId}
          AND date_trunc('month', w."completedAt") = s.m)::int AS utfort,
      (SELECT count(*) FROM work_orders w
        WHERE w."organizationId" = ${organizationId}
          AND date_trunc('month', w."closedAt") = s.m)::int AS lukket
    FROM serie s
    ORDER BY s.m
  `;
}

/**
 * Andel forebyggende arbeid, måned for måned.
 *
 * Dette er målet på om vedlikeholdet er under kontroll. Et anlegg som bare
 * reparerer det som ryker, bruker mer penger og har mer nedetid enn et som
 * planlegger. Bransjen sikter mot at rundt to tredeler av jobbene er planlagt.
 *
 * Det er også den grafen som viser en kunde hva systemet er verdt: den flytter
 * seg over månedene når man begynner å bruke forebyggende planer.
 */
export async function forebyggendeAndel(organizationId: string, maneder = 12) {
  return prisma.$queryRaw<
    { maned: string; forebyggende: number; korrektiv: number; annet: number }[]
  >`
    WITH serie AS (
      SELECT generate_series(
        date_trunc('month', now()) - make_interval(months => ${maneder - 1}),
        date_trunc('month', now()),
        interval '1 month'
      ) AS m
    )
    SELECT
      to_char(s.m, 'YYYY-MM') AS maned,
      (SELECT count(*) FROM work_orders w
        WHERE w."organizationId" = ${organizationId}
          AND w.type = 'FOREBYGGENDE'
          AND date_trunc('month', w."createdAt") = s.m)::int AS forebyggende,
      (SELECT count(*) FROM work_orders w
        WHERE w."organizationId" = ${organizationId}
          AND w.type = 'KORREKTIV'
          AND date_trunc('month', w."createdAt") = s.m)::int AS korrektiv,
      (SELECT count(*) FROM work_orders w
        WHERE w."organizationId" = ${organizationId}
          AND w.type NOT IN ('FOREBYGGENDE', 'KORREKTIV')
          AND date_trunc('month', w."createdAt") = s.m)::int AS annet
    FROM serie s
    ORDER BY s.m
  `;
}

/**
 * Hvor lang tid det tar fra en feil meldes til den er utført.
 *
 * Snittet alene lyver: én jobb som ble liggende i et halvår drar det opp for
 * alle de andre. Derfor tas også medianen med, som er den jobben som ligger
 * midt i bunken.
 */
export async function reparasjonstid(organizationId: string, maneder = 12) {
  return prisma.$queryRaw<
    { maned: string; snitt: number | null; median: number | null; antall: number }[]
  >`
    WITH serie AS (
      SELECT generate_series(
        date_trunc('month', now()) - make_interval(months => ${maneder - 1}),
        date_trunc('month', now()),
        interval '1 month'
      ) AS m
    ),
    fullfort AS (
      SELECT
        date_trunc('month', w."completedAt") AS m,
        extract(epoch FROM (w."completedAt" - w."createdAt")) / 86400.0 AS dager
      FROM work_orders w
      WHERE w."organizationId" = ${organizationId}
        AND w."completedAt" IS NOT NULL
        AND w."completedAt" >= w."createdAt"
    )
    SELECT
      to_char(s.m, 'YYYY-MM') AS maned,
      round(avg(f.dager)::numeric, 1)::float8 AS snitt,
      round(percentile_cont(0.5) WITHIN GROUP (ORDER BY f.dager)::numeric, 1)::float8 AS median,
      count(f.dager)::int AS antall
    FROM serie s
    LEFT JOIN fullfort f ON f.m = s.m
    GROUP BY s.m
    ORDER BY s.m
  `;
}

/**
 * Etterslepet slik det ser ut nå, fordelt på hvor gammelt det er.
 *
 * En jobb som har ligget åpen i et halvår er noe annet enn en som kom inn i
 * går, selv om begge teller som «åpen». Det er de gamle som sier noe om
 * hvorvidt systemet faktisk brukes.
 */
export async function etterslep(organizationId: string) {
  return prisma.$queryRaw<{ bolk: string; antall: number; rekkefolge: number }[]>`
    SELECT bolk, count(*)::int AS antall, min(rekkefolge)::int AS rekkefolge
    FROM (
      SELECT
        CASE
          WHEN now() - w."createdAt" < interval '7 days'  THEN 'Under en uke'
          WHEN now() - w."createdAt" < interval '30 days' THEN 'En uke til en måned'
          WHEN now() - w."createdAt" < interval '90 days' THEN 'En til tre måneder'
          WHEN now() - w."createdAt" < interval '365 days' THEN 'Tre måneder til et år'
          ELSE 'Over et år'
        END AS bolk,
        CASE
          WHEN now() - w."createdAt" < interval '7 days'  THEN 1
          WHEN now() - w."createdAt" < interval '30 days' THEN 2
          WHEN now() - w."createdAt" < interval '90 days' THEN 3
          WHEN now() - w."createdAt" < interval '365 days' THEN 4
          ELSE 5
        END AS rekkefolge
      FROM work_orders w
      WHERE w."organizationId" = ${organizationId}
        AND w.status NOT IN ('UTFORT', 'LUKKET', 'AVVIST')
    ) t
    GROUP BY bolk
    ORDER BY rekkefolge
  `;
}
