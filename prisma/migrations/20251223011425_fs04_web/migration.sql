/*
  Warnings:

  - You are about to drop the `DwellBucket` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `RadarSensor` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `TrackingArea` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Zone` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "DwellBucket" DROP CONSTRAINT "DwellBucket_radarSensorId_fkey";

-- DropForeignKey
ALTER TABLE "RadarSensor" DROP CONSTRAINT "RadarSensor_accountId_fkey";

-- DropForeignKey
ALTER TABLE "RadarSensor" DROP CONSTRAINT "RadarSensor_createdBy_fkey";

-- DropForeignKey
ALTER TABLE "RadarSensor" DROP CONSTRAINT "RadarSensor_deviceId_fkey";

-- DropForeignKey
ALTER TABLE "TrackingArea" DROP CONSTRAINT "TrackingArea_radarSensorId_fkey";

-- DropForeignKey
ALTER TABLE "Zone" DROP CONSTRAINT "Zone_trackingAreaId_fkey";

-- DropTable
DROP TABLE "DwellBucket";

-- DropTable
DROP TABLE "RadarSensor";

-- DropTable
DROP TABLE "TrackingArea";

-- DropTable
DROP TABLE "Zone";

-- CreateTable
CREATE TABLE "Controller" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "serialNumber" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'INACTIVE',
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deviceId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "description" TEXT,

    CONSTRAINT "Controller_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sensor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "serialNumber" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'INACTIVE',
    "controllerId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "description" TEXT,
    "location" TEXT,
    "firmware" TEXT,
    "config" JSONB,
    "configVersion" INTEGER NOT NULL DEFAULT 0,
    "syncStatus" TEXT NOT NULL DEFAULT 'SYNCED',
    "lastSyncedAt" TIMESTAMP(3),
    "lastSyncError" TEXT,

    CONSTRAINT "Sensor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Controller_serialNumber_key" ON "Controller"("serialNumber");

-- CreateIndex
CREATE INDEX "Controller_accountId_idx" ON "Controller"("accountId");

-- CreateIndex
CREATE INDEX "Controller_deviceId_idx" ON "Controller"("deviceId");

-- CreateIndex
CREATE INDEX "Controller_type_idx" ON "Controller"("type");

-- CreateIndex
CREATE INDEX "Controller_status_idx" ON "Controller"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Sensor_serialNumber_key" ON "Sensor"("serialNumber");

-- CreateIndex
CREATE INDEX "Sensor_controllerId_idx" ON "Sensor"("controllerId");

-- CreateIndex
CREATE INDEX "Sensor_accountId_idx" ON "Sensor"("accountId");

-- CreateIndex
CREATE INDEX "Sensor_type_idx" ON "Sensor"("type");

-- CreateIndex
CREATE INDEX "Sensor_status_idx" ON "Sensor"("status");

-- AddForeignKey
ALTER TABLE "Controller" ADD CONSTRAINT "Controller_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Controller" ADD CONSTRAINT "Controller_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Controller" ADD CONSTRAINT "Controller_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sensor" ADD CONSTRAINT "Sensor_controllerId_fkey" FOREIGN KEY ("controllerId") REFERENCES "Controller"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sensor" ADD CONSTRAINT "Sensor_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sensor" ADD CONSTRAINT "Sensor_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
