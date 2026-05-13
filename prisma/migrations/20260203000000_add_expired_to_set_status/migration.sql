-- Add EXPIRED to SetStatus enum for PreclaimSet (expired sets and unclaimed devices)
ALTER TYPE "SetStatus" ADD VALUE IF NOT EXISTS 'EXPIRED';
