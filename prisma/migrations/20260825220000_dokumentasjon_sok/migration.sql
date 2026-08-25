
-- AlterTable
ALTER TABLE "attachments" ADD COLUMN     "extractedText" TEXT,
ADD COLUMN     "search_vector" tsvector;

-- CreateTable
CREATE TABLE "asset_docs" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "category" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "search_vector" tsvector,

    CONSTRAINT "asset_docs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "asset_docs_organizationId_assetId_idx" ON "asset_docs"("organizationId", "assetId");

-- CreateIndex
CREATE INDEX "asset_docs_search_idx" ON "asset_docs" USING GIN ("search_vector");

-- CreateIndex
CREATE INDEX "attachments_search_idx" ON "attachments" USING GIN ("search_vector");

-- AddForeignKey
ALTER TABLE "asset_docs" ADD CONSTRAINT "asset_docs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_docs" ADD CONSTRAINT "asset_docs_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_docs" ADD CONSTRAINT "asset_docs_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ── Søkevektorene ────────────────────────────────────────────
--
-- Samme mønster som arbeidsordrene: en vanlig tsvector-kolonne som holdes
-- oppdatert av en trigger. En GENERATED-kolonne ville fått Prisma til å melde
-- drift ved hver framtidige migrasjon.
--
-- Norsk ordstamming, slik at «pumper» også finner «pumpe».

CREATE OR REPLACE FUNCTION asset_docs_oppdater_sokvektor() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('norwegian', coalesce(NEW.title, '')), 'A') ||
    setweight(to_tsvector('norwegian', coalesce(NEW.body, '')), 'B') ||
    setweight(to_tsvector('norwegian', coalesce(NEW.category, '')), 'C');
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

CREATE TRIGGER asset_docs_sokvektor
  BEFORE INSERT OR UPDATE OF title, body, category
  ON "asset_docs"
  FOR EACH ROW
  EXECUTE FUNCTION asset_docs_oppdater_sokvektor();

-- Filnavnet teller tyngst: den som leter etter «kalibreringsbevis PU-101»
-- husker som regel hva fila het, ikke hva som sto på side fire.
CREATE OR REPLACE FUNCTION attachments_oppdater_sokvektor() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('norwegian', coalesce(NEW."fileName", '')), 'A') ||
    setweight(to_tsvector('norwegian', coalesce(NEW."reference", '')), 'B') ||
    setweight(to_tsvector('norwegian', coalesce(NEW."extractedText", '')), 'C');
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

CREATE TRIGGER attachments_sokvektor
  BEFORE INSERT OR UPDATE OF "fileName", "reference", "extractedText"
  ON "attachments"
  FOR EACH ROW
  EXECUTE FUNCTION attachments_oppdater_sokvektor();

-- Fyll inn vektoren for vedleggene som allerede finnes
UPDATE "attachments" SET "fileName" = "fileName";
