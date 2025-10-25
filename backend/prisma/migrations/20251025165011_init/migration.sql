-- CreateTable
CREATE TABLE "Alliance" (
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

    CONSTRAINT "Alliance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Corporation" (
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

    CONSTRAINT "Corporation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Character" (
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

    CONSTRAINT "Character_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Killmail" (
    "id" BIGINT NOT NULL,
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

    CONSTRAINT "Killmail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attacker" (
    "id" BIGSERIAL NOT NULL,
    "killmail_id" BIGINT NOT NULL,
    "character_id" INTEGER,
    "corporation_id" INTEGER,
    "alliance_id" INTEGER,
    "ship_type_id" INTEGER,
    "weapon_type_id" INTEGER,
    "damage_done" INTEGER NOT NULL,
    "final_blow" BOOLEAN NOT NULL,
    "security_status" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Attacker_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncJob" (
    "id" BIGSERIAL NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" BIGINT NOT NULL,
    "status" TEXT NOT NULL,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SyncJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Attacker_killmail_id_idx" ON "Attacker"("killmail_id");

-- CreateIndex
CREATE INDEX "SyncJob_entity_type_status_idx" ON "SyncJob"("entity_type", "status");

-- CreateIndex
CREATE INDEX "SyncJob_entity_id_entity_type_idx" ON "SyncJob"("entity_id", "entity_type");
