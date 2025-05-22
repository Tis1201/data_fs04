-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_EmailServiceProvider" (
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
    "totalSent" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE'
);
INSERT INTO "new_EmailServiceProvider" ("apiKey", "apiSecret", "createdAt", "createdBy", "domain", "fromEmail", "fromName", "id", "isActive", "isDefault", "lastUsedAt", "name", "region", "smtpAuth", "smtpHost", "smtpPass", "smtpPort", "smtpSecure", "smtpUser", "totalSent", "type", "updatedAt", "updatedBy", "webhookKey", "webhookUrl") SELECT "apiKey", "apiSecret", "createdAt", "createdBy", "domain", "fromEmail", "fromName", "id", "isActive", "isDefault", "lastUsedAt", "name", "region", "smtpAuth", "smtpHost", "smtpPass", "smtpPort", "smtpSecure", "smtpUser", "totalSent", "type", "updatedAt", "updatedBy", "webhookKey", "webhookUrl" FROM "EmailServiceProvider";
DROP TABLE "EmailServiceProvider";
ALTER TABLE "new_EmailServiceProvider" RENAME TO "EmailServiceProvider";
CREATE INDEX "EmailServiceProvider_isActive_idx" ON "EmailServiceProvider"("isActive");
CREATE INDEX "EmailServiceProvider_isDefault_idx" ON "EmailServiceProvider"("isDefault");
CREATE INDEX "EmailServiceProvider_type_idx" ON "EmailServiceProvider"("type");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Resource_createdBy_idx" ON "Resource"("createdBy");
