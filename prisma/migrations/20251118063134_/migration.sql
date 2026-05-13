/*
  Warnings:

  - A unique constraint covering the columns `[registrationPin]` on the table `FactoryDevice` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "FactoryDevice" ADD COLUMN     "registrationPin" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "FactoryDevice_registrationPin_key" ON "FactoryDevice"("registrationPin");
