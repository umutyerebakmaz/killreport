-- CreateTable
CREATE TABLE "regions" (
    "region_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "regions_pkey" PRIMARY KEY ("region_id")
);
