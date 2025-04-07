-- CreateTable
CREATE TABLE "WhatsAppAuthData" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientId" TEXT NOT NULL,
    "keyId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    "whatsappAccountId" TEXT NOT NULL,
    CONSTRAINT "WhatsAppAuthData_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WhatsAppAuthData_whatsappAccountId_fkey" FOREIGN KEY ("whatsappAccountId") REFERENCES "WhatsAppAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "WhatsAppAuthData_type_idx" ON "WhatsAppAuthData"("type");

-- CreateIndex
CREATE INDEX "WhatsAppAuthData_clientId_idx" ON "WhatsAppAuthData"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppAuthData_clientId_keyId_key" ON "WhatsAppAuthData"("clientId", "keyId");
