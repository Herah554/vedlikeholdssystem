import { prisma } from "@/lib/prisma";

/**
 * Fritekstsøk i dokumentasjon.
 *
 * To kilder: det noen har skrevet inn på utstyret, og teksten som ble lest ut
 * av PDF-ene ved opplasting. Begge går mot en tsvector-kolonne med norsk
 * ordstamming, på samme måte som arbeidsordrene.
 *
 * Spørringene er rå SQL og går derfor utenom flerklient-filteret.
 * organizationId settes eksplisitt i hver eneste WHERE — se kommentarene i
 * src/lib/tenant.ts om hvorfor det må gjøres for hånd her.
 */

export type Dokumenttreff = {
  slag: "notat" | "fil";
  id: string;
  tittel: string;
  utdrag: string;
  utstyrKode: string | null;
  utstyrNavn: string | null;
  /** Bare for filer */
  url: string | null;
  score: number;
};

/**
 * Fjerner uthevingen ts_headline legger inn.
 *
 * Postgres markerer treffordene med <b> som standard, og godtar ikke tomme
 * erstatninger. Teksten skal vises som ren tekst, så merkingen strippes her.
 */
function utenUtheving(tekst: string): string {
  return tekst.replace(/<\/?b>/g, "");
}

/** Gjør fritekst om til en tsquery Postgres godtar. */
function tilSporring(tekst: string): string | null {
  const ord = tekst
    .toLowerCase()
    .replace(/[&|!():*'"]/g, " ")
    .split(/\s+/)
    .map((o) => o.trim())
    .filter((o) => o.length > 1);

  if (ord.length === 0) return null;
  return ord.map((o) => `${o}:*`).join(" | ");
}

export async function sokDokumentasjon(
  organizationId: string,
  tekst: string,
  antall = 8,
): Promise<Dokumenttreff[]> {
  const sporring = tilSporring(tekst);
  if (!sporring) return [];

  // ts_headline klipper ut biten rundt treffet. Uten det ville en manual på
  // femti sider vist de femti første ordene, som sjelden er de man leter etter.
  const notater = await prisma.$queryRaw<
    {
      id: string;
      tittel: string;
      utdrag: string;
      kode: string | null;
      navn: string | null;
      score: number;
    }[]
  >`
    SELECT
      d.id,
      d.title AS tittel,
      ts_headline('norwegian', d.body, to_tsquery('norwegian', ${sporring}),
                  'MaxWords=45, MinWords=20') AS utdrag,
      a.code AS kode,
      a.name AS navn,
      ts_rank(d.search_vector, to_tsquery('norwegian', ${sporring}))::float8 AS score
    FROM asset_docs d
    JOIN assets a ON a.id = d."assetId"
    WHERE d."organizationId" = ${organizationId}
      AND d.search_vector @@ to_tsquery('norwegian', ${sporring})
    ORDER BY score DESC
    LIMIT ${antall}
  `;

  const filer = await prisma.$queryRaw<
    {
      id: string;
      tittel: string;
      utdrag: string;
      kode: string | null;
      navn: string | null;
      url: string;
      score: number;
    }[]
  >`
    SELECT
      f.id,
      f."fileName" AS tittel,
      ts_headline('norwegian', coalesce(f."extractedText", ''),
                  to_tsquery('norwegian', ${sporring}),
                  'MaxWords=45, MinWords=20') AS utdrag,
      a.code AS kode,
      a.name AS navn,
      f.url,
      ts_rank(f.search_vector, to_tsquery('norwegian', ${sporring}))::float8 AS score
    FROM attachments f
    LEFT JOIN assets a ON a.id = f."assetId"
    WHERE f."organizationId" = ${organizationId}
      AND f.search_vector @@ to_tsquery('norwegian', ${sporring})
      AND f."mimeType" = 'application/pdf'
    ORDER BY score DESC
    LIMIT ${antall}
  `;

  return [
    ...notater.map((n) => ({
      slag: "notat" as const,
      id: n.id,
      tittel: n.tittel,
      utdrag: utenUtheving(n.utdrag),
      utstyrKode: n.kode,
      utstyrNavn: n.navn,
      url: null,
      score: n.score,
    })),
    ...filer.map((f) => ({
      slag: "fil" as const,
      id: f.id,
      tittel: f.tittel,
      utdrag: utenUtheving(f.utdrag),
      utstyrKode: f.kode,
      utstyrNavn: f.navn,
      url: f.url,
      score: f.score,
    })),
  ]
    .sort((a, b) => b.score - a.score)
    .slice(0, antall);
}
