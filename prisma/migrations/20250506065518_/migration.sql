-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Device" (
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
    "connected" BOOLEAN NOT NULL DEFAULT false,
    "connectedAt" DATETIME,
    "disconnectedAt" DATETIME,
    CONSTRAINT "Device_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Device" ("apiKey", "apiKeyCreatedAt", "apiKeyRotatedAt", "claimedAt", "claimedBy", "createdAt", "createdBy", "description", "deviceType", "expiresAt", "firmwareVersion", "hardwareId", "id", "ipAddress", "lanMac", "lastUsedAt", "manufacturer", "model", "name", "osVersion", "status", "updatedAt", "wifiMac") SELECT "apiKey", "apiKeyCreatedAt", "apiKeyRotatedAt", "claimedAt", "claimedBy", "createdAt", "createdBy", "description", "deviceType", "expiresAt", "firmwareVersion", "hardwareId", "id", "ipAddress", "lanMac", "lastUsedAt", "manufacturer", "model", "name", "osVersion", "status", "updatedAt", "wifiMac" FROM "Device";
DROP TABLE "Device";
ALTER TABLE "new_Device" RENAME TO "Device";
CREATE UNIQUE INDEX "Device_apiKey_key" ON "Device"("apiKey");
CREATE INDEX "Device_createdBy_idx" ON "Device"("createdBy");
CREATE INDEX "Device_hardwareId_idx" ON "Device"("hardwareId");
CREATE INDEX "Device_status_idx" ON "Device"("status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
