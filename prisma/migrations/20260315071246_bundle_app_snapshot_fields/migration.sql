-- DropForeignKey
ALTER TABLE "BundleApp" DROP CONSTRAINT "BundleApp_resourceId_fkey";

-- DropIndex
DROP INDEX "DeviceProfile_accountId_name_key";

-- AlterTable
ALTER TABLE "BundleApp" ADD COLUMN     "resourceFormatSnapshot" TEXT,
ADD COLUMN     "resourceNameSnapshot" TEXT,
ADD COLUMN     "resourcePackageNameSnapshot" TEXT,
ADD COLUMN     "resourceSizeSnapshot" INTEGER,
ADD COLUMN     "resourceVersionSnapshot" TEXT,
ALTER COLUMN "resourceId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "BundleApp" ADD CONSTRAINT "BundleApp_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill snapshot fields from Resource for existing BundleApp rows
UPDATE "BundleApp" ba
SET
  "resourceNameSnapshot" = r.name,
  "resourcePackageNameSnapshot" = r."packageName",
  "resourceVersionSnapshot" = r.version,
  "resourceSizeSnapshot" = r.size,
  "resourceFormatSnapshot" = r.format
FROM "Resource" r
WHERE ba."resourceId" = r.id
  AND ba."resourceNameSnapshot" IS NULL;
