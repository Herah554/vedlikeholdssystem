-- AlterTable
ALTER TABLE "purchase_order_lines" ADD COLUMN     "addedLater" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "purchase_orders" ADD COLUMN     "pendingChanges" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "dailyHours" DOUBLE PRECISION NOT NULL DEFAULT 7.5;

-- CreateTable
CREATE TABLE "quick_links" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quick_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "quick_links_organizationId_userId_sortOrder_idx" ON "quick_links"("organizationId", "userId", "sortOrder");

-- AddForeignKey
ALTER TABLE "quick_links" ADD CONSTRAINT "quick_links_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quick_links" ADD CONSTRAINT "quick_links_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
