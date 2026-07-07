-- Sovereignty Cluster B1: backfill `outcome` for campaigns that ended before the
-- campaigns worker started inferring it. Same heuristic as inferOutcome()
-- (EPS = 0.05; defender wins ties). Idempotent — only touches ended rows whose
-- outcome is still NULL, so it is a no-op where B1 already populated them.
UPDATE "sovereignty_campaigns"
SET "outcome" = CASE
  WHEN "defender_score" IS NULL AND "attackers_score" IS NULL THEN 'abandoned'
  WHEN GREATEST(COALESCE("defender_score", 0), COALESCE("attackers_score", 0)) < 0.05 THEN 'abandoned'
  WHEN COALESCE("defender_score", 0) >= COALESCE("attackers_score", 0) THEN 'defender_won'
  ELSE 'attacker_won'
END
WHERE "end_time" IS NOT NULL AND "outcome" IS NULL;
