/*
  Warnings:

  - You are about to drop the column `applicationError` on the `DeviceProfileAssignment` table. All the data in the column will be lost.
  - You are about to drop the column `applicationMessage` on the `DeviceProfileAssignment` table. All the data in the column will be lost.
  - You are about to drop the column `applicationStatus` on the `DeviceProfileAssignment` table. All the data in the column will be lost.
  - You are about to drop the column `attemptCount` on the `DeviceProfileAssignment` table. All the data in the column will be lost.
  - You are about to drop the column `lastAttemptAt` on the `DeviceProfileAssignment` table. All the data in the column will be lost.
  - Added the required column `token` to the `FactoryToken` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
-- Idempotent: Drop index only if it exists
DROP INDEX IF EXISTS "DeviceProfileAssignment_appliedAt_idx";

-- DropIndex
-- Idempotent: Drop index only if it exists
DROP INDEX IF EXISTS "DeviceProfileAssignment_lastAttemptAt_idx";

-- DropIndex
-- Idempotent: Drop index only if it exists
DROP INDEX IF EXISTS "DeviceProfileAssignment_status_idx";

-- AlterTable
-- Idempotent: Drop columns only if they exist
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'DeviceProfileAssignment' AND column_name = 'applicationError'
    ) THEN
        ALTER TABLE "DeviceProfileAssignment" DROP COLUMN "applicationError";
    END IF;
    
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'DeviceProfileAssignment' AND column_name = 'applicationMessage'
    ) THEN
        ALTER TABLE "DeviceProfileAssignment" DROP COLUMN "applicationMessage";
    END IF;
    
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'DeviceProfileAssignment' AND column_name = 'applicationStatus'
    ) THEN
        ALTER TABLE "DeviceProfileAssignment" DROP COLUMN "applicationStatus";
    END IF;
    
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'DeviceProfileAssignment' AND column_name = 'attemptCount'
    ) THEN
        ALTER TABLE "DeviceProfileAssignment" DROP COLUMN "attemptCount";
    END IF;
    
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'DeviceProfileAssignment' AND column_name = 'lastAttemptAt'
    ) THEN
        ALTER TABLE "DeviceProfileAssignment" DROP COLUMN "lastAttemptAt";
    END IF;
    
    -- Set default status (this is safe to run multiple times)
    ALTER TABLE "DeviceProfileAssignment" ALTER COLUMN "status" SET DEFAULT 'ACTIVE';
END $$;

-- AlterTable
-- Safe approach: Add column in 3 steps to handle existing data
-- Idempotent: Check if column exists before adding
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'FactoryToken' AND column_name = 'token'
    ) THEN
        -- Step 1: Add column as nullable
        ALTER TABLE "FactoryToken" ADD COLUMN "token" TEXT;
        
        -- Step 2: Populate existing rows with generated values
        UPDATE "FactoryToken" SET "token" = gen_random_uuid()::text WHERE "token" IS NULL;
        
        -- Step 3: Make column NOT NULL now that all rows have values
        ALTER TABLE "FactoryToken" ALTER COLUMN "token" SET NOT NULL;
    END IF;
END $$;
