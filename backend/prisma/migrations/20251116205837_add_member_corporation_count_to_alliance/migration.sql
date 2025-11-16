-- AlterTable
ALTER TABLE "alliances" ADD COLUMN     "corporation_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "member_count" INTEGER NOT NULL DEFAULT 0;
