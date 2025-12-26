/*
  Warnings:

  - You are about to drop the `DeviceAppPin` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
-- Idempotent: Drop constraint only if it exists
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'DeviceAppPin_deviceId_fkey'
    ) THEN
        ALTER TABLE "DeviceAppPin" DROP CONSTRAINT "DeviceAppPin_deviceId_fkey";
    END IF;
END $$;

-- DropForeignKey
-- Idempotent: Drop constraint only if it exists
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'DeviceAppPin_pinnedByRuleId_fkey'
    ) THEN
        ALTER TABLE "DeviceAppPin" DROP CONSTRAINT "DeviceAppPin_pinnedByRuleId_fkey";
    END IF;
END $$;

-- DropTable
-- Idempotent: Drop table only if it exists
DROP TABLE IF EXISTS "DeviceAppPin";
