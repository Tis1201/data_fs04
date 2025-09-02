/*
  Warnings:

  - You are about to drop the column `updateStrategy` on the `Bundle` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "ClaimStatus" AS ENUM ('PENDING', 'FULFILLED', 'EXPIRED', 'REVOKED');

-- CreateEnum
CREATE TYPE "SetStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- AlterTable
ALTER TABLE "Bundle" DROP COLUMN "updateStrategy",
ADD COLUMN     "autoOpen" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "forceUpdate" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "DeviceActionLog" (
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
CREATE TABLE "BundleInstallSession" (
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
CREATE TABLE "BundleInstallBatch" (
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
CREATE TABLE "BundleInstallDevice" (
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
CREATE TABLE "BundleInstallBundle" (
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
CREATE TABLE "BundleInstallError" (
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
CREATE TABLE "PreclaimSet" (
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
CREATE TABLE "PreclaimDevice" (
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
CREATE INDEX "DeviceActionLog_deviceId_idx" ON "DeviceActionLog"("deviceId");

-- CreateIndex
CREATE INDEX "DeviceActionLog_actionType_idx" ON "DeviceActionLog"("actionType");

-- CreateIndex
CREATE INDEX "DeviceActionLog_status_idx" ON "DeviceActionLog"("status");

-- CreateIndex
CREATE INDEX "DeviceActionLog_initiatedBy_idx" ON "DeviceActionLog"("initiatedBy");

-- CreateIndex
CREATE INDEX "DeviceActionLog_initiatedAt_idx" ON "DeviceActionLog"("initiatedAt");

-- CreateIndex
CREATE INDEX "BundleInstallSession_initiatedBy_idx" ON "BundleInstallSession"("initiatedBy");

-- CreateIndex
CREATE INDEX "BundleInstallSession_status_idx" ON "BundleInstallSession"("status");

-- CreateIndex
CREATE INDEX "BundleInstallSession_initiatedAt_idx" ON "BundleInstallSession"("initiatedAt");

-- CreateIndex
CREATE INDEX "BundleInstallBatch_sessionId_idx" ON "BundleInstallBatch"("sessionId");

-- CreateIndex
CREATE INDEX "BundleInstallBatch_batchNumber_idx" ON "BundleInstallBatch"("batchNumber");

-- CreateIndex
CREATE INDEX "BundleInstallBatch_status_idx" ON "BundleInstallBatch"("status");

-- CreateIndex
CREATE INDEX "BundleInstallDevice_sessionId_idx" ON "BundleInstallDevice"("sessionId");

-- CreateIndex
CREATE INDEX "BundleInstallDevice_batchId_idx" ON "BundleInstallDevice"("batchId");

-- CreateIndex
CREATE INDEX "BundleInstallDevice_deviceId_idx" ON "BundleInstallDevice"("deviceId");

-- CreateIndex
CREATE INDEX "BundleInstallDevice_status_idx" ON "BundleInstallDevice"("status");

-- CreateIndex
CREATE INDEX "BundleInstallBundle_sessionId_idx" ON "BundleInstallBundle"("sessionId");

-- CreateIndex
CREATE INDEX "BundleInstallBundle_batchId_idx" ON "BundleInstallBundle"("batchId");

-- CreateIndex
CREATE INDEX "BundleInstallBundle_deviceId_idx" ON "BundleInstallBundle"("deviceId");

-- CreateIndex
CREATE INDEX "BundleInstallBundle_bundleId_idx" ON "BundleInstallBundle"("bundleId");

-- CreateIndex
CREATE INDEX "BundleInstallBundle_status_idx" ON "BundleInstallBundle"("status");

-- CreateIndex
CREATE INDEX "BundleInstallError_sessionId_idx" ON "BundleInstallError"("sessionId");

-- CreateIndex
CREATE INDEX "BundleInstallError_batchId_idx" ON "BundleInstallError"("batchId");

-- CreateIndex
CREATE INDEX "BundleInstallError_deviceId_idx" ON "BundleInstallError"("deviceId");

-- CreateIndex
CREATE INDEX "BundleInstallError_bundleId_idx" ON "BundleInstallError"("bundleId");

-- CreateIndex
CREATE INDEX "BundleInstallError_errorType_idx" ON "BundleInstallError"("errorType");

-- CreateIndex
CREATE INDEX "BundleInstallError_timestamp_idx" ON "BundleInstallError"("timestamp");

-- CreateIndex
CREATE INDEX "PreclaimSet_accountId_idx" ON "PreclaimSet"("accountId");

-- CreateIndex
CREATE INDEX "PreclaimSet_status_idx" ON "PreclaimSet"("status");

-- CreateIndex
CREATE INDEX "PreclaimSet_expiresAt_idx" ON "PreclaimSet"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "PreclaimSet_accountId_name_key" ON "PreclaimSet"("accountId", "name");

-- CreateIndex
CREATE INDEX "PreclaimDevice_macId_idx" ON "PreclaimDevice"("macId");

-- CreateIndex
CREATE INDEX "PreclaimDevice_status_idx" ON "PreclaimDevice"("status");

-- CreateIndex
CREATE INDEX "PreclaimDevice_expiresAt_idx" ON "PreclaimDevice"("expiresAt");

-- CreateIndex
CREATE INDEX "PreclaimDevice_accountId_idx" ON "PreclaimDevice"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "PreclaimDevice_setId_macId_key" ON "PreclaimDevice"("setId", "macId");

-- AddForeignKey
ALTER TABLE "DeviceActionLog" ADD CONSTRAINT "DeviceActionLog_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceActionLog" ADD CONSTRAINT "DeviceActionLog_initiatedBy_fkey" FOREIGN KEY ("initiatedBy") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bundle" ADD CONSTRAINT "Bundle_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BundleInstallSession" ADD CONSTRAINT "BundleInstallSession_initiatedBy_fkey" FOREIGN KEY ("initiatedBy") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BundleInstallBatch" ADD CONSTRAINT "BundleInstallBatch_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "BundleInstallSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BundleInstallDevice" ADD CONSTRAINT "BundleInstallDevice_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "BundleInstallSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BundleInstallDevice" ADD CONSTRAINT "BundleInstallDevice_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "BundleInstallBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BundleInstallDevice" ADD CONSTRAINT "BundleInstallDevice_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BundleInstallBundle" ADD CONSTRAINT "BundleInstallBundle_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "BundleInstallSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BundleInstallBundle" ADD CONSTRAINT "BundleInstallBundle_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "BundleInstallBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BundleInstallBundle" ADD CONSTRAINT "BundleInstallBundle_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "BundleInstallDevice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BundleInstallBundle" ADD CONSTRAINT "BundleInstallBundle_bundleId_fkey" FOREIGN KEY ("bundleId") REFERENCES "Bundle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BundleInstallError" ADD CONSTRAINT "BundleInstallError_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "BundleInstallSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreclaimSet" ADD CONSTRAINT "PreclaimSet_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreclaimDevice" ADD CONSTRAINT "PreclaimDevice_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreclaimDevice" ADD CONSTRAINT "PreclaimDevice_setId_fkey" FOREIGN KEY ("setId") REFERENCES "PreclaimSet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreclaimDevice" ADD CONSTRAINT "PreclaimDevice_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE SET NULL ON UPDATE CASCADE;
