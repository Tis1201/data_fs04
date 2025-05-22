-- CreateTable
CREATE TABLE "FailedLoginLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "reason" TEXT NOT NULL,
    "attemptedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "accountId" TEXT
);

-- CreateIndex
CREATE INDEX "FailedLoginLog_email_idx" ON "FailedLoginLog"("email");

-- CreateIndex
CREATE INDEX "FailedLoginLog_ipAddress_idx" ON "FailedLoginLog"("ipAddress");

-- CreateIndex
CREATE INDEX "FailedLoginLog_attemptedAt_idx" ON "FailedLoginLog"("attemptedAt");

-- CreateIndex
CREATE INDEX "FailedLoginLog_accountId_idx" ON "FailedLoginLog"("accountId");
