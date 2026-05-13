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

-- CreateIndex
CREATE UNIQUE INDEX "DeviceAppSummary_deviceId_key" ON "DeviceAppSummary"("deviceId");

-- CreateIndex
CREATE INDEX "DeviceAppSummary_deviceId_idx" ON "DeviceAppSummary"("deviceId");

-- CreateIndex
CREATE INDEX "DeviceAppSummary_accountId_idx" ON "DeviceAppSummary"("accountId");

-- CreateIndex
CREATE INDEX "DeviceAppSummary_lastProcessedAt_idx" ON "DeviceAppSummary"("lastProcessedAt");

-- AddForeignKey
ALTER TABLE "DeviceAppSummary" ADD CONSTRAINT "DeviceAppSummary_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceAppSummary" ADD CONSTRAINT "DeviceAppSummary_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
