-- Step 1: If signingKeyId doesn't exist, add it as nullable
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'License' AND column_name = 'signingKeyId'
    ) THEN
        ALTER TABLE "License" ADD COLUMN "signingKeyId" TEXT;
        CREATE INDEX "License_signingKeyId_idx" ON "License"("signingKeyId");
    END IF;
END $$;

-- Step 2: Update existing licenses to reference a TOKEN signing key
-- This will only run if there are licenses with NULL signingKeyId
DO $$
DECLARE
    token_key_id TEXT;
    license_count INTEGER;
BEGIN
    -- Check if there are any licenses with NULL signingKeyId
    SELECT COUNT(*) INTO license_count
    FROM "License"
    WHERE "signingKeyId" IS NULL;
    
    -- Only proceed if there are licenses that need updating
    IF license_count > 0 THEN
        -- Find the first active TOKEN signing key
        SELECT id INTO token_key_id
        FROM "JwtSigningKey"
        WHERE "keyType" = 'TOKEN' AND "isActive" = true
        ORDER BY "createdAt" DESC
        LIMIT 1;
        
        -- If we found a TOKEN key, update all NULL signingKeyId values
        IF token_key_id IS NOT NULL THEN
            UPDATE "License"
            SET "signingKeyId" = token_key_id
            WHERE "signingKeyId" IS NULL;
            
            RAISE NOTICE 'Updated % licenses with signingKeyId: %', license_count, token_key_id;
        ELSE
            RAISE EXCEPTION 'No active TOKEN signing key found. Please create one before running this migration.';
        END IF;
    ELSE
        RAISE NOTICE 'No licenses need updating. All have signingKeyId set.';
    END IF;
END $$;

-- Step 3: Now make the column NOT NULL (all existing rows now have values)
ALTER TABLE "License" ALTER COLUMN "signingKeyId" SET NOT NULL;

-- Step 4: Add foreign key constraint if it doesn't exist
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

