-- CreateIndex
CREATE INDEX IF NOT EXISTS "victims_character_id_killmail_id_idx" ON "victims"("character_id", "killmail_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "victims_corporation_id_killmail_id_idx" ON "victims"("corporation_id", "killmail_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "victims_alliance_id_killmail_id_idx" ON "victims"("alliance_id", "killmail_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "attackers_character_id_killmail_id_idx" ON "attackers"("character_id", "killmail_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "attackers_corporation_id_killmail_id_idx" ON "attackers"("corporation_id", "killmail_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "attackers_alliance_id_killmail_id_idx" ON "attackers"("alliance_id", "killmail_id");
