-- CreateTable: Controller
-- Idempotent: Check if table exists before creating
CREATE TABLE IF NOT EXISTS "Controller" (
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

-- CreateTable: Sensor
-- Idempotent: Check if table exists before creating
CREATE TABLE IF NOT EXISTS "Sensor" (
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

-- CreateIndex: Controller indexes
-- Idempotent: Check if index exists before creating
CREATE UNIQUE INDEX IF NOT EXISTS "Controller_serialNumber_key" ON "Controller"("serialNumber");
CREATE INDEX IF NOT EXISTS "Controller_accountId_idx" ON "Controller"("accountId");
CREATE INDEX IF NOT EXISTS "Controller_deviceId_idx" ON "Controller"("deviceId");
CREATE INDEX IF NOT EXISTS "Controller_type_idx" ON "Controller"("type");
CREATE INDEX IF NOT EXISTS "Controller_status_idx" ON "Controller"("status");

-- CreateIndex: Sensor indexes
-- Idempotent: Check if index exists before creating
CREATE UNIQUE INDEX IF NOT EXISTS "Sensor_serialNumber_key" ON "Sensor"("serialNumber");
CREATE INDEX IF NOT EXISTS "Sensor_controllerId_idx" ON "Sensor"("controllerId");
CREATE INDEX IF NOT EXISTS "Sensor_accountId_idx" ON "Sensor"("accountId");
CREATE INDEX IF NOT EXISTS "Sensor_type_idx" ON "Sensor"("type");
CREATE INDEX IF NOT EXISTS "Sensor_status_idx" ON "Sensor"("status");

-- AddForeignKey: Controller foreign keys
-- Idempotent: Check if constraint exists before adding
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'Controller_deviceId_fkey'
    ) THEN
        ALTER TABLE "Controller" ADD CONSTRAINT "Controller_deviceId_fkey" 
        FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'Controller_accountId_fkey'
    ) THEN
        ALTER TABLE "Controller" ADD CONSTRAINT "Controller_accountId_fkey" 
        FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'Controller_createdBy_fkey'
    ) THEN
        ALTER TABLE "Controller" ADD CONSTRAINT "Controller_createdBy_fkey" 
        FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey: Sensor foreign keys
-- Idempotent: Check if constraint exists before adding
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'Sensor_controllerId_fkey'
    ) THEN
        ALTER TABLE "Sensor" ADD CONSTRAINT "Sensor_controllerId_fkey" 
        FOREIGN KEY ("controllerId") REFERENCES "Controller"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'Sensor_accountId_fkey'
    ) THEN
        ALTER TABLE "Sensor" ADD CONSTRAINT "Sensor_accountId_fkey" 
        FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'Sensor_createdBy_fkey'
    ) THEN
        ALTER TABLE "Sensor" ADD CONSTRAINT "Sensor_createdBy_fkey" 
        FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

