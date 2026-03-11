-- CreateTable: system_kills (hourly snapshots)
CREATE TABLE IF NOT EXISTS "system_kills" (
    "id" SERIAL NOT NULL,
    "system_id" INTEGER NOT NULL,
    "npc_kills" INTEGER NOT NULL DEFAULT 0,
    "pod_kills" INTEGER NOT NULL DEFAULT 0,
    "ship_kills" INTEGER NOT NULL DEFAULT 0,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_kills_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "system_kills_system_id_timestamp_key" ON "system_kills"("system_id", "timestamp");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "system_kills_system_id_timestamp_idx" ON "system_kills"("system_id", "timestamp");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "system_kills_ship_kills_idx" ON "system_kills"("ship_kills");

-- AddForeignKey
ALTER TABLE "system_kills" ADD CONSTRAINT "system_kills_system_id_fkey" FOREIGN KEY ("system_id") REFERENCES "solar_systems"("system_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: Remove kill statistics from solar_systems (move to separate table)
ALTER TABLE "solar_systems" DROP COLUMN IF EXISTS "npc_kills";
ALTER TABLE "solar_systems" DROP COLUMN IF EXISTS "pod_kills";
ALTER TABLE "solar_systems" DROP COLUMN IF EXISTS "ship_kills";
ALTER TABLE "solar_systems" DROP COLUMN IF EXISTS "kills_updated_at";

-- DropIndex: Remove old indexes that are no longer needed
DROP INDEX IF EXISTS "solar_systems_ship_kills_idx";
DROP INDEX IF EXISTS "solar_systems_npc_kills_idx";
