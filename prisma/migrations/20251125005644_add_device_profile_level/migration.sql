-- AlterTable: Add level column to DeviceProfile
-- This column indicates whether the profile is GLOBAL (account-level) or DEVICE (device-level copy)
-- Idempotent: Check if column exists before adding
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'DeviceProfile' AND column_name = 'level'
    ) THEN
        ALTER TABLE "DeviceProfile" ADD COLUMN "level" TEXT NOT NULL DEFAULT 'GLOBAL';
    END IF;
END $$;

-- AlterTable: Add deviceId column to DeviceProfile (nullable, only for DEVICE level profiles)
-- Idempotent: Check if column exists before adding
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'DeviceProfile' AND column_name = 'deviceId'
    ) THEN
        ALTER TABLE "DeviceProfile" ADD COLUMN "deviceId" TEXT;
    END IF;
END $$;

-- CreateIndex: Add index on level column for faster queries
-- Idempotent: Check if index exists before creating
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'DeviceProfile' AND indexname = 'DeviceProfile_level_idx'
    ) THEN
        CREATE INDEX "DeviceProfile_level_idx" ON "DeviceProfile"("level");
    END IF;
END $$;

-- CreateIndex: Add index on deviceId column for faster queries
-- Idempotent: Check if index exists before creating
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'DeviceProfile' AND indexname = 'DeviceProfile_deviceId_idx'
    ) THEN
        CREATE INDEX "DeviceProfile_deviceId_idx" ON "DeviceProfile"("deviceId");
    END IF;
END $$;

-- AddForeignKey: Add foreign key constraint for deviceId
-- Idempotent: Check if constraint exists before adding
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'DeviceProfile_deviceId_fkey'
    ) THEN
        ALTER TABLE "DeviceProfile" ADD CONSTRAINT "DeviceProfile_deviceId_fkey" 
        FOREIGN KEY ("deviceId") REFERENCES "Device"("id") 
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

