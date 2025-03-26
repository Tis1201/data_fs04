-- CreateTable
CREATE TABLE "WebhookEndPoint" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "postfix" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" DATETIME,
    "lastUsedAt" DATETIME,
    "createdBy" TEXT NOT NULL
);

-- CreateIndex
CREATE INDEX "WebhookEndPoint_name_idx" ON "WebhookEndPoint"("name");

-- CreateIndex
CREATE INDEX "WebhookEndPoint_description_idx" ON "WebhookEndPoint"("description");
