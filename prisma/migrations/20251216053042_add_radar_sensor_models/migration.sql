-- CreateTable
CREATE TABLE "RadarSensor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "serialNumber" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'INACTIVE',
    "deviceId" TEXT,
    "accountId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "description" TEXT,
    "location" TEXT,
    "firmware" TEXT,

    CONSTRAINT "RadarSensor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrackingArea" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startX" DOUBLE PRECISION NOT NULL,
    "startY" DOUBLE PRECISION NOT NULL,
    "endX" DOUBLE PRECISION NOT NULL,
    "endY" DOUBLE PRECISION NOT NULL,
    "radarSensorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "description" TEXT,

    CONSTRAINT "TrackingArea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Zone" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "zoneNumber" INTEGER NOT NULL,
    "startX" DOUBLE PRECISION NOT NULL,
    "startY" DOUBLE PRECISION NOT NULL,
    "endX" DOUBLE PRECISION NOT NULL,
    "endY" DOUBLE PRECISION NOT NULL,
    "trackingAreaId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "description" TEXT,
    "color" TEXT,

    CONSTRAINT "Zone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DwellBucket" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "minDuration" INTEGER NOT NULL,
    "maxDuration" INTEGER,
    "radarSensorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "description" TEXT,

    CONSTRAINT "DwellBucket_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RadarSensor_serialNumber_key" ON "RadarSensor"("serialNumber");

-- CreateIndex
CREATE UNIQUE INDEX "RadarSensor_deviceId_key" ON "RadarSensor"("deviceId");

-- CreateIndex
CREATE INDEX "RadarSensor_accountId_idx" ON "RadarSensor"("accountId");

-- CreateIndex
CREATE INDEX "RadarSensor_deviceId_idx" ON "RadarSensor"("deviceId");

-- CreateIndex
CREATE INDEX "RadarSensor_status_idx" ON "RadarSensor"("status");

-- CreateIndex
CREATE UNIQUE INDEX "TrackingArea_radarSensorId_key" ON "TrackingArea"("radarSensorId");

-- CreateIndex
CREATE INDEX "TrackingArea_radarSensorId_idx" ON "TrackingArea"("radarSensorId");

-- CreateIndex
CREATE INDEX "Zone_trackingAreaId_idx" ON "Zone"("trackingAreaId");

-- CreateIndex
CREATE UNIQUE INDEX "Zone_trackingAreaId_zoneNumber_key" ON "Zone"("trackingAreaId", "zoneNumber");

-- CreateIndex
CREATE INDEX "DwellBucket_radarSensorId_idx" ON "DwellBucket"("radarSensorId");

-- AddForeignKey
ALTER TABLE "RadarSensor" ADD CONSTRAINT "RadarSensor_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RadarSensor" ADD CONSTRAINT "RadarSensor_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RadarSensor" ADD CONSTRAINT "RadarSensor_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackingArea" ADD CONSTRAINT "TrackingArea_radarSensorId_fkey" FOREIGN KEY ("radarSensorId") REFERENCES "RadarSensor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Zone" ADD CONSTRAINT "Zone_trackingAreaId_fkey" FOREIGN KEY ("trackingAreaId") REFERENCES "TrackingArea"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DwellBucket" ADD CONSTRAINT "DwellBucket_radarSensorId_fkey" FOREIGN KEY ("radarSensorId") REFERENCES "RadarSensor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
