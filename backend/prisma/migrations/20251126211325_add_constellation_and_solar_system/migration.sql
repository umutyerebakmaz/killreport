-- CreateTable
CREATE TABLE "constellations" (
    "constellation_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "region_id" INTEGER,
    "position_x" DOUBLE PRECISION,
    "position_y" DOUBLE PRECISION,
    "position_z" DOUBLE PRECISION,

    CONSTRAINT "constellations_pkey" PRIMARY KEY ("constellation_id")
);

-- CreateTable
CREATE TABLE "solar_systems" (
    "system_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "constellation_id" INTEGER,
    "security_status" DOUBLE PRECISION,
    "security_class" TEXT,
    "star_id" INTEGER,
    "position_x" DOUBLE PRECISION,
    "position_y" DOUBLE PRECISION,
    "position_z" DOUBLE PRECISION,

    CONSTRAINT "solar_systems_pkey" PRIMARY KEY ("system_id")
);
