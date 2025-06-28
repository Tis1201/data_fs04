/*
  Warnings:

  - You are about to drop the column `keyId` on the `WhatsAppAuthData` table. All the data in the column will be lost.
  - You are about to drop the column `type` on the `WhatsAppAuthData` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_WhatsAppAuthData" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientId" TEXT NOT NULL,
    "file" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_WhatsAppAuthData" ("clientId", "createdAt", "data", "file", "id", "updatedAt") SELECT "clientId", "createdAt", "data", "file", "id", "updatedAt" FROM "WhatsAppAuthData";
DROP TABLE "WhatsAppAuthData";
ALTER TABLE "new_WhatsAppAuthData" RENAME TO "WhatsAppAuthData";
CREATE INDEX "WhatsAppAuthData_clientId_idx" ON "WhatsAppAuthData"("clientId");
CREATE UNIQUE INDEX "WhatsAppAuthData_clientId_file_key" ON "WhatsAppAuthData"("clientId", "file");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
