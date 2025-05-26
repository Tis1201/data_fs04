-- CreateTable
CREATE TABLE "JwtSigningKey" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "keyId" TEXT NOT NULL,
    "keyType" TEXT NOT NULL,
    "privateKey" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "algorithm" TEXT NOT NULL DEFAULT 'RS256',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "rotatedAt" DATETIME,
    "expiresAt" DATETIME,
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "JwtSigningKey_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FactoryToken" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tokenId" TEXT NOT NULL,
    "serialNumber" TEXT NOT NULL,
    "hardwareModel" TEXT NOT NULL,
    "firmwareVersion" TEXT NOT NULL,
    "batchNumber" TEXT,
    "isUsed" BOOLEAN NOT NULL DEFAULT false,
    "usedAt" DATETIME,
    "usedByIp" TEXT,
    "issuedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL,
    "issuedBy" TEXT NOT NULL,
    "notes" TEXT,
    "deviceId" TEXT,
    CONSTRAINT "FactoryToken_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tokenHash" TEXT NOT NULL,
    "deviceId" TEXT,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "accountId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "isRevoked" BOOLEAN NOT NULL DEFAULT false,
    "revokedAt" DATETIME,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RefreshToken_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TokenUsageLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tokenId" TEXT,
    "tokenType" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "accountId" TEXT,
    "userId" TEXT,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "error" TEXT,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TokenUsageLog_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TokenUsageLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "JwtSigningKey_keyType_isActive_idx" ON "JwtSigningKey"("keyType", "isActive");

-- CreateIndex
CREATE INDEX "JwtSigningKey_expiresAt_idx" ON "JwtSigningKey"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "unique_primary_key_per_type" ON "JwtSigningKey"("keyType", "isPrimary");

-- CreateIndex
CREATE UNIQUE INDEX "unique_key_id_per_type" ON "JwtSigningKey"("keyType", "keyId");

-- CreateIndex
CREATE UNIQUE INDEX "FactoryToken_tokenId_key" ON "FactoryToken"("tokenId");

-- CreateIndex
CREATE UNIQUE INDEX "FactoryToken_serialNumber_key" ON "FactoryToken"("serialNumber");

-- CreateIndex
CREATE INDEX "FactoryToken_serialNumber_idx" ON "FactoryToken"("serialNumber");

-- CreateIndex
CREATE INDEX "FactoryToken_isUsed_idx" ON "FactoryToken"("isUsed");

-- CreateIndex
CREATE INDEX "FactoryToken_expiresAt_idx" ON "FactoryToken"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");

-- CreateIndex
CREATE INDEX "RefreshToken_accountId_idx" ON "RefreshToken"("accountId");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");

-- CreateIndex
CREATE INDEX "RefreshToken_expiresAt_idx" ON "RefreshToken"("expiresAt");

-- CreateIndex
CREATE INDEX "RefreshToken_isRevoked_idx" ON "RefreshToken"("isRevoked");

-- CreateIndex
CREATE INDEX "TokenUsageLog_accountId_idx" ON "TokenUsageLog"("accountId");

-- CreateIndex
CREATE INDEX "TokenUsageLog_userId_idx" ON "TokenUsageLog"("userId");

-- CreateIndex
CREATE INDEX "TokenUsageLog_tokenId_idx" ON "TokenUsageLog"("tokenId");

-- CreateIndex
CREATE INDEX "TokenUsageLog_createdAt_idx" ON "TokenUsageLog"("createdAt");
