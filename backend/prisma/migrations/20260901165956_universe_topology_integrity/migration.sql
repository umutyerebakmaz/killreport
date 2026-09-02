-- Universe topology integrity and index alignment.
--
-- The DROP TABLE statements prisma migrate diff produced for killmail_filters,
-- character_kill_stats, corporation_kill_stats, alliance_kill_stats and
-- refresh_log were removed by hand. Those five tables are created by hand
-- written SQL and read through $queryRaw; they are deliberately absent from
-- prisma/schema, so Prisma reports them as drift. Dropping them would have cost
-- 99,724 rows.

-- DropForeignKey
ALTER TABLE "asteroid_belts" DROP CONSTRAINT "asteroid_belts_planet_id_fkey";

-- DropForeignKey
ALTER TABLE "moons" DROP CONSTRAINT "moons_planet_id_fkey";

-- DropIndex
DROP INDEX "asteroid_belts_planet_id_idx";

-- DropIndex
DROP INDEX "moons_planet_id_idx";

-- DropIndex
DROP INDEX "planets_solar_system_id_idx";

-- DropIndex
DROP INDEX "stargates_solar_system_id_idx";

-- DropIndex
DROP INDEX "stations_solar_system_id_idx";


-- CreateIndex
CREATE INDEX "asteroid_belts_planet_id_orbit_index_asteroid_belt_id_idx" ON "asteroid_belts"("planet_id", "orbit_index", "asteroid_belt_id");

-- CreateIndex
CREATE INDEX "moons_planet_id_orbit_index_moon_id_idx" ON "moons"("planet_id", "orbit_index", "moon_id");

-- CreateIndex
CREATE INDEX "planets_solar_system_id_orbit_index_planet_id_idx" ON "planets"("solar_system_id", "orbit_index", "planet_id");

-- CreateIndex
CREATE UNIQUE INDEX "planets_planet_id_solar_system_id_key" ON "planets"("planet_id", "solar_system_id");

-- CreateIndex
CREATE INDEX "stargates_solar_system_id_stargate_id_idx" ON "stargates"("solar_system_id", "stargate_id");

-- CreateIndex
CREATE INDEX "stations_solar_system_id_station_id_idx" ON "stations"("solar_system_id", "station_id");

-- AddForeignKey
ALTER TABLE "asteroid_belts" ADD CONSTRAINT "asteroid_belts_planet_id_solar_system_id_fkey" FOREIGN KEY ("planet_id", "solar_system_id") REFERENCES "planets"("planet_id", "solar_system_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moons" ADD CONSTRAINT "moons_planet_id_solar_system_id_fkey" FOREIGN KEY ("planet_id", "solar_system_id") REFERENCES "planets"("planet_id", "solar_system_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stargates" ADD CONSTRAINT "stargates_destination_system_id_fkey" FOREIGN KEY ("destination_system_id") REFERENCES "solar_systems"("system_id") ON DELETE SET NULL ON UPDATE CASCADE;

