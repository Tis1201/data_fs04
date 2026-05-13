-- AlterTable
-- Idempotent: Check if column exists before adding
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'Resource' AND column_name = 'releaseType'
    ) THEN
        ALTER TABLE "Resource" ADD COLUMN "releaseType" TEXT DEFAULT 'Production';
    END IF;
END $$;

