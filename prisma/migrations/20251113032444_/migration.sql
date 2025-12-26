-- CreateTable: FactoryDevice
-- Note: signingKeyId was already added in migrations 20251017000000 and 20251017000001
-- This migration only creates the FactoryDevice table and its relationships

-- Create FactoryDevice table if it doesn't exist
CREATE TABLE IF NOT EXISTS "FactoryDevice" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "hardwareFingerprint" TEXT,
    "factoryJwtId" TEXT,
    "metadata" TEXT,
    "claimedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3),
    "lastSeenIp" TEXT,
    "lastSeenUserAgent" TEXT,
    "accountId" TEXT,
    "claimedDeviceId" TEXT,

    CONSTRAINT "FactoryDevice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: FactoryDevice unique indexes (idempotent)
-- Prisma expects simple unique indexes for @unique() fields, not conditional ones
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'FactoryDevice' AND indexname = 'FactoryDevice_hardwareFingerprint_key'
    ) THEN
        CREATE UNIQUE INDEX "FactoryDevice_hardwareFingerprint_key" ON "FactoryDevice"("hardwareFingerprint");
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'FactoryDevice' AND indexname = 'FactoryDevice_claimedDeviceId_key'
    ) THEN
        CREATE UNIQUE INDEX "FactoryDevice_claimedDeviceId_key" ON "FactoryDevice"("claimedDeviceId");
    END IF;
END $$;

-- CreateIndex: FactoryDevice regular indexes (idempotent)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'FactoryDevice' AND indexname = 'FactoryDevice_accountId_idx'
    ) THEN
        CREATE INDEX "FactoryDevice_accountId_idx" ON "FactoryDevice"("accountId");
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'FactoryDevice' AND indexname = 'FactoryDevice_status_idx'
    ) THEN
        CREATE INDEX "FactoryDevice_status_idx" ON "FactoryDevice"("status");
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'FactoryDevice' AND indexname = 'FactoryDevice_createdAt_idx'
    ) THEN
        CREATE INDEX "FactoryDevice_createdAt_idx" ON "FactoryDevice"("createdAt");
    END IF;
END $$;

-- AddForeignKey: FactoryDevice foreign keys (idempotent)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'FactoryDevice_accountId_fkey'
    ) THEN
        ALTER TABLE "FactoryDevice" ADD CONSTRAINT "FactoryDevice_accountId_fkey" 
        FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'FactoryDevice_claimedDeviceId_fkey'
    ) THEN
        ALTER TABLE "FactoryDevice" ADD CONSTRAINT "FactoryDevice_claimedDeviceId_fkey" 
        FOREIGN KEY ("claimedDeviceId") REFERENCES "Device"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
