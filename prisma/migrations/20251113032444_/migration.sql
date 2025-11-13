/*
  Warnings:

  - Added the required column `signingKeyId` to the `License` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "License" ADD COLUMN     "signingKeyId" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "FactoryDevice" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "hardwareFingerprint" TEXT,
    "factoryJwtId" TEXT,
    "metadata" TEXT,
    "claimedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3),
    "lastSeenIp" TEXT,
    "lastSeenUserAgent" TEXT,
    "accountId" TEXT,
    "claimedDeviceId" TEXT,

    CONSTRAINT "FactoryDevice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FactoryDevice_hardwareFingerprint_key" ON "FactoryDevice"("hardwareFingerprint");

-- CreateIndex
CREATE UNIQUE INDEX "FactoryDevice_claimedDeviceId_key" ON "FactoryDevice"("claimedDeviceId");

-- CreateIndex
CREATE INDEX "FactoryDevice_accountId_idx" ON "FactoryDevice"("accountId");

-- CreateIndex
CREATE INDEX "FactoryDevice_status_idx" ON "FactoryDevice"("status");

-- CreateIndex
CREATE INDEX "FactoryDevice_createdAt_idx" ON "FactoryDevice"("createdAt");

-- CreateIndex
CREATE INDEX "License_signingKeyId_idx" ON "License"("signingKeyId");

-- AddForeignKey
ALTER TABLE "FactoryDevice" ADD CONSTRAINT "FactoryDevice_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FactoryDevice" ADD CONSTRAINT "FactoryDevice_claimedDeviceId_fkey" FOREIGN KEY ("claimedDeviceId") REFERENCES "Device"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "License" ADD CONSTRAINT "License_signingKeyId_fkey" FOREIGN KEY ("signingKeyId") REFERENCES "JwtSigningKey"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
