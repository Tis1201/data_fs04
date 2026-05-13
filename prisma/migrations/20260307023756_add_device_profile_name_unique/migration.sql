/*
  Warnings:

  - A unique constraint covering the columns `[accountId,name]` on the table `DeviceProfile` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "DeviceProfile_accountId_name_key" ON "DeviceProfile"("accountId", "name");
