/*
  Warnings:

  - A unique constraint covering the columns `[clientId,file]` on the table `WhatsAppAuthData` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "WhatsAppAuthData_clientId_keyId_key";

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppAuthData_clientId_file_key" ON "WhatsAppAuthData"("clientId", "file");
