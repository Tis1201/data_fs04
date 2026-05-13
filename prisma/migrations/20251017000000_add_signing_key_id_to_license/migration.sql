-- AlterTable
-- Add signingKeyId to License table to reference the TOKEN signing key used to sign the license
-- Idempotent: Check if column exists before adding
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'License' AND column_name = 'signingKeyId'
    ) THEN
        ALTER TABLE "License" ADD COLUMN "signingKeyId" TEXT;
    END IF;
END $$;

-- CreateIndex
-- Idempotent: Check if index exists before creating
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'License' AND indexname = 'License_signingKeyId_idx'
    ) THEN
        CREATE INDEX "License_signingKeyId_idx" ON "License"("signingKeyId");
    END IF;
END $$;

-- AddForeignKey
-- Idempotent: Check if constraint exists before adding
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'License_signingKeyId_fkey'
    ) THEN
        ALTER TABLE "License" ADD CONSTRAINT "License_signingKeyId_fkey" 
        FOREIGN KEY ("signingKeyId") REFERENCES "JwtSigningKey"("id") 
        ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;





