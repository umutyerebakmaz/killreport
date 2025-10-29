/*
  Warnings:

  - You are about to drop the `Alliance` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Attacker` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Character` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Corporation` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Killmail` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `SyncJob` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `User` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."Attacker" DROP CONSTRAINT "Attacker_killmail_id_fkey";

-- DropTable
DROP TABLE "public"."Alliance";

-- DropTable
DROP TABLE "public"."Attacker";

-- DropTable
DROP TABLE "public"."Character";

-- DropTable
DROP TABLE "public"."Corporation";

-- DropTable
DROP TABLE "public"."Killmail";

-- DropTable
DROP TABLE "public"."SyncJob";

-- DropTable
DROP TABLE "public"."User";

-- CreateTable
CREATE TABLE "alliances" (
    "id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "ticker" TEXT NOT NULL,
    "date_founded" TIMESTAMP(3) NOT NULL,
    "creator_corporation_id" INTEGER NOT NULL,
    "creator_id" INTEGER NOT NULL,
    "executor_corporation_id" INTEGER NOT NULL,
    "faction_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "alliances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "corporations" (
    "id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "ticker" TEXT NOT NULL,
    "member_count" INTEGER NOT NULL,
    "ceo_id" INTEGER NOT NULL,
    "creator_id" INTEGER NOT NULL,
    "date_founded" TIMESTAMP(3),
    "description" TEXT,
    "alliance_id" INTEGER,
    "faction_id" INTEGER,
    "home_station_id" INTEGER,
    "shares" BIGINT,
    "tax_rate" DOUBLE PRECISION NOT NULL,
    "url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "corporations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "characters" (
    "id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "corporation_id" INTEGER NOT NULL,
    "alliance_id" INTEGER,
    "birthday" TIMESTAMP(3) NOT NULL,
    "bloodline_id" INTEGER NOT NULL,
    "race_id" INTEGER NOT NULL,
    "gender" TEXT NOT NULL,
    "security_status" DOUBLE PRECISION,
    "description" TEXT,
    "title" TEXT,
    "faction_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "characters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "character_id" INTEGER NOT NULL,
    "character_name" TEXT NOT NULL,
    "character_owner_hash" TEXT NOT NULL,
    "access_token" TEXT NOT NULL,
    "refresh_token" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "email" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "killmails" (
    "killmail_id" INTEGER NOT NULL,
    "killmail_hash" TEXT NOT NULL,
    "killmail_time" TIMESTAMP(3) NOT NULL,
    "solar_system_id" INTEGER NOT NULL,
    "victim_character_id" INTEGER,
    "victim_corporation_id" INTEGER NOT NULL,
    "victim_alliance_id" INTEGER,
    "victim_ship_type_id" INTEGER NOT NULL,
    "victim_damage_taken" INTEGER NOT NULL,
    "victim_position_x" DOUBLE PRECISION,
    "victim_position_y" DOUBLE PRECISION,
    "victim_position_z" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "killmails_pkey" PRIMARY KEY ("killmail_id")
);

-- CreateTable
CREATE TABLE "attackers" (
    "killmail_id" INTEGER NOT NULL,
    "character_id" INTEGER NOT NULL,
    "corporation_id" INTEGER,
    "alliance_id" INTEGER,
    "ship_type_id" INTEGER,
    "weapon_type_id" INTEGER,
    "damage_done" INTEGER NOT NULL,
    "final_blow" BOOLEAN NOT NULL,
    "security_status" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attackers_pkey" PRIMARY KEY ("killmail_id","character_id")
);

-- CreateTable
CREATE TABLE "sync_jobs" (
    "id" BIGSERIAL NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" BIGINT NOT NULL,
    "status" TEXT NOT NULL,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sync_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_character_id_key" ON "users"("character_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_character_id_idx" ON "users"("character_id");

-- CreateIndex
CREATE INDEX "users_expires_at_idx" ON "users"("expires_at");

-- CreateIndex
CREATE INDEX "killmails_victim_character_id_idx" ON "killmails"("victim_character_id");

-- CreateIndex
CREATE INDEX "killmails_victim_corporation_id_idx" ON "killmails"("victim_corporation_id");

-- CreateIndex
CREATE INDEX "attackers_character_id_idx" ON "attackers"("character_id");

-- CreateIndex
CREATE INDEX "sync_jobs_entity_type_status_idx" ON "sync_jobs"("entity_type", "status");

-- CreateIndex
CREATE INDEX "sync_jobs_entity_id_entity_type_idx" ON "sync_jobs"("entity_id", "entity_type");

-- AddForeignKey
ALTER TABLE "attackers" ADD CONSTRAINT "attackers_killmail_id_fkey" FOREIGN KEY ("killmail_id") REFERENCES "killmails"("killmail_id") ON DELETE CASCADE ON UPDATE CASCADE;
