-- CreateTable: DeviceProfileOverride
-- Stores device-specific customizations (delta from global profile)
CREATE TABLE "DeviceProfileOverride" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT NOT NULL,
    "updatedBy" TEXT,
    "deviceId" TEXT NOT NULL,
    "globalProfileId" TEXT NOT NULL,

    CONSTRAINT "DeviceProfileOverride_pkey" PRIMARY KEY ("id")
);

-- CreateTable: DeviceProfileOverrideSetting
-- Individual setting overrides for a device
CREATE TABLE "DeviceProfileOverrideSetting" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "overrideId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "dataType" TEXT NOT NULL,

    CONSTRAINT "DeviceProfileOverrideSetting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: Unique constraint for one override per device-profile pair
CREATE UNIQUE INDEX "DeviceProfileOverride_deviceId_globalProfileId_key" ON "DeviceProfileOverride"("deviceId", "globalProfileId");

-- CreateIndex: Index on deviceId for faster queries
CREATE INDEX "DeviceProfileOverride_deviceId_idx" ON "DeviceProfileOverride"("deviceId");

-- CreateIndex: Index on globalProfileId for faster queries
CREATE INDEX "DeviceProfileOverride_globalProfileId_idx" ON "DeviceProfileOverride"("globalProfileId");

-- CreateIndex: Unique constraint for one override per setting per device
CREATE UNIQUE INDEX "DeviceProfileOverrideSetting_overrideId_key_key" ON "DeviceProfileOverrideSetting"("overrideId", "key");

-- CreateIndex: Index on overrideId for faster queries
CREATE INDEX "DeviceProfileOverrideSetting_overrideId_idx" ON "DeviceProfileOverrideSetting"("overrideId");

-- AddForeignKey: Link override to device
ALTER TABLE "DeviceProfileOverride" ADD CONSTRAINT "DeviceProfileOverride_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: Link override to global profile
ALTER TABLE "DeviceProfileOverride" ADD CONSTRAINT "DeviceProfileOverride_globalProfileId_fkey" FOREIGN KEY ("globalProfileId") REFERENCES "DeviceProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: Link setting override to parent override
ALTER TABLE "DeviceProfileOverrideSetting" ADD CONSTRAINT "DeviceProfileOverrideSetting_overrideId_fkey" FOREIGN KEY ("overrideId") REFERENCES "DeviceProfileOverride"("id") ON DELETE CASCADE ON UPDATE CASCADE;

