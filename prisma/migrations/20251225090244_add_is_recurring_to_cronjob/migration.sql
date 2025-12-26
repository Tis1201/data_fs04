-- AlterTable
ALTER TABLE "CronJob" ADD COLUMN     "isRecurring" BOOLEAN NOT NULL DEFAULT true,
ALTER COLUMN "cronExpression" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "CronJob_isRecurring_idx" ON "CronJob"("isRecurring");
