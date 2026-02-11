CREATE TABLE bundle_logs
(
    `device_id` String,
    `wave_id` String,
    `bundle_id` String,
    `status` String,
    `progress` String,
    `message` String,
    `ts` DateTime64(3, 'UTC'),
    `type` String
)
ENGINE = MergeTree
ORDER BY (device_id, ts)
SETTINGS index_granularity = 8192
