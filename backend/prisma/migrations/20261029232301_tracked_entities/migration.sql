-- CreateEnum
CREATE TYPE "TrackedEntityType" AS ENUM ('CHARACTER', 'CORPORATION', 'ALLIANCE');

-- CreateTable
CREATE TABLE "tracked_entities" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "entity_type" "TrackedEntityType" NOT NULL,
    "entity_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tracked_entities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tracked_entities_user_id_idx" ON "tracked_entities"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "tracked_entities_user_id_entity_type_entity_id_key" ON "tracked_entities"("user_id", "entity_type", "entity_id");

-- AddForeignKey
ALTER TABLE "tracked_entities" ADD CONSTRAINT "tracked_entities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
