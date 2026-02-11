CREATE MATERIALIZED VIEW mv_bundle_logs TO bundle_logs
(
    `device_id` String,
    `wave_id` String,
    `bundle_id` String,
    `status` String,
    `progress` String,
    `message` String,
    `ts` DateTime64(3, 'UTC'),
    `type` String
) AS
SELECT
    toString(c4) AS device_id,
    toString(c15) AS wave_id,
    toString(c16) AS bundle_id,
    toString(c17) AS status,
    toString(c18) AS progress,
    toString(c19) AS message,
    c1 AS ts,
    toString(c10) AS type
FROM logs_raw
WHERE c10 = 'BUNDLE'
