-- Add value fields to killmails table for performance optimization
-- These will be calculated once during killmail insertion

ALTER TABLE "killmails" 
ADD COLUMN "total_value" DOUBLE PRECISION,
ADD COLUMN "destroyed_value" DOUBLE PRECISION,
ADD COLUMN "dropped_value" DOUBLE PRECISION;

-- Add index for value-based queries
CREATE INDEX "killmails_total_value_idx" ON "killmails"("total_value" DESC NULLS LAST);
