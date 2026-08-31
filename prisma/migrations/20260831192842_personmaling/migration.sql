-- CreateEnum
CREATE TYPE "PersonMaling" AS ENUM ('AV', 'EGNE', 'ALLE');

-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "personMaling" "PersonMaling" NOT NULL DEFAULT 'EGNE';
