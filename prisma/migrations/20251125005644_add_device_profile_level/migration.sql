-- AlterTable: Add level column to DeviceProfile
-- This column indicates whether the profile is GLOBAL (account-level) or DEVICE (device-level copy)
ALTER TABLE "DeviceProfile" ADD COLUMN "level" TEXT NOT NULL DEFAULT 'GLOBAL';

-- AlterTable: Add deviceId column to DeviceProfile (nullable, only for DEVICE level profiles)
ALTER TABLE "DeviceProfile" ADD COLUMN "deviceId" TEXT;

-- CreateIndex: Add index on level column for faster queries
CREATE INDEX "DeviceProfile_level_idx" ON "DeviceProfile"("level");

-- CreateIndex: Add index on deviceId column for faster queries
CREATE INDEX "DeviceProfile_deviceId_idx" ON "DeviceProfile"("deviceId");

-- AddForeignKey: Add foreign key constraint for deviceId
ALTER TABLE "DeviceProfile" ADD CONSTRAINT "DeviceProfile_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;

