-- Universe topology: stargates, stars, planets, moons, asteroid belts and stations.
--
-- Hand-written on purpose. `prisma migrate dev` cannot be used in this repo:
-- killmail_filters, character_kill_stats, corporation_kill_stats,
-- alliance_kill_stats and refresh_log exist in the database but not in
-- prisma/schema, so Prisma reads them as drift and offers to drop all five.
-- This file is the output of
--   prisma migrate diff --from-config-datasource prisma.config.ts --to-schema prisma/schema --script
-- with those five DROP TABLE statements removed. Additive only.


-- CreateTable
CREATE TABLE "asteroid_belts" (
    "asteroid_belt_id" INTEGER NOT NULL,
    "name" TEXT,
    "solar_system_id" INTEGER NOT NULL,
    "planet_id" INTEGER NOT NULL,
    "orbit_index" INTEGER,
    "position_x" DOUBLE PRECISION,
    "position_y" DOUBLE PRECISION,
    "position_z" DOUBLE PRECISION,

    CONSTRAINT "asteroid_belts_pkey" PRIMARY KEY ("asteroid_belt_id")
);

-- CreateTable
CREATE TABLE "moons" (
    "moon_id" INTEGER NOT NULL,
    "name" TEXT,
    "solar_system_id" INTEGER NOT NULL,
    "planet_id" INTEGER NOT NULL,
    "orbit_index" INTEGER,
    "position_x" DOUBLE PRECISION,
    "position_y" DOUBLE PRECISION,
    "position_z" DOUBLE PRECISION,

    CONSTRAINT "moons_pkey" PRIMARY KEY ("moon_id")
);

-- CreateTable
CREATE TABLE "planets" (
    "planet_id" INTEGER NOT NULL,
    "name" TEXT,
    "solar_system_id" INTEGER NOT NULL,
    "type_id" INTEGER,
    "orbit_index" INTEGER,
    "position_x" DOUBLE PRECISION,
    "position_y" DOUBLE PRECISION,
    "position_z" DOUBLE PRECISION,

    CONSTRAINT "planets_pkey" PRIMARY KEY ("planet_id")
);

-- CreateTable
CREATE TABLE "stars" (
    "star_id" INTEGER NOT NULL,
    "name" TEXT,
    "solar_system_id" INTEGER NOT NULL,
    "type_id" INTEGER,
    "spectral_class" TEXT,
    "temperature" INTEGER,
    "radius" DOUBLE PRECISION,
    "age" DOUBLE PRECISION,
    "luminosity" DOUBLE PRECISION,

    CONSTRAINT "stars_pkey" PRIMARY KEY ("star_id")
);

-- CreateTable
CREATE TABLE "stargates" (
    "stargate_id" INTEGER NOT NULL,
    "name" TEXT,
    "solar_system_id" INTEGER NOT NULL,
    "destination_system_id" INTEGER,
    "destination_stargate_id" INTEGER,
    "type_id" INTEGER,
    "position_x" DOUBLE PRECISION,
    "position_y" DOUBLE PRECISION,
    "position_z" DOUBLE PRECISION,

    CONSTRAINT "stargates_pkey" PRIMARY KEY ("stargate_id")
);

-- CreateTable
CREATE TABLE "stations" (
    "station_id" INTEGER NOT NULL,
    "name" TEXT,
    "solar_system_id" INTEGER NOT NULL,
    "type_id" INTEGER,
    "owner_corporation_id" INTEGER,
    "race_id" INTEGER,
    "reprocessing_efficiency" DOUBLE PRECISION,
    "reprocessing_stations_take" DOUBLE PRECISION,
    "office_rental_cost" DOUBLE PRECISION,
    "max_dockable_ship_volume" DOUBLE PRECISION,
    "services" TEXT[],
    "position_x" DOUBLE PRECISION,
    "position_y" DOUBLE PRECISION,
    "position_z" DOUBLE PRECISION,

    CONSTRAINT "stations_pkey" PRIMARY KEY ("station_id")
);

-- CreateIndex
CREATE INDEX "asteroid_belts_solar_system_id_idx" ON "asteroid_belts"("solar_system_id");

-- CreateIndex
CREATE INDEX "asteroid_belts_planet_id_idx" ON "asteroid_belts"("planet_id");

-- CreateIndex
CREATE INDEX "moons_solar_system_id_idx" ON "moons"("solar_system_id");

-- CreateIndex
CREATE INDEX "moons_planet_id_idx" ON "moons"("planet_id");

-- CreateIndex
CREATE INDEX "planets_solar_system_id_idx" ON "planets"("solar_system_id");

-- CreateIndex
CREATE UNIQUE INDEX "stars_solar_system_id_key" ON "stars"("solar_system_id");

-- CreateIndex
CREATE INDEX "stargates_solar_system_id_idx" ON "stargates"("solar_system_id");

-- CreateIndex
CREATE INDEX "stargates_destination_system_id_idx" ON "stargates"("destination_system_id");

-- CreateIndex
CREATE INDEX "stations_solar_system_id_idx" ON "stations"("solar_system_id");

-- CreateIndex
CREATE INDEX "killmails_solar_system_id_killmail_time_idx" ON "killmails"("solar_system_id", "killmail_time");

-- AddForeignKey
ALTER TABLE "asteroid_belts" ADD CONSTRAINT "asteroid_belts_solar_system_id_fkey" FOREIGN KEY ("solar_system_id") REFERENCES "solar_systems"("system_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asteroid_belts" ADD CONSTRAINT "asteroid_belts_planet_id_fkey" FOREIGN KEY ("planet_id") REFERENCES "planets"("planet_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moons" ADD CONSTRAINT "moons_solar_system_id_fkey" FOREIGN KEY ("solar_system_id") REFERENCES "solar_systems"("system_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moons" ADD CONSTRAINT "moons_planet_id_fkey" FOREIGN KEY ("planet_id") REFERENCES "planets"("planet_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planets" ADD CONSTRAINT "planets_solar_system_id_fkey" FOREIGN KEY ("solar_system_id") REFERENCES "solar_systems"("system_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stars" ADD CONSTRAINT "stars_solar_system_id_fkey" FOREIGN KEY ("solar_system_id") REFERENCES "solar_systems"("system_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stargates" ADD CONSTRAINT "stargates_solar_system_id_fkey" FOREIGN KEY ("solar_system_id") REFERENCES "solar_systems"("system_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stations" ADD CONSTRAINT "stations_solar_system_id_fkey" FOREIGN KEY ("solar_system_id") REFERENCES "solar_systems"("system_id") ON DELETE CASCADE ON UPDATE CASCADE;

