-- Skjemaer: SJA, sjekklister og andre dokumenter per jobb.
--
-- Et utfylt skjema tar en kopi av malen i schemaSnapshot. Det er hele
-- poenget: et sikkerhetsdokument noen har satt navnet sitt på skal ikke
-- kunne endre innhold i ettertid fordi noen ryddet i malen etterpå.


-- CreateEnum
CREATE TYPE "FormScope" AS ENUM ('ARBEIDSORDRE', 'AVVIK', 'BEGGE');

-- CreateEnum
CREATE TYPE "FormStatus" AS ENUM ('UTKAST', 'LAAST');

-- CreateTable
CREATE TABLE "form_templates" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "scope" "FormScope" NOT NULL DEFAULT 'ARBEIDSORDRE',
    "fields" JSONB NOT NULL DEFAULT '[]',
    "version" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "form_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "form_responses" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "templateId" TEXT,
    "workOrderId" TEXT,
    "deviationId" TEXT,
    "templateName" TEXT NOT NULL,
    "templateVersion" INTEGER NOT NULL DEFAULT 1,
    "schemaSnapshot" JSONB NOT NULL,
    "answers" JSONB NOT NULL DEFAULT '{}',
    "status" "FormStatus" NOT NULL DEFAULT 'UTKAST',
    "startedById" TEXT,
    "lockedById" TEXT,
    "lockedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "form_responses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "form_templates_organizationId_scope_idx" ON "form_templates"("organizationId", "scope");

-- CreateIndex
CREATE INDEX "form_responses_organizationId_workOrderId_idx" ON "form_responses"("organizationId", "workOrderId");

-- CreateIndex
CREATE INDEX "form_responses_organizationId_deviationId_idx" ON "form_responses"("organizationId", "deviationId");

-- AddForeignKey
ALTER TABLE "form_templates" ADD CONSTRAINT "form_templates_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_responses" ADD CONSTRAINT "form_responses_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_responses" ADD CONSTRAINT "form_responses_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "form_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_responses" ADD CONSTRAINT "form_responses_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_responses" ADD CONSTRAINT "form_responses_deviationId_fkey" FOREIGN KEY ("deviationId") REFERENCES "deviations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_responses" ADD CONSTRAINT "form_responses_startedById_fkey" FOREIGN KEY ("startedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_responses" ADD CONSTRAINT "form_responses_lockedById_fkey" FOREIGN KEY ("lockedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

