/*
  Warnings:

  - You are about to drop the column `updateStrategy` on the `Bundle` table. All the data in the column will be lost.

*/
-- CreateEnum
-- Idempotent: Check if enum exists before creating
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ClaimStatus') THEN
        CREATE TYPE "ClaimStatus" AS ENUM ('PENDING', 'FULFILLED', 'EXPIRED', 'REVOKED');
    END IF;
END $$;

-- CreateEnum
-- Idempotent: Check if enum exists before creating
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SetStatus') THEN
        CREATE TYPE "SetStatus" AS ENUM ('ACTIVE', 'INACTIVE');
    END IF;
END $$;

-- AlterTable
-- Idempotent: Drop column only if it exists, add columns only if they don't exist
DO $$ 
BEGIN
    -- Drop updateStrategy column if it exists
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'Bundle' AND column_name = 'updateStrategy'
    ) THEN
        ALTER TABLE "Bundle" DROP COLUMN "updateStrategy";
    END IF;
    
    -- Add autoOpen column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'Bundle' AND column_name = 'autoOpen'
    ) THEN
        ALTER TABLE "Bundle" ADD COLUMN "autoOpen" BOOLEAN NOT NULL DEFAULT false;
    END IF;
    
    -- Add forceUpdate column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'Bundle' AND column_name = 'forceUpdate'
    ) THEN
        ALTER TABLE "Bundle" ADD COLUMN "forceUpdate" BOOLEAN NOT NULL DEFAULT false;
    END IF;
END $$;

-- CreateTable
-- Idempotent: Check if table exists before creating
CREATE TABLE IF NOT EXISTS "DeviceActionLog" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "initiatedBy" TEXT NOT NULL,
    "initiatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    "progress" INTEGER,
    "message" TEXT,
    "error" TEXT,
    "metadata" JSONB,
    "requestId" TEXT,
    "connectionId" TEXT,
    "protocol" TEXT,

    CONSTRAINT "DeviceActionLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
-- Idempotent: Check if table exists before creating
CREATE TABLE IF NOT EXISTS "BundleInstallSession" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "totalDevices" INTEGER NOT NULL,
    "totalBundles" INTEGER NOT NULL,
    "totalBatches" INTEGER NOT NULL,
    "completedBatches" INTEGER NOT NULL DEFAULT 0,
    "successfulDevices" INTEGER NOT NULL DEFAULT 0,
    "failedDevices" INTEGER NOT NULL DEFAULT 0,
    "pendingDevices" INTEGER NOT NULL DEFAULT 0,
    "initiatedBy" TEXT NOT NULL,
    "initiatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "estimatedDuration" INTEGER,
    "actualDuration" INTEGER,
    "metadata" JSONB,

    CONSTRAINT "BundleInstallSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
-- Idempotent: Check if table exists before creating
CREATE TABLE IF NOT EXISTS "BundleInstallBatch" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "batchNumber" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "deviceCount" INTEGER NOT NULL,
    "successfulDevices" INTEGER NOT NULL DEFAULT 0,
    "failedDevices" INTEGER NOT NULL DEFAULT 0,
    "pendingDevices" INTEGER NOT NULL DEFAULT 0,
    "initiatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "duration" INTEGER,
    "error" TEXT,
    "metadata" JSONB,

    CONSTRAINT "BundleInstallBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
-- Idempotent: Check if table exists before creating
CREATE TABLE IF NOT EXISTS "BundleInstallDevice" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "currentBundle" TEXT,
    "currentBundleIdx" INTEGER NOT NULL DEFAULT 0,
    "totalBundles" INTEGER NOT NULL,
    "successfulBundles" INTEGER NOT NULL DEFAULT 0,
    "failedBundles" INTEGER NOT NULL DEFAULT 0,
    "initiatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "duration" INTEGER,
    "error" TEXT,
    "metadata" JSONB,

    CONSTRAINT "BundleInstallDevice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
-- Idempotent: Check if table exists before creating
CREATE TABLE IF NOT EXISTS "BundleInstallBundle" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "bundleId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "message" TEXT,
    "error" TEXT,
    "initiatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "duration" INTEGER,
    "metadata" JSONB,

    CONSTRAINT "BundleInstallBundle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
-- Idempotent: Check if table exists before creating
CREATE TABLE IF NOT EXISTS "BundleInstallError" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "batchId" TEXT,
    "deviceId" TEXT,
    "bundleId" TEXT,
    "errorType" TEXT NOT NULL,
    "errorCode" TEXT NOT NULL,
    "errorMessage" TEXT NOT NULL,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "maxRetries" INTEGER NOT NULL DEFAULT 3,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "BundleInstallError_pkey" PRIMARY KEY ("id")
);

-- CreateTable
-- Idempotent: Check if table exists before creating
CREATE TABLE IF NOT EXISTS "PreclaimSet" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "SetStatus" NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,

    CONSTRAINT "PreclaimSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
-- Idempotent: Check if table exists before creating
CREATE TABLE IF NOT EXISTS "PreclaimDevice" (
    "id" TEXT NOT NULL,
    "macId" TEXT NOT NULL,
    "name" TEXT,
    "description" TEXT,
    "status" "ClaimStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3),
    "claimedAt" TIMESTAMP(3),
    "claimedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "accountId" TEXT NOT NULL,
    "setId" TEXT NOT NULL,
    "deviceId" TEXT,

    CONSTRAINT "PreclaimDevice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
-- Idempotent: Check if index exists before creating
CREATE INDEX IF NOT EXISTS "DeviceActionLog_deviceId_idx" ON "DeviceActionLog"("deviceId");

-- CreateIndex
-- Idempotent: Check if index exists before creating
CREATE INDEX IF NOT EXISTS "DeviceActionLog_actionType_idx" ON "DeviceActionLog"("actionType");

-- CreateIndex
-- Idempotent: Check if index exists before creating
CREATE INDEX IF NOT EXISTS "DeviceActionLog_status_idx" ON "DeviceActionLog"("status");

-- CreateIndex
-- Idempotent: Check if index exists before creating
CREATE INDEX IF NOT EXISTS "DeviceActionLog_initiatedBy_idx" ON "DeviceActionLog"("initiatedBy");

-- CreateIndex
-- Idempotent: Check if index exists before creating
CREATE INDEX IF NOT EXISTS "DeviceActionLog_initiatedAt_idx" ON "DeviceActionLog"("initiatedAt");

-- CreateIndex
-- Idempotent: Check if index exists before creating
CREATE INDEX IF NOT EXISTS "BundleInstallSession_initiatedBy_idx" ON "BundleInstallSession"("initiatedBy");

-- CreateIndex
-- Idempotent: Check if index exists before creating
CREATE INDEX IF NOT EXISTS "BundleInstallSession_status_idx" ON "BundleInstallSession"("status");

-- CreateIndex
-- Idempotent: Check if index exists before creating
CREATE INDEX IF NOT EXISTS "BundleInstallSession_initiatedAt_idx" ON "BundleInstallSession"("initiatedAt");

-- CreateIndex
-- Idempotent: Check if index exists before creating
CREATE INDEX IF NOT EXISTS "BundleInstallBatch_sessionId_idx" ON "BundleInstallBatch"("sessionId");

-- CreateIndex
-- Idempotent: Check if index exists before creating
CREATE INDEX IF NOT EXISTS "BundleInstallBatch_batchNumber_idx" ON "BundleInstallBatch"("batchNumber");

-- CreateIndex
-- Idempotent: Check if index exists before creating
CREATE INDEX IF NOT EXISTS "BundleInstallBatch_status_idx" ON "BundleInstallBatch"("status");

-- CreateIndex
-- Idempotent: Check if index exists before creating
CREATE INDEX IF NOT EXISTS "BundleInstallDevice_sessionId_idx" ON "BundleInstallDevice"("sessionId");

-- CreateIndex
-- Idempotent: Check if index exists before creating
CREATE INDEX IF NOT EXISTS "BundleInstallDevice_batchId_idx" ON "BundleInstallDevice"("batchId");

-- CreateIndex
-- Idempotent: Check if index exists before creating
CREATE INDEX IF NOT EXISTS "BundleInstallDevice_deviceId_idx" ON "BundleInstallDevice"("deviceId");

-- CreateIndex
-- Idempotent: Check if index exists before creating
CREATE INDEX IF NOT EXISTS "BundleInstallDevice_status_idx" ON "BundleInstallDevice"("status");

-- CreateIndex
-- Idempotent: Check if index exists before creating
CREATE INDEX IF NOT EXISTS "BundleInstallBundle_sessionId_idx" ON "BundleInstallBundle"("sessionId");

-- CreateIndex
-- Idempotent: Check if index exists before creating
CREATE INDEX IF NOT EXISTS "BundleInstallBundle_batchId_idx" ON "BundleInstallBundle"("batchId");

-- CreateIndex
-- Idempotent: Check if index exists before creating
CREATE INDEX IF NOT EXISTS "BundleInstallBundle_deviceId_idx" ON "BundleInstallBundle"("deviceId");

-- CreateIndex
-- Idempotent: Check if index exists before creating
CREATE INDEX IF NOT EXISTS "BundleInstallBundle_bundleId_idx" ON "BundleInstallBundle"("bundleId");

-- CreateIndex
-- Idempotent: Check if index exists before creating
CREATE INDEX IF NOT EXISTS "BundleInstallBundle_status_idx" ON "BundleInstallBundle"("status");

-- CreateIndex
-- Idempotent: Check if index exists before creating
CREATE INDEX IF NOT EXISTS "BundleInstallError_sessionId_idx" ON "BundleInstallError"("sessionId");

-- CreateIndex
-- Idempotent: Check if index exists before creating
CREATE INDEX IF NOT EXISTS "BundleInstallError_batchId_idx" ON "BundleInstallError"("batchId");

-- CreateIndex
-- Idempotent: Check if index exists before creating
CREATE INDEX IF NOT EXISTS "BundleInstallError_deviceId_idx" ON "BundleInstallError"("deviceId");

-- CreateIndex
-- Idempotent: Check if index exists before creating
CREATE INDEX IF NOT EXISTS "BundleInstallError_bundleId_idx" ON "BundleInstallError"("bundleId");

-- CreateIndex
-- Idempotent: Check if index exists before creating
CREATE INDEX IF NOT EXISTS "BundleInstallError_errorType_idx" ON "BundleInstallError"("errorType");

-- CreateIndex
-- Idempotent: Check if index exists before creating
CREATE INDEX IF NOT EXISTS "BundleInstallError_timestamp_idx" ON "BundleInstallError"("timestamp");

-- CreateIndex
-- Idempotent: Check if index exists before creating
CREATE INDEX IF NOT EXISTS "PreclaimSet_accountId_idx" ON "PreclaimSet"("accountId");

-- CreateIndex
-- Idempotent: Check if index exists before creating
CREATE INDEX IF NOT EXISTS "PreclaimSet_status_idx" ON "PreclaimSet"("status");

-- CreateIndex
-- Idempotent: Check if index exists before creating
CREATE INDEX IF NOT EXISTS "PreclaimSet_expiresAt_idx" ON "PreclaimSet"("expiresAt");

-- CreateIndex
-- Idempotent: Check if unique index exists before creating
CREATE UNIQUE INDEX IF NOT EXISTS "PreclaimSet_accountId_name_key" ON "PreclaimSet"("accountId", "name");

-- CreateIndex
-- Idempotent: Check if index exists before creating
CREATE INDEX IF NOT EXISTS "PreclaimDevice_macId_idx" ON "PreclaimDevice"("macId");

-- CreateIndex
-- Idempotent: Check if index exists before creating
CREATE INDEX IF NOT EXISTS "PreclaimDevice_status_idx" ON "PreclaimDevice"("status");

-- CreateIndex
-- Idempotent: Check if index exists before creating
CREATE INDEX IF NOT EXISTS "PreclaimDevice_expiresAt_idx" ON "PreclaimDevice"("expiresAt");

-- CreateIndex
-- Idempotent: Check if index exists before creating
CREATE INDEX IF NOT EXISTS "PreclaimDevice_accountId_idx" ON "PreclaimDevice"("accountId");

-- CreateIndex
-- Idempotent: Check if unique index exists before creating
CREATE UNIQUE INDEX IF NOT EXISTS "PreclaimDevice_setId_macId_key" ON "PreclaimDevice"("setId", "macId");

-- AddForeignKey
-- Idempotent: Check if constraint exists before adding
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'DeviceActionLog_deviceId_fkey'
    ) THEN
        ALTER TABLE "DeviceActionLog" ADD CONSTRAINT "DeviceActionLog_deviceId_fkey" 
        FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
-- Idempotent: Check if constraint exists before adding
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'DeviceActionLog_initiatedBy_fkey'
    ) THEN
        ALTER TABLE "DeviceActionLog" ADD CONSTRAINT "DeviceActionLog_initiatedBy_fkey" 
        FOREIGN KEY ("initiatedBy") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
-- Idempotent: Check if constraint exists before adding
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'Bundle_accountId_fkey'
    ) THEN
        ALTER TABLE "Bundle" ADD CONSTRAINT "Bundle_accountId_fkey" 
        FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
-- Idempotent: Check if constraint exists before adding
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'BundleInstallSession_initiatedBy_fkey'
    ) THEN
        ALTER TABLE "BundleInstallSession" ADD CONSTRAINT "BundleInstallSession_initiatedBy_fkey" 
        FOREIGN KEY ("initiatedBy") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
-- Idempotent: Check if constraint exists before adding
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'BundleInstallBatch_sessionId_fkey'
    ) THEN
        ALTER TABLE "BundleInstallBatch" ADD CONSTRAINT "BundleInstallBatch_sessionId_fkey" 
        FOREIGN KEY ("sessionId") REFERENCES "BundleInstallSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
-- Idempotent: Check if constraint exists before adding
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'BundleInstallDevice_sessionId_fkey'
    ) THEN
        ALTER TABLE "BundleInstallDevice" ADD CONSTRAINT "BundleInstallDevice_sessionId_fkey" 
        FOREIGN KEY ("sessionId") REFERENCES "BundleInstallSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
-- Idempotent: Check if constraint exists before adding
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'BundleInstallDevice_batchId_fkey'
    ) THEN
        ALTER TABLE "BundleInstallDevice" ADD CONSTRAINT "BundleInstallDevice_batchId_fkey" 
        FOREIGN KEY ("batchId") REFERENCES "BundleInstallBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
-- Idempotent: Check if constraint exists before adding
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'BundleInstallDevice_deviceId_fkey'
    ) THEN
        ALTER TABLE "BundleInstallDevice" ADD CONSTRAINT "BundleInstallDevice_deviceId_fkey" 
        FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
-- Idempotent: Check if constraint exists before adding
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'BundleInstallBundle_sessionId_fkey'
    ) THEN
        ALTER TABLE "BundleInstallBundle" ADD CONSTRAINT "BundleInstallBundle_sessionId_fkey" 
        FOREIGN KEY ("sessionId") REFERENCES "BundleInstallSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
-- Idempotent: Check if constraint exists before adding
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'BundleInstallBundle_batchId_fkey'
    ) THEN
        ALTER TABLE "BundleInstallBundle" ADD CONSTRAINT "BundleInstallBundle_batchId_fkey" 
        FOREIGN KEY ("batchId") REFERENCES "BundleInstallBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
-- Idempotent: Check if constraint exists before adding
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'BundleInstallBundle_deviceId_fkey'
    ) THEN
        ALTER TABLE "BundleInstallBundle" ADD CONSTRAINT "BundleInstallBundle_deviceId_fkey" 
        FOREIGN KEY ("deviceId") REFERENCES "BundleInstallDevice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
-- Idempotent: Check if constraint exists before adding
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'BundleInstallBundle_bundleId_fkey'
    ) THEN
        ALTER TABLE "BundleInstallBundle" ADD CONSTRAINT "BundleInstallBundle_bundleId_fkey" 
        FOREIGN KEY ("bundleId") REFERENCES "Bundle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
-- Idempotent: Check if constraint exists before adding
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'BundleInstallError_sessionId_fkey'
    ) THEN
        ALTER TABLE "BundleInstallError" ADD CONSTRAINT "BundleInstallError_sessionId_fkey" 
        FOREIGN KEY ("sessionId") REFERENCES "BundleInstallSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
-- Idempotent: Check if constraint exists before adding
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'PreclaimSet_accountId_fkey'
    ) THEN
        ALTER TABLE "PreclaimSet" ADD CONSTRAINT "PreclaimSet_accountId_fkey" 
        FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
-- Idempotent: Check if constraint exists before adding
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'PreclaimDevice_accountId_fkey'
    ) THEN
        ALTER TABLE "PreclaimDevice" ADD CONSTRAINT "PreclaimDevice_accountId_fkey" 
        FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
-- Idempotent: Check if constraint exists before adding
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'PreclaimDevice_setId_fkey'
    ) THEN
        ALTER TABLE "PreclaimDevice" ADD CONSTRAINT "PreclaimDevice_setId_fkey" 
        FOREIGN KEY ("setId") REFERENCES "PreclaimSet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
-- Idempotent: Check if constraint exists before adding
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'PreclaimDevice_deviceId_fkey'
    ) THEN
        ALTER TABLE "PreclaimDevice" ADD CONSTRAINT "PreclaimDevice_deviceId_fkey" 
        FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
