-- CreateEnum
CREATE TYPE "Plan" AS ENUM ('BASIS', 'PLUSS', 'PRO');

-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "features" JSONB,
ADD COLUMN     "plan" "Plan" NOT NULL DEFAULT 'BASIS';
