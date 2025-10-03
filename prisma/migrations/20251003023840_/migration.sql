-- AlterTable
ALTER TABLE "DeviceTag" ADD COLUMN     "accountId" TEXT;

-- CreateTable
CREATE TABLE "DeviceProfile" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT NOT NULL,
    "updatedBy" TEXT,
    "accountId" TEXT NOT NULL,

    CONSTRAINT "DeviceProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeviceProfileSetting" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "dataType" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "category" TEXT,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeviceProfileSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeviceProfileAssignment" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignedBy" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "appliedAt" TIMESTAMP(3),
    "lastSyncAt" TIMESTAMP(3),

    CONSTRAINT "DeviceProfileAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeviceAppSummary" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "totalAppsCount" INTEGER NOT NULL DEFAULT 0,
    "systemAppsCount" INTEGER NOT NULL DEFAULT 0,
    "normalAppsCount" INTEGER NOT NULL DEFAULT 0,
    "lastAppSync" TIMESTAMP(3),
    "lastProcessedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeviceAppSummary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PinRule" (
    "id" TEXT NOT NULL,
    "ruleType" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "accountId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "apps" TEXT[],
    "targetType" TEXT,
    "targetValue" TEXT[],
    "priority" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PinRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserAppAction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "packageName" TEXT NOT NULL,
    "ruleId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserAppAction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DeviceProfile_accountId_idx" ON "DeviceProfile"("accountId");

-- CreateIndex
CREATE INDEX "DeviceProfile_createdBy_idx" ON "DeviceProfile"("createdBy");

-- CreateIndex
CREATE INDEX "DeviceProfileSetting_profileId_idx" ON "DeviceProfileSetting"("profileId");

-- CreateIndex
CREATE UNIQUE INDEX "DeviceProfileSetting_profileId_key_key" ON "DeviceProfileSetting"("profileId", "key");

-- CreateIndex
CREATE INDEX "DeviceProfileAssignment_profileId_idx" ON "DeviceProfileAssignment"("profileId");

-- CreateIndex
CREATE INDEX "DeviceProfileAssignment_deviceId_idx" ON "DeviceProfileAssignment"("deviceId");

-- CreateIndex
CREATE UNIQUE INDEX "DeviceProfileAssignment_deviceId_key" ON "DeviceProfileAssignment"("deviceId");

-- CreateIndex
CREATE UNIQUE INDEX "DeviceAppSummary_deviceId_key" ON "DeviceAppSummary"("deviceId");

-- CreateIndex
CREATE INDEX "DeviceAppSummary_deviceId_idx" ON "DeviceAppSummary"("deviceId");

-- CreateIndex
CREATE INDEX "DeviceAppSummary_accountId_idx" ON "DeviceAppSummary"("accountId");

-- CreateIndex
CREATE INDEX "DeviceAppSummary_lastProcessedAt_idx" ON "DeviceAppSummary"("lastProcessedAt");

-- CreateIndex
CREATE INDEX "PinRule_ruleType_idx" ON "PinRule"("ruleType");

-- CreateIndex
CREATE INDEX "PinRule_accountId_idx" ON "PinRule"("accountId");

-- CreateIndex
CREATE INDEX "PinRule_createdBy_idx" ON "PinRule"("createdBy");

-- CreateIndex
CREATE INDEX "PinRule_priority_idx" ON "PinRule"("priority");

-- CreateIndex
CREATE INDEX "PinRule_isActive_idx" ON "PinRule"("isActive");

-- CreateIndex
CREATE INDEX "UserAppAction_userId_idx" ON "UserAppAction"("userId");

-- CreateIndex
CREATE INDEX "UserAppAction_deviceId_idx" ON "UserAppAction"("deviceId");

-- CreateIndex
CREATE INDEX "UserAppAction_action_idx" ON "UserAppAction"("action");

-- CreateIndex
CREATE INDEX "UserAppAction_createdAt_idx" ON "UserAppAction"("createdAt");

-- AddForeignKey
ALTER TABLE "DeviceTag" ADD CONSTRAINT "DeviceTag_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceProfile" ADD CONSTRAINT "DeviceProfile_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceProfileSetting" ADD CONSTRAINT "DeviceProfileSetting_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "DeviceProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceProfileAssignment" ADD CONSTRAINT "DeviceProfileAssignment_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "DeviceProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceProfileAssignment" ADD CONSTRAINT "DeviceProfileAssignment_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceAppSummary" ADD CONSTRAINT "DeviceAppSummary_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceAppSummary" ADD CONSTRAINT "DeviceAppSummary_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PinRule" ADD CONSTRAINT "PinRule_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PinRule" ADD CONSTRAINT "PinRule_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAppAction" ADD CONSTRAINT "UserAppAction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAppAction" ADD CONSTRAINT "UserAppAction_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAppAction" ADD CONSTRAINT "UserAppAction_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "PinRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;
