-- CreateEnum
CREATE TYPE "PartRequestStatus" AS ENUM ('ONSKET', 'BESTILT', 'MOTTATT', 'AVVIST');

-- CreateTable
CREATE TABLE "part_requests" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "workOrderId" TEXT,
    "partId" TEXT,
    "description" TEXT,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "note" TEXT,
    "status" "PartRequestStatus" NOT NULL DEFAULT 'ONSKET',
    "urgent" BOOLEAN NOT NULL DEFAULT false,
    "requestedById" TEXT NOT NULL,
    "handledById" TEXT,
    "handledAt" TIMESTAMP(3),
    "handledNote" TEXT,
    "purchaseOrderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "part_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "part_requests_organizationId_status_createdAt_idx" ON "part_requests"("organizationId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "part_requests_workOrderId_idx" ON "part_requests"("workOrderId");

-- CreateIndex
CREATE INDEX "part_requests_partId_idx" ON "part_requests"("partId");

-- CreateIndex
CREATE INDEX "part_requests_purchaseOrderId_idx" ON "part_requests"("purchaseOrderId");

-- AddForeignKey
ALTER TABLE "part_requests" ADD CONSTRAINT "part_requests_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "part_requests" ADD CONSTRAINT "part_requests_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "part_requests" ADD CONSTRAINT "part_requests_partId_fkey" FOREIGN KEY ("partId") REFERENCES "parts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "part_requests" ADD CONSTRAINT "part_requests_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "part_requests" ADD CONSTRAINT "part_requests_handledById_fkey" FOREIGN KEY ("handledById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "part_requests" ADD CONSTRAINT "part_requests_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "purchase_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
