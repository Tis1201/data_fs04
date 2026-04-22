-- CreateEnum
CREATE TYPE "ResourceShareScope" AS ENUM ('NONE', 'ALL_ACCOUNTS', 'SELECTED_ACCOUNTS');

-- AlterTable
ALTER TABLE "Resource" ADD COLUMN     "shareScope" "ResourceShareScope" NOT NULL DEFAULT 'NONE';

-- CreateTable
CREATE TABLE "ResourceAccountShare" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resourceId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,

    CONSTRAINT "ResourceAccountShare_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ResourceAccountShare_accountId_idx" ON "ResourceAccountShare"("accountId");

-- CreateIndex
CREATE INDEX "ResourceAccountShare_resourceId_idx" ON "ResourceAccountShare"("resourceId");

-- CreateIndex
CREATE UNIQUE INDEX "ResourceAccountShare_resourceId_accountId_key" ON "ResourceAccountShare"("resourceId", "accountId");

-- CreateIndex
CREATE INDEX "Resource_shareScope_idx" ON "Resource"("shareScope");

-- AddForeignKey
ALTER TABLE "ResourceAccountShare" ADD CONSTRAINT "ResourceAccountShare_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourceAccountShare" ADD CONSTRAINT "ResourceAccountShare_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
