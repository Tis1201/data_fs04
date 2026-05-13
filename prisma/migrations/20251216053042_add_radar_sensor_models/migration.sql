-- CreateTable
-- Idempotent: Check if table exists before creating
CREATE TABLE IF NOT EXISTS "RadarSensor" (
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
-- Idempotent: Check if table exists before creating
CREATE TABLE IF NOT EXISTS "TrackingArea" (
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
-- Idempotent: Check if table exists before creating
CREATE TABLE IF NOT EXISTS "Zone" (
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
-- Idempotent: Check if table exists before creating
CREATE TABLE IF NOT EXISTS "DwellBucket" (
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
-- Idempotent: Check if index exists before creating
CREATE UNIQUE INDEX IF NOT EXISTS "RadarSensor_serialNumber_key" ON "RadarSensor"("serialNumber");

-- CreateIndex
-- Idempotent: Check if index exists before creating
CREATE UNIQUE INDEX IF NOT EXISTS "RadarSensor_deviceId_key" ON "RadarSensor"("deviceId");

-- CreateIndex
-- Idempotent: Check if index exists before creating
CREATE INDEX IF NOT EXISTS "RadarSensor_accountId_idx" ON "RadarSensor"("accountId");

-- CreateIndex
-- Idempotent: Check if index exists before creating
CREATE INDEX IF NOT EXISTS "RadarSensor_deviceId_idx" ON "RadarSensor"("deviceId");

-- CreateIndex
-- Idempotent: Check if index exists before creating
CREATE INDEX IF NOT EXISTS "RadarSensor_status_idx" ON "RadarSensor"("status");

-- CreateIndex
-- Idempotent: Check if index exists before creating
CREATE UNIQUE INDEX IF NOT EXISTS "TrackingArea_radarSensorId_key" ON "TrackingArea"("radarSensorId");

-- CreateIndex
-- Idempotent: Check if index exists before creating
CREATE INDEX IF NOT EXISTS "TrackingArea_radarSensorId_idx" ON "TrackingArea"("radarSensorId");

-- CreateIndex
-- Idempotent: Check if index exists before creating
CREATE INDEX IF NOT EXISTS "Zone_trackingAreaId_idx" ON "Zone"("trackingAreaId");

-- CreateIndex
-- Idempotent: Check if index exists before creating
CREATE UNIQUE INDEX IF NOT EXISTS "Zone_trackingAreaId_zoneNumber_key" ON "Zone"("trackingAreaId", "zoneNumber");

-- CreateIndex
-- Idempotent: Check if index exists before creating
CREATE INDEX IF NOT EXISTS "DwellBucket_radarSensorId_idx" ON "DwellBucket"("radarSensorId");

-- AddForeignKey
-- Idempotent: Check if constraint exists before adding
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'RadarSensor_deviceId_fkey'
    ) THEN
        ALTER TABLE "RadarSensor" ADD CONSTRAINT "RadarSensor_deviceId_fkey" 
        FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
-- Idempotent: Check if constraint exists before adding
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'RadarSensor_accountId_fkey'
    ) THEN
        ALTER TABLE "RadarSensor" ADD CONSTRAINT "RadarSensor_accountId_fkey" 
        FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
-- Idempotent: Check if constraint exists before adding
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'RadarSensor_createdBy_fkey'
    ) THEN
        ALTER TABLE "RadarSensor" ADD CONSTRAINT "RadarSensor_createdBy_fkey" 
        FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
-- Idempotent: Check if constraint exists before adding
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'TrackingArea_radarSensorId_fkey'
    ) THEN
        ALTER TABLE "TrackingArea" ADD CONSTRAINT "TrackingArea_radarSensorId_fkey" 
        FOREIGN KEY ("radarSensorId") REFERENCES "RadarSensor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
-- Idempotent: Check if constraint exists before adding
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'Zone_trackingAreaId_fkey'
    ) THEN
        ALTER TABLE "Zone" ADD CONSTRAINT "Zone_trackingAreaId_fkey" 
        FOREIGN KEY ("trackingAreaId") REFERENCES "TrackingArea"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
-- Idempotent: Check if constraint exists before adding
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'DwellBucket_radarSensorId_fkey'
    ) THEN
        ALTER TABLE "DwellBucket" ADD CONSTRAINT "DwellBucket_radarSensorId_fkey" 
        FOREIGN KEY ("radarSensorId") REFERENCES "RadarSensor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
