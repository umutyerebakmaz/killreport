-- CreateTable
CREATE TABLE "type_dogma_attributes" (
    "type_id" INTEGER NOT NULL,
    "attribute_id" INTEGER NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "type_dogma_attributes_pkey" PRIMARY KEY ("type_id","attribute_id")
);

-- CreateTable
CREATE TABLE "type_dogma_effects" (
    "type_id" INTEGER NOT NULL,
    "effect_id" INTEGER NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "type_dogma_effects_pkey" PRIMARY KEY ("type_id","effect_id")
);

-- CreateIndex
CREATE INDEX "type_dogma_attributes_type_id_idx" ON "type_dogma_attributes"("type_id");

-- CreateIndex
CREATE INDEX "type_dogma_attributes_attribute_id_idx" ON "type_dogma_attributes"("attribute_id");

-- CreateIndex
CREATE INDEX "type_dogma_effects_type_id_idx" ON "type_dogma_effects"("type_id");

-- CreateIndex
CREATE INDEX "type_dogma_effects_effect_id_idx" ON "type_dogma_effects"("effect_id");

-- AddForeignKey
ALTER TABLE "type_dogma_attributes" ADD CONSTRAINT "type_dogma_attributes_type_id_fkey" FOREIGN KEY ("type_id") REFERENCES "types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "type_dogma_attributes" ADD CONSTRAINT "type_dogma_attributes_attribute_id_fkey" FOREIGN KEY ("attribute_id") REFERENCES "dogma_attributes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "type_dogma_effects" ADD CONSTRAINT "type_dogma_effects_type_id_fkey" FOREIGN KEY ("type_id") REFERENCES "types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "type_dogma_effects" ADD CONSTRAINT "type_dogma_effects_effect_id_fkey" FOREIGN KEY ("effect_id") REFERENCES "dogma_effects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
