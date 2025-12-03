-- CreateTable
CREATE TABLE "categories" (
    "id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "constellations_region_id_idx" ON "constellations"("region_id");

-- CreateIndex
CREATE INDEX "solar_systems_constellation_id_idx" ON "solar_systems"("constellation_id");

-- AddForeignKey
ALTER TABLE "constellations" ADD CONSTRAINT "constellations_region_id_fkey" FOREIGN KEY ("region_id") REFERENCES "regions"("region_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solar_systems" ADD CONSTRAINT "solar_systems_constellation_id_fkey" FOREIGN KEY ("constellation_id") REFERENCES "constellations"("constellation_id") ON DELETE SET NULL ON UPDATE CASCADE;
