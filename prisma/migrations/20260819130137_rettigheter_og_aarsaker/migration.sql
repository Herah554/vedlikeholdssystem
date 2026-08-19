-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'DELELAGER';

-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "permissions" JSONB;

-- CreateTable
CREATE TABLE "failure_causes" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "failure_causes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "failure_causes_organizationId_idx" ON "failure_causes"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "failure_causes_organizationId_code_key" ON "failure_causes"("organizationId", "code");

-- AddForeignKey
ALTER TABLE "failure_causes" ADD CONSTRAINT "failure_causes_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
