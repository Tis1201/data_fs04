/*
  Warnings:

  - You are about to drop the `WaveInstallTask` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "WaveInstallTask";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "BundleDevice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bundleId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "createdBy" TEXT NOT NULL,
    "updatedBy" TEXT NOT NULL,
    CONSTRAINT "BundleDevice_bundleId_fkey" FOREIGN KEY ("bundleId") REFERENCES "Bundle" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BundleDeviceProgress" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bundleId" TEXT NOT NULL,
    "waveId" TEXT NOT NULL,
    "bundleDeviceId" TEXT NOT NULL,
    "transactionId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "result" TEXT,
    "errorDetails" TEXT,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "createdBy" TEXT NOT NULL,
    "updatedBy" TEXT NOT NULL,
    CONSTRAINT "BundleDeviceProgress_bundleId_fkey" FOREIGN KEY ("bundleId") REFERENCES "Bundle" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BundleDeviceProgress_waveId_fkey" FOREIGN KEY ("waveId") REFERENCES "BundleWave" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BundleDeviceProgress_bundleDeviceId_fkey" FOREIGN KEY ("bundleDeviceId") REFERENCES "BundleDevice" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "BundleDevice_bundleId_idx" ON "BundleDevice"("bundleId");

-- CreateIndex
CREATE INDEX "BundleDevice_deviceId_idx" ON "BundleDevice"("deviceId");

-- CreateIndex
CREATE INDEX "BundleDevice_status_idx" ON "BundleDevice"("status");

-- CreateIndex
CREATE UNIQUE INDEX "BundleDevice_bundleId_deviceId_key" ON "BundleDevice"("bundleId", "deviceId");

-- CreateIndex
CREATE INDEX "BundleDeviceProgress_bundleId_idx" ON "BundleDeviceProgress"("bundleId");

-- CreateIndex
CREATE INDEX "BundleDeviceProgress_waveId_idx" ON "BundleDeviceProgress"("waveId");

-- CreateIndex
CREATE INDEX "BundleDeviceProgress_bundleDeviceId_idx" ON "BundleDeviceProgress"("bundleDeviceId");

-- CreateIndex
CREATE INDEX "BundleDeviceProgress_status_idx" ON "BundleDeviceProgress"("status");

-- CreateIndex
CREATE INDEX "BundleDeviceProgress_createdAt_idx" ON "BundleDeviceProgress"("createdAt");
