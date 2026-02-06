CREATE TABLE device_information
(
    `device_id` String,
    `last_connected_at` DateTime64(3, 'UTC'),
    `last_status_at` DateTime64(3, 'UTC'),
    `os_version` LowCardinality(String),
    `firmware` LowCardinality(String),
    `system_uptime_seconds` Nullable(Int64),
    `signal_strength_dbm` Nullable(Int32),
    `model` LowCardinality(String),
    `network_interface` LowCardinality(String),
    `wifi_ssid` LowCardinality(String),
    `mac_wifi` String,
    `mac_lan` String,
    `orientation` LowCardinality(String),
    `resolution` LowCardinality(String),
    `timezone` LowCardinality(String),
    `public_ip` LowCardinality(String),
    `cpu_usage` Nullable(Float32),
    `ram_usage` Nullable(Float32),
    `disk_usage` Nullable(Float32),
    `private_ip` LowCardinality(String),
    `created_at` DateTime64(3, 'UTC')
)
ENGINE = ReplacingMergeTree
ORDER BY (device_id, created_at)
SETTINGS index_granularity = 8192
