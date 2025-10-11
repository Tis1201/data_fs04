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
DROP INDEX "DeviceProfileAssignment_appliedAt_idx";

-- DropIndex
DROP INDEX "DeviceProfileAssignment_lastAttemptAt_idx";

-- DropIndex
DROP INDEX "DeviceProfileAssignment_status_idx";

-- AlterTable
ALTER TABLE "DeviceProfileAssignment" DROP COLUMN "applicationError",
DROP COLUMN "applicationMessage",
DROP COLUMN "applicationStatus",
DROP COLUMN "attemptCount",
DROP COLUMN "lastAttemptAt",
ALTER COLUMN "status" SET DEFAULT 'ACTIVE';

-- AlterTable
-- Safe approach: Add column in 3 steps to handle existing data
-- Step 1: Add column as nullable
ALTER TABLE "FactoryToken" ADD COLUMN "token" TEXT;

-- Step 2: Populate existing rows with generated values
UPDATE "FactoryToken" SET "token" = gen_random_uuid()::text WHERE "token" IS NULL;

-- Step 3: Make column NOT NULL now that all rows have values
ALTER TABLE "FactoryToken" ALTER COLUMN "token" SET NOT NULL;
