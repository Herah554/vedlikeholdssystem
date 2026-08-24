/*
  Warnings:

  - Added the required column `url` to the `attachments` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "DeviationType" AS ENUM ('HMS', 'NAERULYKKE', 'KVALITET', 'MILJO', 'ANNET');

-- CreateEnum
CREATE TYPE "DeviationSeverity" AS ENUM ('LAV', 'MIDDELS', 'HOY', 'KRITISK');

-- CreateEnum
CREATE TYPE "DeviationStatus" AS ENUM ('MELDT', 'UNDER_BEHANDLING', 'TILTAK_IVERKSATT', 'LUKKET', 'AVVIST');

-- AlterTable
ALTER TABLE "attachments" ADD COLUMN     "deviationId" TEXT,
ADD COLUMN     "url" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "deviations" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" "DeviationType" NOT NULL DEFAULT 'HMS',
    "severity" "DeviationSeverity" NOT NULL DEFAULT 'MIDDELS',
    "status" "DeviationStatus" NOT NULL DEFAULT 'MELDT',
    "assetId" TEXT,
    "location" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "reportedById" TEXT NOT NULL,
    "assignedToId" TEXT,
    "immediateAction" TEXT,
    "rootCause" TEXT,
    "correctiveAction" TEXT,
    "deadline" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "workOrderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deviations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "deviations_organizationId_status_idx" ON "deviations"("organizationId", "status");

-- CreateIndex
CREATE INDEX "deviations_organizationId_assetId_idx" ON "deviations"("organizationId", "assetId");

-- CreateIndex
CREATE INDEX "deviations_organizationId_occurredAt_idx" ON "deviations"("organizationId", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "deviations_organizationId_number_key" ON "deviations"("organizationId", "number");

-- CreateIndex
CREATE INDEX "attachments_organizationId_deviationId_idx" ON "attachments"("organizationId", "deviationId");

-- AddForeignKey
ALTER TABLE "deviations" ADD CONSTRAINT "deviations_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deviations" ADD CONSTRAINT "deviations_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deviations" ADD CONSTRAINT "deviations_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deviations" ADD CONSTRAINT "deviations_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deviations" ADD CONSTRAINT "deviations_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_deviationId_fkey" FOREIGN KEY ("deviationId") REFERENCES "deviations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
