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
CREATE TABLE "DeviceAppPin" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "packageName" TEXT NOT NULL,
    "pinnedByRuleId" TEXT,
    "pinnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeviceAppPin_pkey" PRIMARY KEY ("id")
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
CREATE INDEX "DeviceAppPin_deviceId_idx" ON "DeviceAppPin"("deviceId");

-- CreateIndex
CREATE INDEX "DeviceAppPin_packageName_idx" ON "DeviceAppPin"("packageName");

-- CreateIndex
CREATE INDEX "DeviceAppPin_pinnedByRuleId_idx" ON "DeviceAppPin"("pinnedByRuleId");

-- CreateIndex
CREATE UNIQUE INDEX "DeviceAppPin_deviceId_packageName_key" ON "DeviceAppPin"("deviceId", "packageName");

-- CreateIndex
CREATE INDEX "UserAppAction_userId_idx" ON "UserAppAction"("userId");

-- CreateIndex
CREATE INDEX "UserAppAction_deviceId_idx" ON "UserAppAction"("deviceId");

-- CreateIndex
CREATE INDEX "UserAppAction_action_idx" ON "UserAppAction"("action");

-- CreateIndex
CREATE INDEX "UserAppAction_createdAt_idx" ON "UserAppAction"("createdAt");

-- AddForeignKey
ALTER TABLE "PinRule" ADD CONSTRAINT "PinRule_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PinRule" ADD CONSTRAINT "PinRule_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceAppPin" ADD CONSTRAINT "DeviceAppPin_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceAppPin" ADD CONSTRAINT "DeviceAppPin_pinnedByRuleId_fkey" FOREIGN KEY ("pinnedByRuleId") REFERENCES "PinRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAppAction" ADD CONSTRAINT "UserAppAction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAppAction" ADD CONSTRAINT "UserAppAction_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAppAction" ADD CONSTRAINT "UserAppAction_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "PinRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;
