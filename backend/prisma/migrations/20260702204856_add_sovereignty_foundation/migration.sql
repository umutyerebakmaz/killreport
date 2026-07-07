-- Sovereignty foundation: campaigns, participants, map (current + snapshots),
-- structures, alliance territory stats, and territory change log.

CREATE TABLE "alliance_territory_stats" (
    "id" SERIAL NOT NULL,
    "alliance_id" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "systems_controlled" INTEGER NOT NULL DEFAULT 0,
    "tcu_count" INTEGER NOT NULL DEFAULT 0,
    "ihub_count" INTEGER NOT NULL DEFAULT 0,
    "campaigns_attacking" INTEGER NOT NULL DEFAULT 0,
    "campaigns_defending" INTEGER NOT NULL DEFAULT 0,
    "systems_gained" INTEGER NOT NULL DEFAULT 0,
    "systems_lost" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alliance_territory_stats_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "campaign_participants" (
    "id" SERIAL NOT NULL,
    "campaign_id" INTEGER NOT NULL,
    "alliance_id" INTEGER NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campaign_participants_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sovereignty_campaigns" (
    "campaign_id" INTEGER NOT NULL,
    "constellation_id" INTEGER NOT NULL,
    "solar_system_id" INTEGER NOT NULL,
    "structure_id" BIGINT NOT NULL,
    "event_type" TEXT NOT NULL,
    "defender_id" INTEGER,
    "defender_score" DOUBLE PRECISION,
    "attackers_score" DOUBLE PRECISION,
    "start_time" TIMESTAMP(3) NOT NULL,
    "end_time" TIMESTAMP(3),
    "outcome" TEXT,
    "first_seen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sovereignty_campaigns_pkey" PRIMARY KEY ("campaign_id")
);

CREATE TABLE "sovereignty_map_current" (
    "solar_system_id" INTEGER NOT NULL,
    "alliance_id" INTEGER,
    "corporation_id" INTEGER,
    "faction_id" INTEGER,
    "last_updated" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sovereignty_map_current_pkey" PRIMARY KEY ("solar_system_id")
);

CREATE TABLE "sovereignty_map_snapshots" (
    "id" SERIAL NOT NULL,
    "solar_system_id" INTEGER NOT NULL,
    "alliance_id" INTEGER,
    "corporation_id" INTEGER,
    "faction_id" INTEGER,
    "snapshot_date" DATE NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sovereignty_map_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sovereignty_structures" (
    "structure_id" BIGINT NOT NULL,
    "solar_system_id" INTEGER NOT NULL,
    "structure_type_id" INTEGER NOT NULL,
    "alliance_id" INTEGER NOT NULL,
    "vulnerability_occupancy_level" DOUBLE PRECISION,
    "vulnerable_start_time" TIMESTAMP(3),
    "vulnerable_end_time" TIMESTAMP(3),
    "first_seen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen" TIMESTAMP(3) NOT NULL,
    "destroyed_at" TIMESTAMP(3),

    CONSTRAINT "sovereignty_structures_pkey" PRIMARY KEY ("structure_id")
);

CREATE TABLE "territory_changes" (
    "id" BIGSERIAL NOT NULL,
    "solar_system_id" INTEGER NOT NULL,
    "previous_owner_id" INTEGER,
    "new_owner_id" INTEGER,
    "previous_faction_id" INTEGER,
    "new_faction_id" INTEGER,
    "change_type" TEXT NOT NULL,
    "detected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "territory_changes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "alliance_territory_stats_date_idx" ON "alliance_territory_stats"("date");
CREATE INDEX "alliance_territory_stats_systems_controlled_idx" ON "alliance_territory_stats"("systems_controlled");
CREATE UNIQUE INDEX "alliance_territory_stats_alliance_id_date_key" ON "alliance_territory_stats"("alliance_id", "date");
CREATE INDEX "campaign_participants_alliance_id_idx" ON "campaign_participants"("alliance_id");
CREATE UNIQUE INDEX "campaign_participants_campaign_id_alliance_id_key" ON "campaign_participants"("campaign_id", "alliance_id");
CREATE INDEX "sovereignty_campaigns_solar_system_id_start_time_idx" ON "sovereignty_campaigns"("solar_system_id", "start_time");
CREATE INDEX "sovereignty_campaigns_constellation_id_idx" ON "sovereignty_campaigns"("constellation_id");
CREATE INDEX "sovereignty_campaigns_defender_id_idx" ON "sovereignty_campaigns"("defender_id");
CREATE INDEX "sovereignty_campaigns_end_time_idx" ON "sovereignty_campaigns"("end_time");
CREATE INDEX "sovereignty_map_current_alliance_id_idx" ON "sovereignty_map_current"("alliance_id");
CREATE INDEX "sovereignty_map_current_faction_id_idx" ON "sovereignty_map_current"("faction_id");
CREATE INDEX "sovereignty_map_snapshots_snapshot_date_idx" ON "sovereignty_map_snapshots"("snapshot_date");
CREATE INDEX "sovereignty_map_snapshots_alliance_id_snapshot_date_idx" ON "sovereignty_map_snapshots"("alliance_id", "snapshot_date");
CREATE UNIQUE INDEX "sovereignty_map_snapshots_solar_system_id_snapshot_date_key" ON "sovereignty_map_snapshots"("solar_system_id", "snapshot_date");
CREATE INDEX "sovereignty_structures_solar_system_id_idx" ON "sovereignty_structures"("solar_system_id");
CREATE INDEX "sovereignty_structures_alliance_id_idx" ON "sovereignty_structures"("alliance_id");
CREATE INDEX "sovereignty_structures_structure_type_id_idx" ON "sovereignty_structures"("structure_type_id");
CREATE INDEX "sovereignty_structures_vulnerable_start_time_idx" ON "sovereignty_structures"("vulnerable_start_time");
CREATE INDEX "territory_changes_solar_system_id_detected_at_idx" ON "territory_changes"("solar_system_id", "detected_at");
CREATE INDEX "territory_changes_previous_owner_id_idx" ON "territory_changes"("previous_owner_id");
CREATE INDEX "territory_changes_new_owner_id_idx" ON "territory_changes"("new_owner_id");
ALTER TABLE "campaign_participants" ADD CONSTRAINT "campaign_participants_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "sovereignty_campaigns"("campaign_id") ON DELETE CASCADE ON UPDATE CASCADE;
