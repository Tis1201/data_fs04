-- CreateTable
CREATE TABLE "Device" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" DATETIME,
    "lastUsedAt" DATETIME,
    "createdBy" TEXT NOT NULL,
    "deviceType" TEXT,
    "model" TEXT,
    "manufacturer" TEXT,
    "osVersion" TEXT,
    "firmwareVersion" TEXT,
    "hardwareId" TEXT,
    "wifiMac" TEXT,
    "lanMac" TEXT,
    "ipAddress" TEXT,
    "apiKey" TEXT,
    "apiKeyCreatedAt" DATETIME,
    "apiKeyRotatedAt" DATETIME,
    "claimedAt" DATETIME,
    "claimedBy" TEXT,
    CONSTRAINT "Device_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Device_createdBy_idx" ON "Device"("createdBy");

-- CreateIndex
CREATE INDEX "Device_hardwareId_idx" ON "Device"("hardwareId");

-- CreateIndex
CREATE INDEX "Device_status_idx" ON "Device"("status");
