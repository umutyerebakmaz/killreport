-- DropForeignKey
ALTER TABLE "public"."constellations" DROP CONSTRAINT "constellations_region_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."solar_systems" DROP CONSTRAINT "solar_systems_constellation_id_fkey";

-- AddForeignKey
ALTER TABLE "constellations" ADD CONSTRAINT "constellations_region_id_fkey" FOREIGN KEY ("region_id") REFERENCES "regions"("region_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solar_systems" ADD CONSTRAINT "solar_systems_constellation_id_fkey" FOREIGN KEY ("constellation_id") REFERENCES "constellations"("constellation_id") ON DELETE RESTRICT ON UPDATE CASCADE;
