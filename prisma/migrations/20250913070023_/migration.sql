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

-- AddForeignKey
ALTER TABLE "DeviceProfile" ADD CONSTRAINT "DeviceProfile_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceProfileSetting" ADD CONSTRAINT "DeviceProfileSetting_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "DeviceProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceProfileAssignment" ADD CONSTRAINT "DeviceProfileAssignment_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "DeviceProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceProfileAssignment" ADD CONSTRAINT "DeviceProfileAssignment_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;
