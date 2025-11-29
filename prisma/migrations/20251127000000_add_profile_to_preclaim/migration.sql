-- Add profileId column to PreclaimSet table
-- This allows preclaims to have an associated device profile that will be applied when devices are claimed

-- AlterTable: Add profileId column (nullable)
ALTER TABLE "PreclaimSet" ADD COLUMN "profileId" TEXT;

-- CreateIndex: Add index on profileId column for faster queries
CREATE INDEX "PreclaimSet_profileId_idx" ON "PreclaimSet"("profileId");

-- AddForeignKey: Add foreign key constraint to DeviceProfile
ALTER TABLE "PreclaimSet" ADD CONSTRAINT "PreclaimSet_profileId_fkey" 
    FOREIGN KEY ("profileId") REFERENCES "DeviceProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

