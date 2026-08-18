-- Norsk fulltekstsøk over arbeidsordre.
-- Kolonnen vedlikeholdes av Postgres selv (GENERATED ALWAYS), så den kan
-- aldri komme ut av synk med innholdet.
--
-- Vekting styrer treffrekkefølgen:
--   A tittel      – det teknikeren skrev som overskrift
--   B løsning     – hva som faktisk fikset feilen, viktigst for gjenbruk
--   B feilkode
--   C beskrivelse – utfyllende tekst

ALTER TABLE "work_orders"
  ADD COLUMN "search_vector" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('norwegian', coalesce("title", '')), 'A') ||
    setweight(to_tsvector('norwegian', coalesce("resolution", '')), 'B') ||
    setweight(to_tsvector('norwegian', coalesce("failureCode", '')), 'B') ||
    setweight(to_tsvector('norwegian', coalesce("description", '')), 'C')
  ) STORED;

CREATE INDEX "work_orders_search_idx" ON "work_orders" USING GIN ("search_vector");

-- Trigram-søk gjør at "pmpe 101" fortsatt finner "Pumpe P-101",
-- altså treff selv med skrivefeil.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX "work_orders_title_trgm_idx" ON "work_orders" USING GIN ("title" gin_trgm_ops);
CREATE INDEX "assets_name_trgm_idx" ON "assets" USING GIN ("name" gin_trgm_ops);
CREATE INDEX "assets_code_trgm_idx" ON "assets" USING GIN ("code" gin_trgm_ops);
CREATE INDEX "parts_name_trgm_idx" ON "parts" USING GIN ("name" gin_trgm_ops);
CREATE INDEX "parts_number_trgm_idx" ON "parts" USING GIN ("number" gin_trgm_ops);
