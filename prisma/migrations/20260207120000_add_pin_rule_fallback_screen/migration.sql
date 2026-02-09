-- AlterTable
ALTER TABLE "PinRule" ADD COLUMN     "fallbackScreenEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "fallbackScreenUrl" TEXT;
