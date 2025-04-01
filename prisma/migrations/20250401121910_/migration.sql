-- CreateTable
CREATE TABLE "ListenerEndpoint" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "postfix" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" DATETIME,
    "lastSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "listenToAll" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "ListenerEndpoint_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ListenerWebhookEndpoint" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "listenerId" TEXT NOT NULL,
    "webhookEndpointId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ListenerWebhookEndpoint_listenerId_fkey" FOREIGN KEY ("listenerId") REFERENCES "ListenerEndpoint" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ListenerWebhookEndpoint_webhookEndpointId_fkey" FOREIGN KEY ("webhookEndpointId") REFERENCES "WebhookEndPoint" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ListenerWhatsAppAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "listenerId" TEXT NOT NULL,
    "whatsappAccountId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ListenerWhatsAppAccount_listenerId_fkey" FOREIGN KEY ("listenerId") REFERENCES "ListenerEndpoint" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ListenerWhatsAppAccount_whatsappAccountId_fkey" FOREIGN KEY ("whatsappAccountId") REFERENCES "WhatsAppAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ListenerEndpoint_userId_idx" ON "ListenerEndpoint"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ListenerWebhookEndpoint_listenerId_webhookEndpointId_key" ON "ListenerWebhookEndpoint"("listenerId", "webhookEndpointId");

-- CreateIndex
CREATE UNIQUE INDEX "ListenerWhatsAppAccount_listenerId_whatsappAccountId_key" ON "ListenerWhatsAppAccount"("listenerId", "whatsappAccountId");
