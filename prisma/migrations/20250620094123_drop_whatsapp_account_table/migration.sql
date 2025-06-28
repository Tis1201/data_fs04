/*
  Warnings:

  - Added the required column `accountId` to the `WhatsAppAccount` table without a default value. This is not possible if the table is not empty.

*/
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
    "name" TEXT,
    "description" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    CONSTRAINT "WhatsAppAccount_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WhatsAppAccount_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_WhatsAppAccount" ("client_id", "client_status", "createdAt", "createdBy", "description", "id", "name", "phoneNumber", "updatedAt") SELECT "client_id", "client_status", "createdAt", "createdBy", "description", "id", "name", "phoneNumber", "updatedAt" FROM "WhatsAppAccount";
DROP TABLE "WhatsAppAccount";
ALTER TABLE "new_WhatsAppAccount" RENAME TO "WhatsAppAccount";
CREATE UNIQUE INDEX "WhatsAppAccount_client_id_key" ON "WhatsAppAccount"("client_id");
CREATE INDEX "WhatsAppAccount_createdBy_idx" ON "WhatsAppAccount"("createdBy");
CREATE INDEX "WhatsAppAccount_accountId_idx" ON "WhatsAppAccount"("accountId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
