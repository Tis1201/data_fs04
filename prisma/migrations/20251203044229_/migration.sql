-- CreateTable
CREATE TABLE "MqttConnection" (
    "clientId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'CONNECTED',
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "disconnectedAt" TIMESTAMP(3),
    "lastEventAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "node" TEXT,
    "reason" TEXT,

    CONSTRAINT "MqttConnection_pkey" PRIMARY KEY ("clientId")
);

-- CreateIndex
CREATE INDEX "MqttConnection_username_idx" ON "MqttConnection"("username");

-- CreateIndex
CREATE INDEX "MqttConnection_status_idx" ON "MqttConnection"("status");

-- CreateIndex
CREATE INDEX "MqttConnection_lastEventAt_idx" ON "MqttConnection"("lastEventAt");
