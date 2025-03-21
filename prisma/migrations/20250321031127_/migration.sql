-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_WhatsAppAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "client_id" TEXT NOT NULL,
    "client_status" TEXT NOT NULL DEFAULT 'disconnected',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    CONSTRAINT "WhatsAppAccount_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_WhatsAppAccount" ("client_id", "createdAt", "createdBy", "description", "id", "phoneNumber", "updatedAt") SELECT "client_id", "createdAt", "createdBy", "description", "id", "phoneNumber", "updatedAt" FROM "WhatsAppAccount";
DROP TABLE "WhatsAppAccount";
ALTER TABLE "new_WhatsAppAccount" RENAME TO "WhatsAppAccount";
CREATE UNIQUE INDEX "WhatsAppAccount_client_id_key" ON "WhatsAppAccount"("client_id");
CREATE INDEX "WhatsAppAccount_createdBy_idx" ON "WhatsAppAccount"("createdBy");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
