-- This migration ensures CronJob tables are in sync
-- All objects already exist, this is a no-op migration for Prisma's drift detection

-- Verify enum exists (idempotent)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CronJobStatus') THEN
        CREATE TYPE "CronJobStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'PAUSED');
    END IF;
END $$;

-- Verify tables exist (idempotent)
CREATE TABLE IF NOT EXISTS "CronJob" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "functionName" TEXT NOT NULL,
    "args" JSONB NOT NULL,
    "cronExpression" TEXT NOT NULL,
    "status" "CronJobStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastRunAt" TIMESTAMP(3),
    "nextRunAt" TIMESTAMP(3),
    "lastResult" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "maxRetries" INTEGER NOT NULL DEFAULT 3,
    "timeout" INTEGER,
    "isRunning" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "accountId" TEXT,
    CONSTRAINT "CronJob_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CronJobExecution" (
    "id" TEXT NOT NULL,
    "cronJobId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "duration" INTEGER,
    "result" TEXT,
    "error" TEXT,
    "metadata" JSONB,
    CONSTRAINT "CronJobExecution_pkey" PRIMARY KEY ("id")
);

-- Verify all indexes exist (idempotent)
CREATE INDEX IF NOT EXISTS "CronJob_status_idx" ON "CronJob"("status");
CREATE INDEX IF NOT EXISTS "CronJob_nextRunAt_idx" ON "CronJob"("nextRunAt");
CREATE INDEX IF NOT EXISTS "CronJob_isRunning_idx" ON "CronJob"("isRunning");
CREATE INDEX IF NOT EXISTS "CronJob_accountId_idx" ON "CronJob"("accountId");
CREATE INDEX IF NOT EXISTS "CronJob_createdBy_idx" ON "CronJob"("createdBy");
CREATE INDEX IF NOT EXISTS "CronJob_functionName_idx" ON "CronJob"("functionName");
CREATE INDEX IF NOT EXISTS "CronJobExecution_cronJobId_idx" ON "CronJobExecution"("cronJobId");
CREATE INDEX IF NOT EXISTS "CronJobExecution_status_idx" ON "CronJobExecution"("status");
CREATE INDEX IF NOT EXISTS "CronJobExecution_startedAt_idx" ON "CronJobExecution"("startedAt");

-- Verify all foreign keys exist (idempotent)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'CronJob_createdBy_fkey'
    ) THEN
        ALTER TABLE "CronJob" ADD CONSTRAINT "CronJob_createdBy_fkey" 
        FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'CronJob_accountId_fkey'
    ) THEN
        ALTER TABLE "CronJob" ADD CONSTRAINT "CronJob_accountId_fkey" 
        FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'CronJobExecution_cronJobId_fkey'
    ) THEN
        ALTER TABLE "CronJobExecution" ADD CONSTRAINT "CronJobExecution_cronJobId_fkey" 
        FOREIGN KEY ("cronJobId") REFERENCES "CronJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

