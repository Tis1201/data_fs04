CREATE TABLE bundle_logs
(
    `device_id` String,
    `wave_id` String,
    `bundle_id` String,
    `status` LowCardinality(String),
    `progress` Int32,
    `message` String,
    `ts` DateTime64(3, 'UTC'),
    `type` LowCardinality(String),
    INDEX idx_bundle_id_set bundle_id TYPE set(0) GRANULARITY 2,
    INDEX idx_wave_id_set wave_id TYPE set(0) GRANULARITY 2,
    INDEX idx_status_type_set (status, type) TYPE set(0) GRANULARITY 2
)
ENGINE = ReplicatedMergeTree
ORDER BY (ts, device_id)
SETTINGS index_granularity = 8192
