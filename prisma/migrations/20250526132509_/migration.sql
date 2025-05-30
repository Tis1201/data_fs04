/*
  Warnings:

  - You are about to drop the column `serialNumber` on the `FactoryToken` table. All the data in the column will be lost.
  - You are about to drop the column `tokenId` on the `FactoryToken` table. All the data in the column will be lost.
  - Added the required column `factory_signing_key_id` to the `FactoryToken` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_FactoryToken" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "hardwareModel" TEXT NOT NULL,
    "firmwareVersion" TEXT NOT NULL,
    "batchNumber" TEXT,
    "isUsed" BOOLEAN NOT NULL DEFAULT false,
    "usedAt" DATETIME,
    "usedByIp" TEXT,
    "issuedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL,
    "issuedBy" TEXT NOT NULL,
    "notes" TEXT,
    "factory_signing_key_id" TEXT NOT NULL,
    "deviceId" TEXT,
    CONSTRAINT "FactoryToken_factory_signing_key_id_fkey" FOREIGN KEY ("factory_signing_key_id") REFERENCES "JwtSigningKey" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "FactoryToken_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_FactoryToken" ("batchNumber", "deviceId", "expiresAt", "firmwareVersion", "hardwareModel", "id", "isUsed", "issuedAt", "issuedBy", "notes", "usedAt", "usedByIp") SELECT "batchNumber", "deviceId", "expiresAt", "firmwareVersion", "hardwareModel", "id", "isUsed", "issuedAt", "issuedBy", "notes", "usedAt", "usedByIp" FROM "FactoryToken";
DROP TABLE "FactoryToken";
ALTER TABLE "new_FactoryToken" RENAME TO "FactoryToken";
CREATE INDEX "FactoryToken_isUsed_idx" ON "FactoryToken"("isUsed");
CREATE INDEX "FactoryToken_expiresAt_idx" ON "FactoryToken"("expiresAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
