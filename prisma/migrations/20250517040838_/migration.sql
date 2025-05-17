-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "rolesString" TEXT NOT NULL DEFAULT '',
    "systemRole" TEXT NOT NULL DEFAULT 'USER',
    "primaryAccountId" TEXT,
    CONSTRAINT "User_primaryAccountId_fkey" FOREIGN KEY ("primaryAccountId") REFERENCES "Account" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_User" ("createdAt", "email", "id", "name", "password", "rolesString", "status", "systemRole", "updatedAt") SELECT "createdAt", "email", "id", "name", "password", "rolesString", "status", "systemRole", "updatedAt" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "User_primaryAccountId_idx" ON "User"("primaryAccountId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
