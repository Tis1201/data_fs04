/*
  Warnings:

  - You are about to drop the `DeviceAppPin` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "DeviceAppPin" DROP CONSTRAINT "DeviceAppPin_deviceId_fkey";

-- DropForeignKey
ALTER TABLE "DeviceAppPin" DROP CONSTRAINT "DeviceAppPin_pinnedByRuleId_fkey";

-- DropTable
DROP TABLE "DeviceAppPin";
