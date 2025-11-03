-- AlterTable
ALTER TABLE "DeviceProfileAssignment" ADD COLUMN     "applicationError" TEXT,
ADD COLUMN     "applicationMessage" TEXT,
ADD COLUMN     "applicationStatus" TEXT,
ADD COLUMN     "attemptCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lastAttemptAt" TIMESTAMP(3),
ALTER COLUMN "status" SET DEFAULT 'PENDING';

-- CreateIndex
CREATE INDEX "DeviceProfileAssignment_status_idx" ON "DeviceProfileAssignment"("status");

-- CreateIndex
CREATE INDEX "DeviceProfileAssignment_appliedAt_idx" ON "DeviceProfileAssignment"("appliedAt");

-- CreateIndex
CREATE INDEX "DeviceProfileAssignment_lastAttemptAt_idx" ON "DeviceProfileAssignment"("lastAttemptAt");
