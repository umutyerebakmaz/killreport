-- Add security_status and security_class columns to killmail_filters table
-- This allows filtering by security status ranges and wormhole killmails efficiently

-- Step 1: Add the security_status and security_class columns
ALTER TABLE killmail_filters
ADD COLUMN IF NOT EXISTS security_status DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS security_class VARCHAR(2);

-- Step 2: Populate the columns with existing data from solar_systems
UPDATE killmail_filters kf
SET
    security_status = ss.security_status,
    security_class = ss.security_class
FROM solar_systems ss
WHERE kf.solar_system_id = ss.system_id
AND (kf.security_status IS NULL OR kf.security_class IS NULL);

-- Step 3: Create index for security_status range queries (e.g., lowsec, nullsec, highsec)
CREATE INDEX IF NOT EXISTS idx_kmfilters_security_status
ON killmail_filters(security_status);

-- Step 4: Create index for security_class filtering
CREATE INDEX IF NOT EXISTS idx_kmfilters_security_class
ON killmail_filters(security_class);

-- Step 5: Create partial index for wormhole queries (WHERE security_class IS NULL)
CREATE INDEX IF NOT EXISTS idx_kmfilters_wormhole
ON killmail_filters(solar_system_id)
WHERE security_class IS NULL;

-- Step 6: Create composite index for common filter combinations (security + time)
CREATE INDEX IF NOT EXISTS idx_kmfilters_security_status_time
ON killmail_filters(security_status, killmail_time DESC);

-- Step 7: Create composite index for security_class + time
CREATE INDEX IF NOT EXISTS idx_kmfilters_security_class_time
ON killmail_filters(security_class, killmail_time DESC);
