/*
  Warnings:

  - A unique constraint covering the columns `[deviceId,sequenceNumber]` on the table `DeviceActionLog` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "DeviceActionLog" ADD COLUMN     "sequenceNumber" INTEGER;

-- CreateTable
CREATE TABLE "UserPermissionOverride" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "allowed" BOOLEAN NOT NULL,
    "reason" TEXT,
    "expiresAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,

    CONSTRAINT "UserPermissionOverride_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserPermissionOverride_userId_accountId_idx" ON "UserPermissionOverride"("userId", "accountId");

-- CreateIndex
CREATE INDEX "UserPermissionOverride_accountId_idx" ON "UserPermissionOverride"("accountId");

-- CreateIndex
CREATE INDEX "UserPermissionOverride_module_action_idx" ON "UserPermissionOverride"("module", "action");

-- CreateIndex
CREATE INDEX "UserPermissionOverride_expiresAt_idx" ON "UserPermissionOverride"("expiresAt");

-- CreateIndex
CREATE INDEX "UserPermissionOverride_isActive_idx" ON "UserPermissionOverride"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "UserPermissionOverride_userId_accountId_module_action_key" ON "UserPermissionOverride"("userId", "accountId", "module", "action");

-- CreateIndex
CREATE INDEX "DeviceActionLog_deviceId_sequenceNumber_idx" ON "DeviceActionLog"("deviceId", "sequenceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "DeviceActionLog_deviceId_sequenceNumber_key" ON "DeviceActionLog"("deviceId", "sequenceNumber");

-- AddForeignKey
ALTER TABLE "UserPermissionOverride" ADD CONSTRAINT "UserPermissionOverride_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPermissionOverride" ADD CONSTRAINT "UserPermissionOverride_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPermissionOverride" ADD CONSTRAINT "UserPermissionOverride_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
