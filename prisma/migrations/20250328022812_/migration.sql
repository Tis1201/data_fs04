-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_WebhookEndPoint" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "postfix" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" DATETIME,
    "lastUsedAt" DATETIME,
    "createdBy" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE'
);
INSERT INTO "new_WebhookEndPoint" ("active", "createdAt", "createdBy", "description", "expiresAt", "id", "lastUsedAt", "name", "postfix", "updatedAt") SELECT "active", "createdAt", "createdBy", "description", "expiresAt", "id", "lastUsedAt", "name", "postfix", "updatedAt" FROM "WebhookEndPoint";
DROP TABLE "WebhookEndPoint";
ALTER TABLE "new_WebhookEndPoint" RENAME TO "WebhookEndPoint";
CREATE INDEX "WebhookEndPoint_name_idx" ON "WebhookEndPoint"("name");
CREATE INDEX "WebhookEndPoint_description_idx" ON "WebhookEndPoint"("description");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
