-- AlterTable
ALTER TABLE "factions" ADD COLUMN     "solar_system_id" INTEGER,
ADD COLUMN     "station_count" INTEGER,
ADD COLUMN     "station_system_count" INTEGER;

-- CreateIndex
CREATE INDEX "characters_faction_id_idx" ON "characters"("faction_id");

-- CreateIndex
CREATE INDEX "corporations_faction_id_idx" ON "corporations"("faction_id");

-- killmail_filters is not in prisma/schema/ (see CLAUDE.md, Database
-- migrations), so its faction columns are written by hand. They mirror
-- victim_alliance_id / attacker_alliance_ids: nullable, no default.
ALTER TABLE killmail_filters
  ADD COLUMN victim_faction_id    int,
  ADD COLUMN attacker_faction_ids int[];

CREATE INDEX idx_kmfilters_victim_faction
  ON killmail_filters(victim_faction_id);
CREATE INDEX idx_kmfilters_attacker_factions
  ON killmail_filters USING GIN(attacker_faction_ids);

-- Backfill. The raw ids are stored, 500021 ("Unknown") included; readers
-- filter it out.
UPDATE killmail_filters kf
SET    victim_faction_id = v.faction_id
FROM   victims v
WHERE  v.killmail_id = kf.killmail_id
  AND  v.faction_id IS NOT NULL;

UPDATE killmail_filters kf
SET    attacker_faction_ids = COALESCE(a.ids, '{}')
FROM   (SELECT killmail_id,
               array_agg(DISTINCT faction_id)
                 FILTER (WHERE faction_id IS NOT NULL) AS ids
        FROM   attackers
        GROUP  BY killmail_id) a
WHERE  a.killmail_id = kf.killmail_id;

-- A killmail whose attackers were never saved has no row in the subquery
-- above. insertKillmailFilter writes '{}' for it, so the backfill does too.
UPDATE killmail_filters
SET    attacker_faction_ids = '{}'
WHERE  attacker_faction_ids IS NULL;
