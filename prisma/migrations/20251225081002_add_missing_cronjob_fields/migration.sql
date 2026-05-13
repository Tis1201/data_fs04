-- DropForeignKey (idempotent)
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'Device_createdBy_fkey'
    ) THEN
        ALTER TABLE "Device" DROP CONSTRAINT "Device_createdBy_fkey";
    END IF;
END $$;

-- AlterTable
-- Add missing CronJob columns (idempotent)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'CronJob' AND column_name = 'failureCount') THEN
        ALTER TABLE "CronJob" ADD COLUMN "failureCount" INTEGER NOT NULL DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'CronJob' AND column_name = 'lastError') THEN
        ALTER TABLE "CronJob" ADD COLUMN "lastError" TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'CronJob' AND column_name = 'successCount') THEN
        ALTER TABLE "CronJob" ADD COLUMN "successCount" INTEGER NOT NULL DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'CronJob' AND column_name = 'timezone') THEN
        ALTER TABLE "CronJob" ADD COLUMN "timezone" TEXT DEFAULT 'UTC';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'CronJob' AND column_name = 'totalRuns') THEN
        ALTER TABLE "CronJob" ADD COLUMN "totalRuns" INTEGER NOT NULL DEFAULT 0;
    END IF;
END $$;

-- Make args nullable if it's currently NOT NULL
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'CronJob' 
        AND column_name = 'args' 
        AND is_nullable = 'NO'
    ) THEN
        ALTER TABLE "CronJob" ALTER COLUMN "args" DROP NOT NULL;
    END IF;
END $$;

-- AlterTable
ALTER TABLE "Device" ALTER COLUMN "createdBy" DROP NOT NULL;

-- AlterTable
ALTER TABLE "EmailServiceProvider" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
-- Add Session.status column (idempotent)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Session' AND column_name = 'status') THEN
        ALTER TABLE "Session" ADD COLUMN "status" TEXT DEFAULT 'ACTIVE';
    END IF;
END $$;

-- AlterTable
ALTER TABLE "Setting" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateIndex (idempotent)
CREATE INDEX IF NOT EXISTS "AuditLog_actionType_idx" ON "AuditLog"("actionType");

-- CreateIndex (idempotent)
CREATE INDEX IF NOT EXISTS "AuditLog_tableName_idx" ON "AuditLog"("tableName");

-- CreateIndex (idempotent)
CREATE INDEX IF NOT EXISTS "AuditLog_timestamp_idx" ON "AuditLog"("timestamp");

-- CreateIndex (idempotent)
CREATE INDEX IF NOT EXISTS "AuditLog_tableName_actionType_timestamp_idx" ON "AuditLog"("tableName", "actionType", "timestamp");

-- CreateIndex (idempotent)
CREATE INDEX IF NOT EXISTS "Bundle_createdAt_idx" ON "Bundle"("createdAt");

-- CreateIndex (idempotent)
CREATE INDEX IF NOT EXISTS "Device_name_idx" ON "Device"("name");

-- CreateIndex (idempotent)
CREATE INDEX IF NOT EXISTS "Device_connected_idx" ON "Device"("connected");

-- CreateIndex (idempotent)
CREATE INDEX IF NOT EXISTS "Device_claimedAt_idx" ON "Device"("claimedAt");

-- CreateIndex (idempotent)
CREATE INDEX IF NOT EXISTS "DeviceActionLog_deviceId_actionType_status_idx" ON "DeviceActionLog"("deviceId", "actionType", "status");

-- CreateIndex (idempotent)
CREATE INDEX IF NOT EXISTS "DeviceActionLog_deviceId_initiatedAt_idx" ON "DeviceActionLog"("deviceId", "initiatedAt");

-- CreateIndex (idempotent)
CREATE INDEX IF NOT EXISTS "RefreshToken_expiresAt_isRevoked_idx" ON "RefreshToken"("expiresAt", "isRevoked");

-- CreateIndex (idempotent)
CREATE INDEX IF NOT EXISTS "Session_status_idx" ON "Session"("status");

-- CreateIndex (idempotent)
CREATE INDEX IF NOT EXISTS "Session_expiresAt_idx" ON "Session"("expiresAt");

-- AddForeignKey (idempotent)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'AuditLog_userId_fkey'
    ) THEN
        ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" 
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey (idempotent)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'Device_createdBy_fkey'
    ) THEN
        ALTER TABLE "Device" ADD CONSTRAINT "Device_createdBy_fkey" 
        FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
