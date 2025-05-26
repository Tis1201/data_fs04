-- CreateTable
CREATE TABLE "UserSessionLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "action" TEXT NOT NULL,
    "sessionId" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "deviceInfo" TEXT,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "accountId" TEXT
);

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
