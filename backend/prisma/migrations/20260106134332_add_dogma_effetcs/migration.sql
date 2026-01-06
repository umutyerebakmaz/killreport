-- CreateTable
CREATE TABLE "dogma_effects" (
    "id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "display_name" TEXT,
    "description" TEXT,
    "effect_category" INTEGER,
    "pre_expression" INTEGER,
    "post_expression" INTEGER,
    "icon_id" INTEGER,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "is_offensive" BOOLEAN NOT NULL DEFAULT false,
    "is_assistance" BOOLEAN NOT NULL DEFAULT false,
    "disallow_auto_repeat" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dogma_effects_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "dogma_effects_name_idx" ON "dogma_effects"("name");

-- CreateIndex
CREATE INDEX "dogma_effects_published_idx" ON "dogma_effects"("published");

-- CreateIndex
CREATE INDEX "dogma_effects_effect_category_idx" ON "dogma_effects"("effect_category");
