-- This migration resolves schema drift by ensuring the database matches schema.prisma
-- It's idempotent and safe to run multiple times

-- Drop old tables if they exist (they were replaced by Controller/Sensor)
-- These are idempotent - will only drop if they exist
DROP TABLE IF EXISTS "DwellBucket" CASCADE;
DROP TABLE IF EXISTS "Zone" CASCADE;
DROP TABLE IF EXISTS "TrackingArea" CASCADE;
DROP TABLE IF EXISTS "RadarSensor" CASCADE;
DROP TABLE IF EXISTS "CronJobExecution" CASCADE;
DROP TABLE IF EXISTS "CronJob" CASCADE;

-- Drop old enum if it exists
DROP TYPE IF EXISTS "CronJobStatus" CASCADE;

-- Ensure Controller and Sensor tables exist (they should already exist from baseline migration)
-- This is handled by the baseline_controller_sensor migration, but we ensure it here too
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'Controller') THEN
        RAISE EXCEPTION 'Controller table should exist from baseline migration';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'Sensor') THEN
        RAISE EXCEPTION 'Sensor table should exist from baseline migration';
    END IF;
END $$;

-- Ensure FactoryDevice has the correct unique constraints
-- Prisma expects these as unique constraints, not conditional indexes
-- Drop existing conditional indexes if they exist
DROP INDEX IF EXISTS "FactoryDevice_claimedDeviceId_key";
DROP INDEX IF EXISTS "FactoryDevice_hardwareFingerprint_key";

-- Create proper unique constraints (Prisma's expected format)
-- These will be created as unique indexes by Prisma, but we ensure they exist
DO $$ 
BEGIN
    -- For claimedDeviceId - create unique index (Prisma uses indexes for @unique())
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'FactoryDevice' AND indexname = 'FactoryDevice_claimedDeviceId_key'
    ) THEN
        CREATE UNIQUE INDEX "FactoryDevice_claimedDeviceId_key" ON "FactoryDevice"("claimedDeviceId");
    END IF;
    
    -- For hardwareFingerprint - create unique index
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'FactoryDevice' AND indexname = 'FactoryDevice_hardwareFingerprint_key'
    ) THEN
        CREATE UNIQUE INDEX "FactoryDevice_hardwareFingerprint_key" ON "FactoryDevice"("hardwareFingerprint");
    END IF;
END $$;

-- This migration is a no-op if everything is already in sync
-- It just ensures old tables are removed and new ones are in place

