-- Add attacker_count column to killmails table
ALTER TABLE "killmails" ADD COLUMN "attacker_count" INTEGER;

-- Create index on attacker_count for filtering performance
CREATE INDEX "killmails_attacker_count_idx" ON "killmails"("attacker_count");

-- Populate attacker_count for existing killmails
UPDATE "killmails"
SET "attacker_count" = (
    SELECT COUNT(*)
    FROM "attackers"
    WHERE "attackers"."killmail_id" = "killmails"."killmail_id"
);
