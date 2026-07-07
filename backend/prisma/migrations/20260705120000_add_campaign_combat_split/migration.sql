-- Sovereignty Cluster B2: attacker-vs-defender split of per-campaign combat stats.
-- Additive only. A kill is a defender loss when the victim alliance == campaign
-- defender_id, otherwise an attacker/third-party loss.

-- AlterTable
ALTER TABLE "campaign_combat_stats" ADD COLUMN     "defender_isk_lost" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "attacker_isk_lost" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "defender_ships_lost" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "attacker_ships_lost" INTEGER NOT NULL DEFAULT 0;
