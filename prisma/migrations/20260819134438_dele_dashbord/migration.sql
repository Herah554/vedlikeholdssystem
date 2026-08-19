-- CreateTable
CREATE TABLE "dashboard_shares" (
    "id" TEXT NOT NULL,
    "dashboardId" TEXT NOT NULL,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dashboard_shares_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "dashboard_shares_userId_idx" ON "dashboard_shares"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "dashboard_shares_dashboardId_userId_key" ON "dashboard_shares"("dashboardId", "userId");

-- AddForeignKey
ALTER TABLE "dashboard_shares" ADD CONSTRAINT "dashboard_shares_dashboardId_fkey" FOREIGN KEY ("dashboardId") REFERENCES "dashboards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dashboard_shares" ADD CONSTRAINT "dashboard_shares_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
