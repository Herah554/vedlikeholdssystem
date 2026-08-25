-- Arbeidsordretypen blir en liste firmaet styrer selv.
--
-- Prisma foreslo å slette kolonnen og lage en ny. Det ville tømt typen på hver
-- eneste arbeidsordre som finnes. Verdiene er allerede kodene vi vil beholde,
-- så kolonnen bygges om i stedet — da overlever innholdet.

-- 1. Ny tabell for verdier firmaet styrer selv
CREATE TABLE "list_values" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "list" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "tone" TEXT NOT NULL DEFAULT 'noytral',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isBuiltIn" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "list_values_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "list_values_organizationId_list_idx"
    ON "list_values"("organizationId", "list");

CREATE UNIQUE INDEX "list_values_organizationId_list_code_key"
    ON "list_values"("organizationId", "list", "code");

ALTER TABLE "list_values" ADD CONSTRAINT "list_values_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organizations"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- 2. Kolonnen bygges om fra enum til tekst. USING beholder verdiene:
--    KORREKTIV blir strengen 'KORREKTIV', ikke NULL.
ALTER TABLE "work_orders" ALTER COLUMN "type" DROP DEFAULT;
ALTER TABLE "work_orders" ALTER COLUMN "type" TYPE TEXT USING "type"::text;
ALTER TABLE "work_orders" ALTER COLUMN "type" SET DEFAULT 'KORREKTIV';

-- 3. Enumen er ikke lenger i bruk
DROP TYPE "WorkOrderType";

-- 4. Hver bedrift som finnes får de fire innebygde typene.
--    Uten dette ville lista stått tom, og en type som allerede er i bruk på
--    hundre arbeidsordre ville vist seg som en ukjent kode.
INSERT INTO "list_values"
    ("id", "organizationId", "list", "code", "name", "description", "tone", "sortOrder", "isBuiltIn", "createdAt", "updatedAt")
SELECT
    md5(o."id" || 'ordretype' || v."code"),
    o."id",
    'ordretype',
    v."code",
    v."name",
    v."description",
    v."tone",
    v."sortOrder",
    true,
    now(),
    now()
FROM "organizations" o
CROSS JOIN (VALUES
    ('KORREKTIV',    'Korrektiv',    'Retter en feil som har oppstått',        'rose',    0),
    ('FOREBYGGENDE', 'Forebyggende', 'Planlagt vedlikehold, ofte fra en plan', 'emerald', 1),
    ('INSPEKSJON',   'Inspeksjon',   'Kontroll uten at noe er meldt galt',     'sky',     2),
    ('FORBEDRING',   'Forbedring',   'Endring som gjør noe bedre enn før',     'violet',  3)
) AS v("code", "name", "description", "tone", "sortOrder");
