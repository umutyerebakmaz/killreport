-- CreateTable
CREATE TABLE "dogma_attributes" (
    "id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "display_name" TEXT,
    "description" TEXT,
    "unit_id" INTEGER,
    "icon_id" INTEGER,
    "default_value" DOUBLE PRECISION,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "stackable" BOOLEAN NOT NULL DEFAULT false,
    "high_is_good" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dogma_attributes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "dogma_attributes_name_idx" ON "dogma_attributes"("name");

-- CreateIndex
CREATE INDEX "dogma_attributes_published_idx" ON "dogma_attributes"("published");
