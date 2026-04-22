-- CreateIndex
CREATE INDEX "DeviceActionLog_deviceId_status_initiatedAt_idx" ON "DeviceActionLog"("deviceId", "status", "initiatedAt");

-- CreateIndex
CREATE INDEX "DeviceActionLog_status_initiatedAt_idx" ON "DeviceActionLog"("status", "initiatedAt");

-- CreateIndex
CREATE INDEX "DeviceActionLog_actionType_status_initiatedAt_idx" ON "DeviceActionLog"("actionType", "status", "initiatedAt");

-- CreateIndex
CREATE INDEX "DeviceActionLog_initiatedBy_initiatedAt_idx" ON "DeviceActionLog"("initiatedBy", "initiatedAt");
