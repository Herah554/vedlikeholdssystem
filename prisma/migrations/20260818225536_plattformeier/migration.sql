-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "isSuperAdmin" BOOLEAN NOT NULL DEFAULT false;

-- Utnevner plattformeieren.
--
-- Den aller første brukeren i systemet er den som satte det opp. Fram til nå
-- fantes ikke begrepet plattformeier, så den kontoen må få rettigheten her.
--
-- Setningen gjør ingenting hvis det allerede finnes en plattformeier, og
-- ingenting hvis databasen er tom — da opprettes eieren ved
-- førstegangsoppsettet i stedet. Den er trygg å kjøre om igjen.
UPDATE "users"
SET "isSuperAdmin" = true
WHERE "id" = (
    SELECT "id" FROM "users" ORDER BY "createdAt" ASC, "id" ASC LIMIT 1
  )
  AND NOT EXISTS (SELECT 1 FROM "users" WHERE "isSuperAdmin" = true);
