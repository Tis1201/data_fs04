-- AlterTable
-- Add signingKeyId to License table to reference the TOKEN signing key used to sign the license
ALTER TABLE "License" ADD COLUMN "signingKeyId" TEXT;

-- CreateIndex
CREATE INDEX "License_signingKeyId_idx" ON "License"("signingKeyId");

-- AddForeignKey
ALTER TABLE "License" ADD CONSTRAINT "License_signingKeyId_fkey" FOREIGN KEY ("signingKeyId") REFERENCES "JwtSigningKey"("id") ON DELETE RESTRICT ON UPDATE CASCADE;





