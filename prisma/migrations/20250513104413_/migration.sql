-- CreateTable
CREATE TABLE "EmailServiceProvider" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "fromEmail" TEXT NOT NULL,
    "fromName" TEXT,
    "smtpHost" TEXT,
    "smtpPort" INTEGER,
    "smtpUser" TEXT,
    "smtpPass" TEXT,
    "smtpSecure" BOOLEAN NOT NULL DEFAULT true,
    "smtpAuth" BOOLEAN NOT NULL DEFAULT true,
    "apiKey" TEXT,
    "apiSecret" TEXT,
    "domain" TEXT,
    "region" TEXT,
    "webhookUrl" TEXT,
    "webhookKey" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,
    "updatedBy" TEXT NOT NULL,
    "lastUsedAt" DATETIME,
    "totalSent" INTEGER NOT NULL DEFAULT 0
);

-- CreateIndex
CREATE INDEX "EmailServiceProvider_isActive_idx" ON "EmailServiceProvider"("isActive");

-- CreateIndex
CREATE INDEX "EmailServiceProvider_isDefault_idx" ON "EmailServiceProvider"("isDefault");

-- CreateIndex
CREATE INDEX "EmailServiceProvider_type_idx" ON "EmailServiceProvider"("type");
