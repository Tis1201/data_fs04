-- Idempotent restore for Controller MQTT bridge presence columns.
-- Covers: fresh DBs, DBs that already ran 20260421183133, and DBs where a mistaken
-- follow-up migration dropped these columns (same logical state as never migrated).

ALTER TABLE "Controller" ADD COLUMN IF NOT EXISTS "connected" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Controller" ADD COLUMN IF NOT EXISTS "connectedAt" TIMESTAMP(3);
ALTER TABLE "Controller" ADD COLUMN IF NOT EXISTS "disconnectedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Controller_connected_idx" ON "Controller"("connected");
