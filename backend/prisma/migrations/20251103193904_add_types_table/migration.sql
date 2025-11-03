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

-- CreateIndex
CREATE INDEX "types_group_id_idx" ON "types"("group_id");
