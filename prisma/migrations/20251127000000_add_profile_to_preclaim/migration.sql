-- Add profileId column to PreclaimSet table
-- This allows preclaims to have an associated device profile that will be applied when devices are claimed

-- AlterTable: Add profileId column (nullable)
-- Idempotent: Check if column exists before adding
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'PreclaimSet' AND column_name = 'profileId'
    ) THEN
        ALTER TABLE "PreclaimSet" ADD COLUMN "profileId" TEXT;
    END IF;
END $$;

-- CreateIndex: Add index on profileId column for faster queries
-- Idempotent: Check if index exists before creating
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'PreclaimSet' AND indexname = 'PreclaimSet_profileId_idx'
    ) THEN
        CREATE INDEX "PreclaimSet_profileId_idx" ON "PreclaimSet"("profileId");
    END IF;
END $$;

-- AddForeignKey: Add foreign key constraint to DeviceProfile
-- Idempotent: Check if constraint exists before adding
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'PreclaimSet_profileId_fkey'
    ) THEN
        ALTER TABLE "PreclaimSet" ADD CONSTRAINT "PreclaimSet_profileId_fkey" 
        FOREIGN KEY ("profileId") REFERENCES "DeviceProfile"("id") 
        ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

