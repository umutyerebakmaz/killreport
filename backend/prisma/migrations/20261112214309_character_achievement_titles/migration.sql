-- AlterTable
ALTER TABLE "characters" ADD COLUMN     "achievement_score" INTEGER,
ADD COLUMN     "character_title_id" UUID;

-- CreateTable
CREATE TABLE "character_titles" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "character_titles_pkey" PRIMARY KEY ("id")
);
