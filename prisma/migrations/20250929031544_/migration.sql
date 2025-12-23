-- CreateTable
-- Idempotent: Check if table exists before creating
CREATE TABLE IF NOT EXISTS "PinRule" (
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
-- Idempotent: Check if table exists before creating
-- Note: This table is dropped in migration 20250930144132_
CREATE TABLE IF NOT EXISTS "DeviceAppPin" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "packageName" TEXT NOT NULL,
    "pinnedByRuleId" TEXT,
    "pinnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeviceAppPin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
-- Idempotent: Check if table exists before creating
CREATE TABLE IF NOT EXISTS "UserAppAction" (
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
-- Idempotent: Check if index exists before creating
CREATE INDEX IF NOT EXISTS "PinRule_ruleType_idx" ON "PinRule"("ruleType");

-- CreateIndex
-- Idempotent: Check if index exists before creating
CREATE INDEX IF NOT EXISTS "PinRule_accountId_idx" ON "PinRule"("accountId");

-- CreateIndex
-- Idempotent: Check if index exists before creating
CREATE INDEX IF NOT EXISTS "PinRule_createdBy_idx" ON "PinRule"("createdBy");

-- CreateIndex
-- Idempotent: Check if index exists before creating
CREATE INDEX IF NOT EXISTS "PinRule_priority_idx" ON "PinRule"("priority");

-- CreateIndex
-- Idempotent: Check if index exists before creating
CREATE INDEX IF NOT EXISTS "PinRule_isActive_idx" ON "PinRule"("isActive");

-- CreateIndex
-- Idempotent: Check if index exists before creating
CREATE INDEX IF NOT EXISTS "DeviceAppPin_deviceId_idx" ON "DeviceAppPin"("deviceId");

-- CreateIndex
-- Idempotent: Check if index exists before creating
CREATE INDEX IF NOT EXISTS "DeviceAppPin_packageName_idx" ON "DeviceAppPin"("packageName");

-- CreateIndex
-- Idempotent: Check if index exists before creating
CREATE INDEX IF NOT EXISTS "DeviceAppPin_pinnedByRuleId_idx" ON "DeviceAppPin"("pinnedByRuleId");

-- CreateIndex
-- Idempotent: Check if unique index exists before creating
CREATE UNIQUE INDEX IF NOT EXISTS "DeviceAppPin_deviceId_packageName_key" ON "DeviceAppPin"("deviceId", "packageName");

-- CreateIndex
-- Idempotent: Check if index exists before creating
CREATE INDEX IF NOT EXISTS "UserAppAction_userId_idx" ON "UserAppAction"("userId");

-- CreateIndex
-- Idempotent: Check if index exists before creating
CREATE INDEX IF NOT EXISTS "UserAppAction_deviceId_idx" ON "UserAppAction"("deviceId");

-- CreateIndex
-- Idempotent: Check if index exists before creating
CREATE INDEX IF NOT EXISTS "UserAppAction_action_idx" ON "UserAppAction"("action");

-- CreateIndex
-- Idempotent: Check if index exists before creating
CREATE INDEX IF NOT EXISTS "UserAppAction_createdAt_idx" ON "UserAppAction"("createdAt");

-- AddForeignKey
-- Idempotent: Check if constraint exists before adding
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'PinRule_createdBy_fkey'
    ) THEN
        ALTER TABLE "PinRule" ADD CONSTRAINT "PinRule_createdBy_fkey" 
        FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
-- Idempotent: Check if constraint exists before adding
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'PinRule_accountId_fkey'
    ) THEN
        ALTER TABLE "PinRule" ADD CONSTRAINT "PinRule_accountId_fkey" 
        FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
-- Idempotent: Check if constraint exists before adding
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'DeviceAppPin_deviceId_fkey'
    ) THEN
        ALTER TABLE "DeviceAppPin" ADD CONSTRAINT "DeviceAppPin_deviceId_fkey" 
        FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
-- Idempotent: Check if constraint exists before adding
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'DeviceAppPin_pinnedByRuleId_fkey'
    ) THEN
        ALTER TABLE "DeviceAppPin" ADD CONSTRAINT "DeviceAppPin_pinnedByRuleId_fkey" 
        FOREIGN KEY ("pinnedByRuleId") REFERENCES "PinRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
-- Idempotent: Check if constraint exists before adding
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'UserAppAction_userId_fkey'
    ) THEN
        ALTER TABLE "UserAppAction" ADD CONSTRAINT "UserAppAction_userId_fkey" 
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
-- Idempotent: Check if constraint exists before adding
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'UserAppAction_deviceId_fkey'
    ) THEN
        ALTER TABLE "UserAppAction" ADD CONSTRAINT "UserAppAction_deviceId_fkey" 
        FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
-- Idempotent: Check if constraint exists before adding
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'UserAppAction_ruleId_fkey'
    ) THEN
        ALTER TABLE "UserAppAction" ADD CONSTRAINT "UserAppAction_ruleId_fkey" 
        FOREIGN KEY ("ruleId") REFERENCES "PinRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
