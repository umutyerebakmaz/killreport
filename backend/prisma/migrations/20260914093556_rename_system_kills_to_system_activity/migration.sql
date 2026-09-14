-- Renames, not a recreate. `prisma migrate diff` expresses a table rename as
-- DROP TABLE + CREATE TABLE, which would delete every hourly snapshot the
-- droplet has collected; this migration is hand-written so that no row is
-- touched. Every statement below is a RENAME or an ADD COLUMN.

-- AlterTable
ALTER TABLE "system_kills" RENAME TO "system_activity";

-- The sequence, the primary key, the two indexes and the unique index keep the
-- old name through a table rename. Renaming them too keeps a later
-- `migrate diff` from reporting drift that is only cosmetic.
ALTER SEQUENCE "system_kills_id_seq" RENAME TO "system_activity_id_seq";
ALTER INDEX "system_kills_pkey" RENAME TO "system_activity_pkey";
ALTER INDEX "system_kills_ship_kills_idx" RENAME TO "system_activity_ship_kills_idx";
ALTER INDEX "system_kills_system_id_timestamp_idx" RENAME TO "system_activity_system_id_timestamp_idx";
ALTER INDEX "system_kills_system_id_timestamp_key" RENAME TO "system_activity_system_id_timestamp_key";
ALTER TABLE "system_activity" RENAME CONSTRAINT "system_kills_system_id_fkey" TO "system_activity_system_id_fkey";

-- AlterTable
-- Nullable with no default, unlike the three kills columns. Every row that
-- already exists predates the jumps request, and DEFAULT 0 would backfill them
-- all with "no traffic that hour" — a fabricated flat line on the 7-day chart.
-- NULL says the hour was never reported.
ALTER TABLE "system_activity" ADD COLUMN "ship_jumps" INTEGER;
