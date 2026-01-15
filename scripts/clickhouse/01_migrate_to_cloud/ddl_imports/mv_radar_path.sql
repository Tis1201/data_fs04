CREATE MATERIALIZED VIEW mv_radar_path
(
    `processed_at` DateTime,
    `account_id` String,
    `device_id` String,
    `log_creation_time` DateTime,
    `timezone_offset` Int16,
    `timezone_label` String,
    `sensor_id` String,
    `sensor_name` String,
    `mac_address` String,
    `target_id` String,
    `x_m` Float32,
    `y_m` Float32
)
ENGINE = ReplicatedMergeTree
ORDER BY (account_id, log_creation_time)
SETTINGS index_granularity = 8192 AS
SELECT
    c1 AS processed_at,
    c2 AS account_id,
    c4 AS device_id,
    parseDateTimeBestEffort(c12) AS log_creation_time,
    toInt16OrZero(c13) AS timezone_offset,
    c14 AS timezone_label,
    c15 AS sensor_id,
    c16 AS sensor_name,
    c17 AS mac_address,
    c18 AS target_id,
    toFloat32OrZero(c19) AS x_m,
    toFloat32OrZero(c20) AS y_m
FROM logs_raw
WHERE c10 = 'SENSOR_RADAR_PATH'
