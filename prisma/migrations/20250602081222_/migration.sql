-- CreateTable
CREATE TABLE "Bundle" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "os" TEXT NOT NULL,
    "reboot" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "cancelAt" DATETIME,
    "createdBy" TEXT NOT NULL,
    "updatedBy" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "waveSize" INTEGER NOT NULL DEFAULT 500
);

-- CreateTable
CREATE TABLE "BundleApp" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bundleId" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "autoOpen" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "createdBy" TEXT NOT NULL,
    "updatedBy" TEXT NOT NULL,
    CONSTRAINT "BundleApp_bundleId_fkey" FOREIGN KEY ("bundleId") REFERENCES "Bundle" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "BundleApp_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BundleWave" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bundleId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "maxDevices" INTEGER NOT NULL DEFAULT 500,
    "startTime" DATETIME,
    "endTime" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "createdBy" TEXT NOT NULL,
    "updatedBy" TEXT NOT NULL,
    CONSTRAINT "BundleWave_bundleId_fkey" FOREIGN KEY ("bundleId") REFERENCES "Bundle" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WaveInstallTask" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "waveId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "transactionId" TEXT,
    "status" TEXT NOT NULL,
    "result" TEXT,
    "errorDetails" TEXT,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "createdBy" TEXT NOT NULL,
    "updatedBy" TEXT NOT NULL,
    CONSTRAINT "WaveInstallTask_waveId_fkey" FOREIGN KEY ("waveId") REFERENCES "BundleWave" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Bundle_name_idx" ON "Bundle"("name");

-- CreateIndex
CREATE INDEX "Bundle_version_idx" ON "Bundle"("version");

-- CreateIndex
CREATE INDEX "Bundle_createdBy_idx" ON "Bundle"("createdBy");

-- CreateIndex
CREATE INDEX "Bundle_status_idx" ON "Bundle"("status");

-- CreateIndex
CREATE INDEX "BundleApp_bundleId_idx" ON "BundleApp"("bundleId");

-- CreateIndex
CREATE INDEX "BundleApp_resourceId_idx" ON "BundleApp"("resourceId");

-- CreateIndex
CREATE INDEX "BundleWave_bundleId_idx" ON "BundleWave"("bundleId");

-- CreateIndex
CREATE INDEX "BundleWave_status_idx" ON "BundleWave"("status");

-- CreateIndex
CREATE INDEX "WaveInstallTask_status_idx" ON "WaveInstallTask"("status");

-- CreateIndex
CREATE INDEX "WaveInstallTask_deviceId_idx" ON "WaveInstallTask"("deviceId");

-- CreateIndex
CREATE INDEX "WaveInstallTask_waveId_idx" ON "WaveInstallTask"("waveId");

-- CreateIndex
CREATE UNIQUE INDEX "WaveInstallTask_waveId_deviceId_key" ON "WaveInstallTask"("waveId", "deviceId");
