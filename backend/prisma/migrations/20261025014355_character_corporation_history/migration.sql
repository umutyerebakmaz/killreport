-- ESI /characters/{id}/corporationhistory/, one row per record_id. Generated
-- by prisma migrate diff; the five DROP TABLE statements it also emits for the
-- unmanaged tables (see CLAUDE.md, Database migrations) are left out.

-- CreateTable
CREATE TABLE "character_corporation_history" (
    "record_id" BIGINT NOT NULL,
    "character_id" INTEGER NOT NULL,
    "corporation_id" INTEGER NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "fetched_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "character_corporation_history_pkey" PRIMARY KEY ("record_id")
);

-- CreateIndex
CREATE INDEX "character_corporation_history_character_id_idx" ON "character_corporation_history"("character_id");
