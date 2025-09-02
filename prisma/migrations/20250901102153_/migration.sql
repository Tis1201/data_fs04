/*
  Warnings:

  - You are about to drop the column `updateStrategy` on the `Bundle` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Bundle" DROP COLUMN IF EXISTS "updateStrategy";
ALTER TABLE "Bundle" ADD COLUMN IF NOT EXISTS "autoOpen" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Bundle" ADD COLUMN IF NOT EXISTS "forceUpdate" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "DeviceTag" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeviceTag_pkey" PRIMARY KEY ("id")
);

-- Removed duplicate table creations that already exist in earlier migrations

-- CreateTable
CREATE TABLE "_DeviceTags" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- Removed duplicate index creations for tables that already exist

-- CreateIndex
CREATE UNIQUE INDEX "_DeviceTags_AB_unique" ON "_DeviceTags"("A", "B");

-- CreateIndex
CREATE INDEX "_DeviceTags_B_index" ON "_DeviceTags"("B");

-- Removed duplicate foreign keys for existing tables

-- AddForeignKey
ALTER TABLE "_DeviceTags" ADD CONSTRAINT "_DeviceTags_A_fkey" FOREIGN KEY ("A") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_DeviceTags" ADD CONSTRAINT "_DeviceTags_B_fkey" FOREIGN KEY ("B") REFERENCES "DeviceTag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
