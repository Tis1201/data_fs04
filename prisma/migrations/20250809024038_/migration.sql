-- CreateTable
CREATE TABLE "License" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT NOT NULL,
    "updatedBy" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "deviceId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "jwt" TEXT NOT NULL,
    "keyId" TEXT NOT NULL,
    "algorithm" TEXT NOT NULL DEFAULT 'RS256',

    CONSTRAINT "License_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LicenseRenewal" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT NOT NULL,
    "updatedBy" TEXT NOT NULL,
    "licenseId" TEXT NOT NULL,
    "oldIssuedAt" TIMESTAMP(3),
    "oldExpiresAt" TIMESTAMP(3),
    "newIssuedAt" TIMESTAMP(3) NOT NULL,
    "newExpiresAt" TIMESTAMP(3) NOT NULL,
    "jwtSnapshot" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "transactionId" TEXT,
    "metadata" TEXT,
    "performedBy" TEXT,

    CONSTRAINT "LicenseRenewal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Entitlement" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT NOT NULL,
    "updatedBy" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "value" TEXT,
    "metadata" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "accountId" TEXT,
    "licenseId" TEXT,

    CONSTRAINT "Entitlement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "License_accountId_idx" ON "License"("accountId");

-- CreateIndex
CREATE INDEX "License_deviceId_idx" ON "License"("deviceId");

-- CreateIndex
CREATE INDEX "License_status_idx" ON "License"("status");

-- CreateIndex
CREATE UNIQUE INDEX "License_accountId_deviceId_status_key" ON "License"("accountId", "deviceId", "status");

-- CreateIndex
CREATE INDEX "LicenseRenewal_licenseId_idx" ON "LicenseRenewal"("licenseId");

-- CreateIndex
CREATE INDEX "LicenseRenewal_transactionId_idx" ON "LicenseRenewal"("transactionId");

-- CreateIndex
CREATE INDEX "Entitlement_accountId_idx" ON "Entitlement"("accountId");

-- CreateIndex
CREATE INDEX "Entitlement_licenseId_idx" ON "Entitlement"("licenseId");

-- CreateIndex
CREATE INDEX "Entitlement_status_idx" ON "Entitlement"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Entitlement_licenseId_code_key" ON "Entitlement"("licenseId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Entitlement_accountId_code_key" ON "Entitlement"("accountId", "code");

-- AddForeignKey
ALTER TABLE "License" ADD CONSTRAINT "License_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "License" ADD CONSTRAINT "License_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LicenseRenewal" ADD CONSTRAINT "LicenseRenewal_licenseId_fkey" FOREIGN KEY ("licenseId") REFERENCES "License"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Entitlement" ADD CONSTRAINT "Entitlement_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Entitlement" ADD CONSTRAINT "Entitlement_licenseId_fkey" FOREIGN KEY ("licenseId") REFERENCES "License"("id") ON DELETE CASCADE ON UPDATE CASCADE;
