-- Add ship_type_id index to attackers table for query performance
CREATE INDEX IF NOT EXISTS "attackers_ship_type_id_idx" ON "attackers"("ship_type_id");
