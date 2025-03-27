-- CreateTable
CREATE TABLE "WebhookHourlyMetric" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "webhookId" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "hourOfDay" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WebhookHourlyMetric_webhookId_fkey" FOREIGN KEY ("webhookId") REFERENCES "WebhookEndPoint" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "WebhookHourlyMetric_webhookId_hourOfDay_key" ON "WebhookHourlyMetric"("webhookId", "hourOfDay");
