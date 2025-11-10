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
CREATE TABLE "alliance_snapshots" (
    "id" BIGSERIAL NOT NULL,
    "alliance_id" INTEGER NOT NULL,
    "member_count" INTEGER NOT NULL,
    "corporation_count" INTEGER NOT NULL,
    "snapshot_date" DATE NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alliance_snapshots_pkey" PRIMARY KEY ("id")
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
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "killmails_pkey" PRIMARY KEY ("killmail_id")
);

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
CREATE TABLE "attackers" (
    "killmail_id" INTEGER NOT NULL,
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
    "faction_id" INTEGER,
    "id" BIGSERIAL NOT NULL,

    CONSTRAINT "attackers_pkey" PRIMARY KEY ("id")
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

-- CreateTable
CREATE TABLE "types" (
    "id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "group_id" INTEGER NOT NULL,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "volume" DOUBLE PRECISION,
    "capacity" DOUBLE PRECISION,
    "mass" DOUBLE PRECISION,
    "icon_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "types_pkey" PRIMARY KEY ("id")
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
CREATE INDEX "alliance_snapshots_snapshot_date_idx" ON "alliance_snapshots"("snapshot_date");

-- CreateIndex
CREATE INDEX "alliance_snapshots_alliance_id_idx" ON "alliance_snapshots"("alliance_id");

-- CreateIndex
CREATE UNIQUE INDEX "alliance_snapshots_alliance_id_snapshot_date_key" ON "alliance_snapshots"("alliance_id", "snapshot_date");

-- CreateIndex
CREATE INDEX "corporations_alliance_id_idx" ON "corporations"("alliance_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_character_id_key" ON "users"("character_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_character_id_idx" ON "users"("character_id");

-- CreateIndex
CREATE INDEX "users_expires_at_idx" ON "users"("expires_at");

-- CreateIndex
CREATE INDEX "killmails_killmail_time_idx" ON "killmails"("killmail_time");

-- CreateIndex
CREATE INDEX "killmails_solar_system_id_idx" ON "killmails"("solar_system_id");

-- CreateIndex
CREATE INDEX "victims_character_id_idx" ON "victims"("character_id");

-- CreateIndex
CREATE INDEX "victims_corporation_id_idx" ON "victims"("corporation_id");

-- CreateIndex
CREATE INDEX "victims_alliance_id_idx" ON "victims"("alliance_id");

-- CreateIndex
CREATE INDEX "victims_ship_type_id_idx" ON "victims"("ship_type_id");

-- CreateIndex
CREATE INDEX "attackers_killmail_id_idx" ON "attackers"("killmail_id");

-- CreateIndex
CREATE INDEX "attackers_character_id_idx" ON "attackers"("character_id");

-- CreateIndex
CREATE INDEX "attackers_corporation_id_idx" ON "attackers"("corporation_id");

-- CreateIndex
CREATE INDEX "attackers_alliance_id_idx" ON "attackers"("alliance_id");

-- CreateIndex
CREATE INDEX "killmail_items_killmail_id_idx" ON "killmail_items"("killmail_id");

-- CreateIndex
CREATE INDEX "killmail_items_item_type_id_idx" ON "killmail_items"("item_type_id");

-- CreateIndex
CREATE INDEX "types_group_id_idx" ON "types"("group_id");

-- CreateIndex
CREATE INDEX "sync_jobs_entity_type_status_idx" ON "sync_jobs"("entity_type", "status");

-- CreateIndex
CREATE INDEX "sync_jobs_entity_id_entity_type_idx" ON "sync_jobs"("entity_id", "entity_type");

-- AddForeignKey
ALTER TABLE "alliance_snapshots" ADD CONSTRAINT "alliance_snapshots_alliance_id_fkey" FOREIGN KEY ("alliance_id") REFERENCES "alliances"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "corporations" ADD CONSTRAINT "corporations_alliance_id_fkey" FOREIGN KEY ("alliance_id") REFERENCES "alliances"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "victims" ADD CONSTRAINT "victims_killmail_id_fkey" FOREIGN KEY ("killmail_id") REFERENCES "killmails"("killmail_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attackers" ADD CONSTRAINT "attackers_killmail_id_fkey" FOREIGN KEY ("killmail_id") REFERENCES "killmails"("killmail_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "killmail_items" ADD CONSTRAINT "killmail_items_killmail_id_fkey" FOREIGN KEY ("killmail_id") REFERENCES "killmails"("killmail_id") ON DELETE CASCADE ON UPDATE CASCADE;

