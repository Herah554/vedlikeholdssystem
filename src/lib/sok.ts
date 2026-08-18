import { prisma } from "@/lib/prisma";

/**
 * Fritekstsøk i arbeidsordre.
 *
 * Søket går mot en generert tsvector-kolonne med norsk ordstamming, slik at
 * «pumper» også finner «pumpe». Ordene kobles med ELLER i stedet for OG:
 * en tekniker som skriver «pumpe vibrasjon lager» vil helst se alt som ligner,
 * med de beste treffene øverst, framfor ingenting fordi ett ord manglet.
 *
 * Løsningsteksten teller tyngre enn beskrivelsen i rangeringen, fordi det er
 * der kunnskapen ligger — hva som faktisk fikset feilen forrige gang.
 */

export type Treff = {
  id: string;
  number: number;
  title: string;
  description: string | null;
  resolution: string | null;
  failureCode: string | null;
  status: string;
  createdAt: Date;
  completedAt: Date | null;
  downtimeMinutes: number | null;
  assetCode: string | null;
  assetName: string | null;
  score: number;
};

/** Gjør fritekst om til en tsquery Postgres godtar. */
function tilSporring(tekst: string): string | null {
  const ord = tekst
    .toLowerCase()
    // Fjerner tegn som har egen betydning i tsquery-syntaksen
    .replace(/[&|!():*'"]/g, " ")
    .split(/\s+/)
    .map((o) => o.trim())
    .filter((o) => o.length > 1);

  if (ord.length === 0) return null;
  // Stjerne på slutten gir treff på ordstarter, så «komp» finner «kompressor»
  return ord.map((o) => `${o}:*`).join(" | ");
}

export async function sokArbeidsordre(
  organizationId: string,
  tekst: string,
  opsjoner: { antall?: number; utenomOrdreId?: string } = {},
): Promise<Treff[]> {
  const sporring = tilSporring(tekst);
  if (!sporring) return [];

  const antall = opsjoner.antall ?? 10;
  const utenom = opsjoner.utenomOrdreId ?? "";

  return prisma.$queryRaw<Treff[]>`
    SELECT w.id,
           w.number,
           w.title,
           w.description,
           w.resolution,
           w."failureCode",
           w.status::text AS status,
           w."createdAt",
           w."completedAt",
           w."downtimeMinutes",
           a.code AS "assetCode",
           a.name AS "assetName",
           ts_rank(w.search_vector, q)::float8 AS score
    FROM work_orders w
    LEFT JOIN assets a ON a.id = w."assetId"
    CROSS JOIN to_tsquery('norwegian', ${sporring}) q
    WHERE w."organizationId" = ${organizationId}
      AND w.id <> ${utenom}
      AND w.search_vector @@ q
    ORDER BY score DESC, w."createdAt" DESC
    LIMIT ${antall}
  `;
}

/**
 * Finner tidligere saker som ligner på en gitt arbeidsordre.
 * Brukes på ordredetaljene for å vise «dette har skjedd før».
 */
export async function liknendeSaker(
  organizationId: string,
  ordre: { id: string; title: string; description: string | null; assetId: string | null },
  antall = 5,
): Promise<Treff[]> {
  const tekst = [ordre.title, ordre.description ?? ""].join(" ");
  const treff = await sokArbeidsordre(organizationId, tekst, {
    antall: antall * 3,
    utenomOrdreId: ordre.id,
  });

  // Saker på samme utstyr er mest relevante, så de løftes fram.
  if (!ordre.assetId) return treff.slice(0, antall);

  const sammeUtstyr = await prisma.workOrder.findMany({
    where: { organizationId, assetId: ordre.assetId, id: { not: ordre.id } },
    select: { id: true },
  });
  const sammeUtstyrIder = new Set(sammeUtstyr.map((o) => o.id));

  return treff
    .sort((a, b) => {
      const aVekt = sammeUtstyrIder.has(a.id) ? 1 : 0;
      const bVekt = sammeUtstyrIder.has(b.id) ? 1 : 0;
      if (aVekt !== bVekt) return bVekt - aVekt;
      return b.score - a.score;
    })
    .slice(0, antall);
}

/** Enkelt navnesøk på tvers av utstyr og reservedeler, brukt av assistenten. */
export async function sokUtstyr(organizationId: string, tekst: string, antall = 5) {
  const q = `%${tekst.replace(/[%_]/g, "")}%`;
  return prisma.$queryRaw<
    { id: string; code: string; name: string; type: string }[]
  >`
    SELECT id, code, name, type::text AS type
    FROM assets
    WHERE "organizationId" = ${organizationId}
      AND (name ILIKE ${q} OR code ILIKE ${q})
    ORDER BY similarity(name, ${tekst}) DESC
    LIMIT ${antall}
  `;
}
