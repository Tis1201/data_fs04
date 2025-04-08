/*
  Warnings:

  - You are about to drop the column `createdBy` on the `WhatsAppAuthData` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_WhatsAppAuthData" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientId" TEXT NOT NULL,
    "keyId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "whatsappAccountId" TEXT NOT NULL,
    CONSTRAINT "WhatsAppAuthData_whatsappAccountId_fkey" FOREIGN KEY ("whatsappAccountId") REFERENCES "WhatsAppAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_WhatsAppAuthData" ("clientId", "createdAt", "data", "id", "keyId", "type", "updatedAt", "whatsappAccountId") SELECT "clientId", "createdAt", "data", "id", "keyId", "type", "updatedAt", "whatsappAccountId" FROM "WhatsAppAuthData";
DROP TABLE "WhatsAppAuthData";
ALTER TABLE "new_WhatsAppAuthData" RENAME TO "WhatsAppAuthData";
CREATE INDEX "WhatsAppAuthData_type_idx" ON "WhatsAppAuthData"("type");
CREATE INDEX "WhatsAppAuthData_clientId_idx" ON "WhatsAppAuthData"("clientId");
CREATE UNIQUE INDEX "WhatsAppAuthData_clientId_keyId_key" ON "WhatsAppAuthData"("clientId", "keyId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
