-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "description" TEXT,
    "logoUrl" TEXT,
    "settings" TEXT
);

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "description" TEXT,
    "address" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "accountId" TEXT NOT NULL,
    CONSTRAINT "Company_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AccountMembership" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "role" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "userId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    CONSTRAINT "AccountMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AccountMembership_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Group" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "permissions" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    CONSTRAINT "Group_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GroupMembership" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "groupId" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    CONSTRAINT "GroupMembership_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GroupMembership_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "AccountMembership" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ApiKey" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" DATETIME,
    "lastUsedAt" DATETIME,
    "userId" TEXT NOT NULL,
    "accountId" TEXT,
    CONSTRAINT "ApiKey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ApiKey_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ApiKey" ("active", "createdAt", "description", "expiresAt", "id", "key", "lastUsedAt", "name", "updatedAt", "userId") SELECT "active", "createdAt", "description", "expiresAt", "id", "key", "lastUsedAt", "name", "updatedAt", "userId" FROM "ApiKey";
DROP TABLE "ApiKey";
ALTER TABLE "new_ApiKey" RENAME TO "ApiKey";
CREATE UNIQUE INDEX "ApiKey_key_key" ON "ApiKey"("key");
CREATE INDEX "ApiKey_userId_idx" ON "ApiKey"("userId");
CREATE INDEX "ApiKey_key_idx" ON "ApiKey"("key");
CREATE INDEX "ApiKey_accountId_idx" ON "ApiKey"("accountId");
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
    "accountId" TEXT,
    "companyId" TEXT,
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
    CONSTRAINT "Device_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Device_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Device_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Device" ("apiKey", "apiKeyCreatedAt", "apiKeyRotatedAt", "claimedAt", "claimedBy", "connected", "connectedAt", "createdAt", "createdBy", "description", "deviceType", "disconnectedAt", "expiresAt", "firmwareVersion", "hardwareId", "id", "ipAddress", "lanMac", "lastUsedAt", "manufacturer", "model", "name", "osVersion", "status", "updatedAt", "wifiMac") SELECT "apiKey", "apiKeyCreatedAt", "apiKeyRotatedAt", "claimedAt", "claimedBy", "connected", "connectedAt", "createdAt", "createdBy", "description", "deviceType", "disconnectedAt", "expiresAt", "firmwareVersion", "hardwareId", "id", "ipAddress", "lanMac", "lastUsedAt", "manufacturer", "model", "name", "osVersion", "status", "updatedAt", "wifiMac" FROM "Device";
DROP TABLE "Device";
ALTER TABLE "new_Device" RENAME TO "Device";
CREATE UNIQUE INDEX "Device_apiKey_key" ON "Device"("apiKey");
CREATE INDEX "Device_createdBy_idx" ON "Device"("createdBy");
CREATE INDEX "Device_hardwareId_idx" ON "Device"("hardwareId");
CREATE INDEX "Device_status_idx" ON "Device"("status");
CREATE INDEX "Device_accountId_idx" ON "Device"("accountId");
CREATE INDEX "Device_companyId_idx" ON "Device"("companyId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Account_slug_key" ON "Account"("slug");

-- CreateIndex
CREATE INDEX "Account_slug_idx" ON "Account"("slug");

-- CreateIndex
CREATE INDEX "Company_accountId_idx" ON "Company"("accountId");

-- CreateIndex
CREATE INDEX "AccountMembership_userId_idx" ON "AccountMembership"("userId");

-- CreateIndex
CREATE INDEX "AccountMembership_accountId_idx" ON "AccountMembership"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "AccountMembership_userId_accountId_key" ON "AccountMembership"("userId", "accountId");

-- CreateIndex
CREATE INDEX "Group_accountId_idx" ON "Group"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "Group_accountId_name_key" ON "Group"("accountId", "name");

-- CreateIndex
CREATE INDEX "GroupMembership_groupId_idx" ON "GroupMembership"("groupId");

-- CreateIndex
CREATE INDEX "GroupMembership_membershipId_idx" ON "GroupMembership"("membershipId");

-- CreateIndex
CREATE UNIQUE INDEX "GroupMembership_groupId_membershipId_key" ON "GroupMembership"("groupId", "membershipId");
