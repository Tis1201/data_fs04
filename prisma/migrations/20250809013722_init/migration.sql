-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "description" TEXT,
    "logoUrl" TEXT,
    "settings" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "ipAddress" TEXT,
    "actionType" TEXT NOT NULL,
    "tableName" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "oldData" JSONB,
    "newData" JSONB,
    "changeSummary" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "description" TEXT,
    "address" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "accountId" TEXT NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountMembership" (
    "id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,

    CONSTRAINT "AccountMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Group" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "accountId" TEXT NOT NULL,

    CONSTRAINT "Group_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupMembership" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "groupId" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,

    CONSTRAINT "GroupMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permission" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "allowed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "rolesString" TEXT NOT NULL DEFAULT '',
    "systemRole" TEXT NOT NULL DEFAULT 'USER',
    "primaryAccountId" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Key" (
    "id" TEXT NOT NULL,
    "hashed_password" TEXT,
    "user_id" TEXT NOT NULL,

    CONSTRAINT "Key_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiKey" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "userId" TEXT NOT NULL,
    "accountId" TEXT,

    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookEndPoint" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "postfix" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "WebhookEndPoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookHourlyMetric" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "webhookId" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "hourOfDay" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookHourlyMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ListenerEndpoint" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "postfix" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "listenToAll" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ListenerEndpoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ListenerWebhookEndpoint" (
    "id" TEXT NOT NULL,
    "listenerId" TEXT NOT NULL,
    "webhookEndpointId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ListenerWebhookEndpoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ListenerWhatsAppAccount" (
    "id" TEXT NOT NULL,
    "listenerId" TEXT NOT NULL,
    "whatsappAccountId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ListenerWhatsAppAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsAppAccount" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "client_status" TEXT NOT NULL DEFAULT 'DISCONNECTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "name" TEXT,
    "description" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "api_key" TEXT,
    "status" TEXT DEFAULT 'ACTIVE',
    "connectionState" TEXT DEFAULT 'disconnected',
    "lastConnectionUpdate" TIMESTAMP(3),
    "lastError" TEXT,
    "isAuthenticated" BOOLEAN NOT NULL DEFAULT false,
    "lastAuthenticated" TIMESTAMP(3),
    "accountId" TEXT,

    CONSTRAINT "WhatsAppAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsAppAuthData" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "file" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsAppAuthData_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Device" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "accountId" TEXT,
    "companyId" TEXT,
    "deviceType" TEXT,
    "model" TEXT,
    "manufacturer" TEXT,
    "osVersion" TEXT,
    "firmwareVersion" TEXT,
    "hardwareId" TEXT,
    "wifiMac" TEXT,
    "lanMac" TEXT,
    "ipAddress" TEXT,
    "apiKey" TEXT,
    "apiKeyCreatedAt" TIMESTAMP(3),
    "apiKeyRotatedAt" TIMESTAMP(3),
    "claimedAt" TIMESTAMP(3),
    "claimedBy" TEXT,
    "connected" BOOLEAN NOT NULL DEFAULT false,
    "connectedAt" TIMESTAMP(3),
    "disconnectedAt" TIMESTAMP(3),

    CONSTRAINT "Device_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Setting" (
    "id" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "data" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedBy" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailServiceProvider" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "fromEmail" TEXT NOT NULL,
    "fromName" TEXT,
    "smtpHost" TEXT,
    "smtpPort" INTEGER,
    "smtpUser" TEXT,
    "smtpPass" TEXT,
    "smtpSecure" BOOLEAN NOT NULL DEFAULT true,
    "smtpAuth" BOOLEAN NOT NULL DEFAULT true,
    "apiKey" TEXT,
    "apiSecret" TEXT,
    "domain" TEXT,
    "region" TEXT,
    "webhookUrl" TEXT,
    "webhookKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,
    "updatedBy" TEXT NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "totalSent" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "EmailServiceProvider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvitationToken" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvitationToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Resource" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL,
    "target" TEXT NOT NULL DEFAULT 'user',
    "version" TEXT DEFAULT '1.0.0',
    "format" TEXT,
    "packageName" TEXT,
    "path" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT NOT NULL,
    "updatedBy" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,

    CONSTRAINT "Resource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JwtSigningKey" (
    "id" TEXT NOT NULL,
    "keyId" TEXT NOT NULL,
    "keyType" TEXT NOT NULL,
    "privateKey" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "algorithm" TEXT NOT NULL DEFAULT 'RS256',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "rotatedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JwtSigningKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FactoryToken" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "hardwareModel" TEXT NOT NULL,
    "firmwareVersion" TEXT NOT NULL,
    "batchNumber" TEXT,
    "isUsed" BOOLEAN NOT NULL DEFAULT false,
    "usedAt" TIMESTAMP(3),
    "usedByIp" TEXT,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "issuedBy" TEXT NOT NULL,
    "notes" TEXT,
    "factory_signing_key_id" TEXT NOT NULL,
    "deviceId" TEXT,

    CONSTRAINT "FactoryToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "deviceId" TEXT,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "accountId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "isRevoked" BOOLEAN NOT NULL DEFAULT false,
    "revokedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TokenUsageLog" (
    "id" TEXT NOT NULL,
    "tokenId" TEXT,
    "tokenType" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "accountId" TEXT,
    "userId" TEXT,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "error" TEXT,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TokenUsageLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FailedLoginLog" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "reason" TEXT NOT NULL,
    "attemptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "accountId" TEXT,

    CONSTRAINT "FailedLoginLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSessionLog" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "sessionId" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "deviceInfo" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "accountId" TEXT,

    CONSTRAINT "UserSessionLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bundle" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "os" TEXT NOT NULL,
    "reboot" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "cancelAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "updatedBy" TEXT NOT NULL,
    "accountId" TEXT,
    "waveSize" INTEGER NOT NULL DEFAULT 500,
    "scheduledAt" TIMESTAMP(3),
    "scheduledAtTimezone" TEXT,
    "scheduledAtStartIfMissed" BOOLEAN NOT NULL DEFAULT false,
    "updateStrategy" TEXT DEFAULT 'IMMEDIATE',

    CONSTRAINT "Bundle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BundleApp" (
    "id" TEXT NOT NULL,
    "bundleId" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "autoOpen" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT NOT NULL,
    "updatedBy" TEXT NOT NULL,

    CONSTRAINT "BundleApp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BundleDevice" (
    "id" TEXT NOT NULL,
    "bundleId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT NOT NULL,
    "updatedBy" TEXT NOT NULL,

    CONSTRAINT "BundleDevice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BundleDeviceProgress" (
    "id" TEXT NOT NULL,
    "bundleId" TEXT NOT NULL,
    "waveId" TEXT NOT NULL,
    "bundleDeviceId" TEXT NOT NULL,
    "transactionId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "result" TEXT,
    "errorDetails" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT NOT NULL,
    "updatedBy" TEXT NOT NULL,

    CONSTRAINT "BundleDeviceProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BundleWave" (
    "id" TEXT NOT NULL,
    "bundleId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "maxDevices" INTEGER NOT NULL DEFAULT 500,
    "startTime" TIMESTAMP(3),
    "endTime" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT NOT NULL,
    "updatedBy" TEXT NOT NULL,

    CONSTRAINT "BundleWave_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Account_slug_key" ON "Account"("slug");

-- CreateIndex
CREATE INDEX "Account_slug_idx" ON "Account"("slug");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "Company_accountId_idx" ON "Company"("accountId");

-- CreateIndex
CREATE INDEX "AccountMembership_userId_idx" ON "AccountMembership"("userId");

-- CreateIndex
CREATE INDEX "AccountMembership_accountId_idx" ON "AccountMembership"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "AccountMembership_userId_accountId_key" ON "AccountMembership"("userId", "accountId");

-- CreateIndex
CREATE INDEX "Group_accountId_idx" ON "Group"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "Group_accountId_name_key" ON "Group"("accountId", "name");

-- CreateIndex
CREATE INDEX "GroupMembership_groupId_idx" ON "GroupMembership"("groupId");

-- CreateIndex
CREATE INDEX "GroupMembership_membershipId_idx" ON "GroupMembership"("membershipId");

-- CreateIndex
CREATE UNIQUE INDEX "GroupMembership_groupId_membershipId_key" ON "GroupMembership"("groupId", "membershipId");

-- CreateIndex
CREATE INDEX "Permission_groupId_idx" ON "Permission"("groupId");

-- CreateIndex
CREATE INDEX "Permission_module_action_idx" ON "Permission"("module", "action");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_groupId_module_action_key" ON "Permission"("groupId", "module", "action");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_primaryAccountId_idx" ON "User"("primaryAccountId");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Key_user_id_idx" ON "Key"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "ApiKey_key_key" ON "ApiKey"("key");

-- CreateIndex
CREATE INDEX "ApiKey_userId_idx" ON "ApiKey"("userId");

-- CreateIndex
CREATE INDEX "ApiKey_key_idx" ON "ApiKey"("key");

-- CreateIndex
CREATE INDEX "ApiKey_accountId_idx" ON "ApiKey"("accountId");

-- CreateIndex
CREATE INDEX "WebhookEndPoint_name_idx" ON "WebhookEndPoint"("name");

-- CreateIndex
CREATE INDEX "WebhookEndPoint_description_idx" ON "WebhookEndPoint"("description");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookHourlyMetric_webhookId_hourOfDay_key" ON "WebhookHourlyMetric"("webhookId", "hourOfDay");

-- CreateIndex
CREATE INDEX "ListenerEndpoint_userId_idx" ON "ListenerEndpoint"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ListenerWebhookEndpoint_listenerId_webhookEndpointId_key" ON "ListenerWebhookEndpoint"("listenerId", "webhookEndpointId");

-- CreateIndex
CREATE UNIQUE INDEX "ListenerWhatsAppAccount_listenerId_whatsappAccountId_key" ON "ListenerWhatsAppAccount"("listenerId", "whatsappAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppAccount_client_id_key" ON "WhatsAppAccount"("client_id");

-- CreateIndex
CREATE INDEX "WhatsAppAccount_createdBy_idx" ON "WhatsAppAccount"("createdBy");

-- CreateIndex
CREATE INDEX "WhatsAppAccount_accountId_idx" ON "WhatsAppAccount"("accountId");

-- CreateIndex
CREATE INDEX "WhatsAppAuthData_clientId_idx" ON "WhatsAppAuthData"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppAuthData_clientId_file_key" ON "WhatsAppAuthData"("clientId", "file");

-- CreateIndex
CREATE UNIQUE INDEX "Device_apiKey_key" ON "Device"("apiKey");

-- CreateIndex
CREATE INDEX "Device_createdBy_idx" ON "Device"("createdBy");

-- CreateIndex
CREATE INDEX "Device_hardwareId_idx" ON "Device"("hardwareId");

-- CreateIndex
CREATE INDEX "Device_status_idx" ON "Device"("status");

-- CreateIndex
CREATE INDEX "Device_accountId_idx" ON "Device"("accountId");

-- CreateIndex
CREATE INDEX "Device_companyId_idx" ON "Device"("companyId");

-- CreateIndex
CREATE INDEX "Setting_isActive_idx" ON "Setting"("isActive");

-- CreateIndex
CREATE INDEX "EmailServiceProvider_isActive_idx" ON "EmailServiceProvider"("isActive");

-- CreateIndex
CREATE INDEX "EmailServiceProvider_isDefault_idx" ON "EmailServiceProvider"("isDefault");

-- CreateIndex
CREATE INDEX "EmailServiceProvider_type_idx" ON "EmailServiceProvider"("type");

-- CreateIndex
CREATE UNIQUE INDEX "InvitationToken_token_key" ON "InvitationToken"("token");

-- CreateIndex
CREATE INDEX "Resource_name_idx" ON "Resource"("name");

-- CreateIndex
CREATE INDEX "Resource_type_idx" ON "Resource"("type");

-- CreateIndex
CREATE INDEX "Resource_createdBy_idx" ON "Resource"("createdBy");

-- CreateIndex
CREATE INDEX "JwtSigningKey_keyType_isActive_idx" ON "JwtSigningKey"("keyType", "isActive");

-- CreateIndex
CREATE INDEX "JwtSigningKey_expiresAt_idx" ON "JwtSigningKey"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "unique_key_id_per_type" ON "JwtSigningKey"("keyType", "keyId");

-- CreateIndex
CREATE INDEX "FactoryToken_isUsed_idx" ON "FactoryToken"("isUsed");

-- CreateIndex
CREATE INDEX "FactoryToken_expiresAt_idx" ON "FactoryToken"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");

-- CreateIndex
CREATE INDEX "RefreshToken_accountId_idx" ON "RefreshToken"("accountId");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");

-- CreateIndex
CREATE INDEX "RefreshToken_expiresAt_idx" ON "RefreshToken"("expiresAt");

-- CreateIndex
CREATE INDEX "RefreshToken_isRevoked_idx" ON "RefreshToken"("isRevoked");

-- CreateIndex
CREATE INDEX "TokenUsageLog_accountId_idx" ON "TokenUsageLog"("accountId");

-- CreateIndex
CREATE INDEX "TokenUsageLog_userId_idx" ON "TokenUsageLog"("userId");

-- CreateIndex
CREATE INDEX "TokenUsageLog_tokenId_idx" ON "TokenUsageLog"("tokenId");

-- CreateIndex
CREATE INDEX "TokenUsageLog_createdAt_idx" ON "TokenUsageLog"("createdAt");

-- CreateIndex
CREATE INDEX "FailedLoginLog_email_idx" ON "FailedLoginLog"("email");

-- CreateIndex
CREATE INDEX "FailedLoginLog_ipAddress_idx" ON "FailedLoginLog"("ipAddress");

-- CreateIndex
CREATE INDEX "FailedLoginLog_attemptedAt_idx" ON "FailedLoginLog"("attemptedAt");

-- CreateIndex
CREATE INDEX "FailedLoginLog_accountId_idx" ON "FailedLoginLog"("accountId");

-- CreateIndex
CREATE INDEX "UserSessionLog_userId_idx" ON "UserSessionLog"("userId");

-- CreateIndex
CREATE INDEX "UserSessionLog_action_idx" ON "UserSessionLog"("action");

-- CreateIndex
CREATE INDEX "UserSessionLog_timestamp_idx" ON "UserSessionLog"("timestamp");

-- CreateIndex
CREATE INDEX "UserSessionLog_sessionId_idx" ON "UserSessionLog"("sessionId");

-- CreateIndex
CREATE INDEX "UserSessionLog_accountId_idx" ON "UserSessionLog"("accountId");

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
CREATE INDEX "BundleDevice_bundleId_idx" ON "BundleDevice"("bundleId");

-- CreateIndex
CREATE INDEX "BundleDevice_deviceId_idx" ON "BundleDevice"("deviceId");

-- CreateIndex
CREATE INDEX "BundleDevice_status_idx" ON "BundleDevice"("status");

-- CreateIndex
CREATE UNIQUE INDEX "BundleDevice_bundleId_deviceId_key" ON "BundleDevice"("bundleId", "deviceId");

-- CreateIndex
CREATE INDEX "BundleDeviceProgress_bundleId_idx" ON "BundleDeviceProgress"("bundleId");

-- CreateIndex
CREATE INDEX "BundleDeviceProgress_waveId_idx" ON "BundleDeviceProgress"("waveId");

-- CreateIndex
CREATE INDEX "BundleDeviceProgress_bundleDeviceId_idx" ON "BundleDeviceProgress"("bundleDeviceId");

-- CreateIndex
CREATE INDEX "BundleDeviceProgress_status_idx" ON "BundleDeviceProgress"("status");

-- CreateIndex
CREATE INDEX "BundleDeviceProgress_createdAt_idx" ON "BundleDeviceProgress"("createdAt");

-- CreateIndex
CREATE INDEX "BundleWave_bundleId_idx" ON "BundleWave"("bundleId");

-- CreateIndex
CREATE INDEX "BundleWave_status_idx" ON "BundleWave"("status");

-- AddForeignKey
ALTER TABLE "Company" ADD CONSTRAINT "Company_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountMembership" ADD CONSTRAINT "AccountMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountMembership" ADD CONSTRAINT "AccountMembership_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Group" ADD CONSTRAINT "Group_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupMembership" ADD CONSTRAINT "GroupMembership_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupMembership" ADD CONSTRAINT "GroupMembership_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "AccountMembership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Permission" ADD CONSTRAINT "Permission_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_primaryAccountId_fkey" FOREIGN KEY ("primaryAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Key" ADD CONSTRAINT "Key_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookHourlyMetric" ADD CONSTRAINT "WebhookHourlyMetric_webhookId_fkey" FOREIGN KEY ("webhookId") REFERENCES "WebhookEndPoint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListenerEndpoint" ADD CONSTRAINT "ListenerEndpoint_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListenerWebhookEndpoint" ADD CONSTRAINT "ListenerWebhookEndpoint_listenerId_fkey" FOREIGN KEY ("listenerId") REFERENCES "ListenerEndpoint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListenerWebhookEndpoint" ADD CONSTRAINT "ListenerWebhookEndpoint_webhookEndpointId_fkey" FOREIGN KEY ("webhookEndpointId") REFERENCES "WebhookEndPoint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListenerWhatsAppAccount" ADD CONSTRAINT "ListenerWhatsAppAccount_listenerId_fkey" FOREIGN KEY ("listenerId") REFERENCES "ListenerEndpoint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListenerWhatsAppAccount" ADD CONSTRAINT "ListenerWhatsAppAccount_whatsappAccountId_fkey" FOREIGN KEY ("whatsappAccountId") REFERENCES "WhatsAppAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppAccount" ADD CONSTRAINT "WhatsAppAccount_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppAccount" ADD CONSTRAINT "WhatsAppAccount_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Device" ADD CONSTRAINT "Device_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Device" ADD CONSTRAINT "Device_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Device" ADD CONSTRAINT "Device_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvitationToken" ADD CONSTRAINT "InvitationToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Resource" ADD CONSTRAINT "Resource_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JwtSigningKey" ADD CONSTRAINT "JwtSigningKey_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FactoryToken" ADD CONSTRAINT "FactoryToken_factory_signing_key_id_fkey" FOREIGN KEY ("factory_signing_key_id") REFERENCES "JwtSigningKey"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FactoryToken" ADD CONSTRAINT "FactoryToken_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TokenUsageLog" ADD CONSTRAINT "TokenUsageLog_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TokenUsageLog" ADD CONSTRAINT "TokenUsageLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BundleApp" ADD CONSTRAINT "BundleApp_bundleId_fkey" FOREIGN KEY ("bundleId") REFERENCES "Bundle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BundleApp" ADD CONSTRAINT "BundleApp_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BundleDevice" ADD CONSTRAINT "BundleDevice_bundleId_fkey" FOREIGN KEY ("bundleId") REFERENCES "Bundle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BundleDeviceProgress" ADD CONSTRAINT "BundleDeviceProgress_bundleId_fkey" FOREIGN KEY ("bundleId") REFERENCES "Bundle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BundleDeviceProgress" ADD CONSTRAINT "BundleDeviceProgress_waveId_fkey" FOREIGN KEY ("waveId") REFERENCES "BundleWave"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BundleDeviceProgress" ADD CONSTRAINT "BundleDeviceProgress_bundleDeviceId_fkey" FOREIGN KEY ("bundleDeviceId") REFERENCES "BundleDevice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BundleWave" ADD CONSTRAINT "BundleWave_bundleId_fkey" FOREIGN KEY ("bundleId") REFERENCES "Bundle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
