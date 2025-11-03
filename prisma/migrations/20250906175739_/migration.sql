-- AlterTable
ALTER TABLE "DeviceTag" ADD COLUMN     "accountId" TEXT;

-- AddForeignKey
ALTER TABLE "DeviceTag" ADD CONSTRAINT "DeviceTag_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;
