-- CreateEnum
CREATE TYPE "SensorTemplateType" AS ENUM ('CONFIGURATION', 'ALERT');

-- CreateTable
CREATE TABLE "SensorTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "SensorTemplateType" NOT NULL DEFAULT 'CONFIGURATION',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "config" JSONB,
    "accountId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,

    CONSTRAINT "SensorTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SensorTemplateAssignment" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "sensorId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignedBy" TEXT,

    CONSTRAINT "SensorTemplateAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SensorTemplate_accountId_idx" ON "SensorTemplate"("accountId");

-- CreateIndex
CREATE INDEX "SensorTemplate_type_idx" ON "SensorTemplate"("type");

-- CreateIndex
CREATE INDEX "SensorTemplate_isDefault_idx" ON "SensorTemplate"("isDefault");

-- CreateIndex
CREATE INDEX "SensorTemplateAssignment_templateId_idx" ON "SensorTemplateAssignment"("templateId");

-- CreateIndex
CREATE INDEX "SensorTemplateAssignment_sensorId_idx" ON "SensorTemplateAssignment"("sensorId");

-- CreateIndex
CREATE UNIQUE INDEX "SensorTemplateAssignment_templateId_sensorId_key" ON "SensorTemplateAssignment"("templateId", "sensorId");

-- AddForeignKey
ALTER TABLE "SensorTemplate" ADD CONSTRAINT "SensorTemplate_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SensorTemplate" ADD CONSTRAINT "SensorTemplate_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SensorTemplateAssignment" ADD CONSTRAINT "SensorTemplateAssignment_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "SensorTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SensorTemplateAssignment" ADD CONSTRAINT "SensorTemplateAssignment_sensorId_fkey" FOREIGN KEY ("sensorId") REFERENCES "Sensor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SensorTemplateAssignment" ADD CONSTRAINT "SensorTemplateAssignment_assignedBy_fkey" FOREIGN KEY ("assignedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
