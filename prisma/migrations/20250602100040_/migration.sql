-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Bundle" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "os" TEXT NOT NULL,
    "reboot" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "cancelAt" DATETIME,
    "createdBy" TEXT NOT NULL,
    "updatedBy" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "waveSize" INTEGER NOT NULL DEFAULT 500,
    "scheduledAt" DATETIME,
    "scheduledAtTimezone" TEXT,
    "scheduledAtStartIfMissed" BOOLEAN NOT NULL DEFAULT false
);
INSERT INTO "new_Bundle" ("accountId", "cancelAt", "createdAt", "createdBy", "description", "id", "name", "os", "reboot", "status", "updatedAt", "updatedBy", "version", "waveSize") SELECT "accountId", "cancelAt", "createdAt", "createdBy", "description", "id", "name", "os", "reboot", "status", "updatedAt", "updatedBy", "version", "waveSize" FROM "Bundle";
DROP TABLE "Bundle";
ALTER TABLE "new_Bundle" RENAME TO "Bundle";
CREATE INDEX "Bundle_name_idx" ON "Bundle"("name");
CREATE INDEX "Bundle_version_idx" ON "Bundle"("version");
CREATE INDEX "Bundle_createdBy_idx" ON "Bundle"("createdBy");
CREATE INDEX "Bundle_status_idx" ON "Bundle"("status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
