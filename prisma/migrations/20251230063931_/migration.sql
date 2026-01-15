/*
  Warnings:

  - A unique constraint covering the columns `[code]` on the table `Plan` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `code` to the `Plan` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Plan" ADD COLUMN     "code" TEXT NOT NULL,
ADD COLUMN     "maxLogLinesPerMonth" INTEGER NOT NULL DEFAULT 10000,
ADD COLUMN     "stripePriceId" TEXT;

-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "licenseExpiresAt" TIMESTAMP(3),
ADD COLUMN     "overrideMaxUsers" INTEGER,
ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'stripe',
ADD COLUMN     "trialEndsAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "WebhookEvent" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "objectId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WebhookEvent_type_idx" ON "WebhookEvent"("type");

-- CreateIndex
CREATE UNIQUE INDEX "Plan_code_key" ON "Plan"("code");

-- CreateIndex
CREATE INDEX "Plan_isActive_idx" ON "Plan"("isActive");

-- CreateIndex
CREATE INDEX "Plan_code_idx" ON "Plan"("code");

-- CreateIndex
CREATE INDEX "Subscription_status_idx" ON "Subscription"("status");

-- CreateIndex
CREATE INDEX "Subscription_planId_idx" ON "Subscription"("planId");

-- CreateIndex
CREATE INDEX "Subscription_source_idx" ON "Subscription"("source");
