-- Søkevektoren var en GENERATED ALWAYS-kolonne. Prisma kjenner ikke det
-- begrepet, og forsøkte derfor å fjerne en «standardverdi» på den i hver
-- nye migrasjon — noe Postgres avviser. Resultatet var at enhver framtidig
-- endring i modellen stoppet på denne kolonnen.
--
-- Løsningen er en helt vanlig tsvector-kolonne som holdes oppdatert av en
-- trigger i stedet. For databasen er oppførselen den samme, men nå ser
-- kolonnen ut som en alminnelig kolonne for Prisma, og drift oppstår ikke.

ALTER TABLE "work_orders" DROP COLUMN "search_vector";
ALTER TABLE "work_orders" ADD COLUMN "search_vector" tsvector;

CREATE OR REPLACE FUNCTION work_orders_oppdater_sokvektor() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('norwegian', coalesce(NEW.title, '')), 'A') ||
    setweight(to_tsvector('norwegian', coalesce(NEW.resolution, '')), 'B') ||
    setweight(to_tsvector('norwegian', coalesce(NEW."failureCode", '')), 'B') ||
    setweight(to_tsvector('norwegian', coalesce(NEW.description, '')), 'C');
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

CREATE TRIGGER work_orders_sokvektor
  BEFORE INSERT OR UPDATE OF title, description, resolution, "failureCode"
  ON "work_orders"
  FOR EACH ROW
  EXECUTE FUNCTION work_orders_oppdater_sokvektor();

-- Fyll inn vektoren for radene som allerede finnes
UPDATE "work_orders" SET title = title;

CREATE INDEX "work_orders_search_idx" ON "work_orders" USING GIN ("search_vector");
