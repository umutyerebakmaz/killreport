/*
  Warnings:

  - The primary key for the `attackers` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `victim_alliance_id` on the `killmails` table. All the data in the column will be lost.
  - You are about to drop the column `victim_character_id` on the `killmails` table. All the data in the column will be lost.
  - You are about to drop the column `victim_corporation_id` on the `killmails` table. All the data in the column will be lost.
  - You are about to drop the column `victim_damage_taken` on the `killmails` table. All the data in the column will be lost.
  - You are about to drop the column `victim_position_x` on the `killmails` table. All the data in the column will be lost.
  - You are about to drop the column `victim_position_y` on the `killmails` table. All the data in the column will be lost.
  - You are about to drop the column `victim_position_z` on the `killmails` table. All the data in the column will be lost.
  - You are about to drop the column `victim_ship_type_id` on the `killmails` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "public"."killmails_victim_character_id_idx";

-- DropIndex
DROP INDEX "public"."killmails_victim_corporation_id_idx";

-- AlterTable
ALTER TABLE "attackers" DROP CONSTRAINT "attackers_pkey",
ADD COLUMN     "faction_id" INTEGER,
ADD COLUMN     "id" BIGSERIAL NOT NULL,
ALTER COLUMN "character_id" DROP NOT NULL,
ADD CONSTRAINT "attackers_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "killmails" DROP COLUMN "victim_alliance_id",
DROP COLUMN "victim_character_id",
DROP COLUMN "victim_corporation_id",
DROP COLUMN "victim_damage_taken",
DROP COLUMN "victim_position_x",
DROP COLUMN "victim_position_y",
DROP COLUMN "victim_position_z",
DROP COLUMN "victim_ship_type_id";

-- CreateTable
CREATE TABLE "victims" (
    "killmail_id" INTEGER NOT NULL,
    "character_id" INTEGER,
    "corporation_id" INTEGER NOT NULL,
    "alliance_id" INTEGER,
    "faction_id" INTEGER,
    "ship_type_id" INTEGER NOT NULL,
    "damage_taken" INTEGER NOT NULL,
    "position_x" DOUBLE PRECISION,
    "position_y" DOUBLE PRECISION,
    "position_z" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "victims_pkey" PRIMARY KEY ("killmail_id")
);

-- CreateTable
CREATE TABLE "killmail_items" (
    "id" BIGSERIAL NOT NULL,
    "killmail_id" INTEGER NOT NULL,
    "item_type_id" INTEGER NOT NULL,
    "flag" INTEGER NOT NULL,
    "quantity_dropped" INTEGER,
    "quantity_destroyed" INTEGER,
    "singleton" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "killmail_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "victims_character_id_idx" ON "victims"("character_id");

-- CreateIndex
CREATE INDEX "victims_corporation_id_idx" ON "victims"("corporation_id");

-- CreateIndex
CREATE INDEX "victims_alliance_id_idx" ON "victims"("alliance_id");

-- CreateIndex
CREATE INDEX "victims_ship_type_id_idx" ON "victims"("ship_type_id");

-- CreateIndex
CREATE INDEX "killmail_items_killmail_id_idx" ON "killmail_items"("killmail_id");

-- CreateIndex
CREATE INDEX "killmail_items_item_type_id_idx" ON "killmail_items"("item_type_id");

-- CreateIndex
CREATE INDEX "attackers_killmail_id_idx" ON "attackers"("killmail_id");

-- CreateIndex
CREATE INDEX "attackers_corporation_id_idx" ON "attackers"("corporation_id");

-- CreateIndex
CREATE INDEX "attackers_alliance_id_idx" ON "attackers"("alliance_id");

-- CreateIndex
CREATE INDEX "killmails_killmail_time_idx" ON "killmails"("killmail_time");

-- CreateIndex
CREATE INDEX "killmails_solar_system_id_idx" ON "killmails"("solar_system_id");

-- AddForeignKey
ALTER TABLE "victims" ADD CONSTRAINT "victims_killmail_id_fkey" FOREIGN KEY ("killmail_id") REFERENCES "killmails"("killmail_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "killmail_items" ADD CONSTRAINT "killmail_items_killmail_id_fkey" FOREIGN KEY ("killmail_id") REFERENCES "killmails"("killmail_id") ON DELETE CASCADE ON UPDATE CASCADE;
