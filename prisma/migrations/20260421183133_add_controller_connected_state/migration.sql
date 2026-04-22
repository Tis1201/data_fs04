-- Per-controller MQTT bridge presence (independent from Device.connected).
-- The radar app on a device authenticates as the same MQTT user as the RDM agent
-- but holds its own session; we now track its online state separately so a radar
-- restart doesn't make the device look offline (and vice versa).

ALTER TABLE "Controller"
    ADD COLUMN "connected" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "connectedAt" TIMESTAMP(3),
    ADD COLUMN "disconnectedAt" TIMESTAMP(3);

CREATE INDEX "Controller_connected_idx" ON "Controller"("connected");
