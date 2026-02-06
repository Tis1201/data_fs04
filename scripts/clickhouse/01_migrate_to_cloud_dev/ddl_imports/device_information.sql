CREATE TABLE device_information
(
    `last_connected_at` Nullable(DateTime64(3, 'UTC')),
    `last_status_at` Nullable(DateTime64(3, 'UTC')),
    `os_version` LowCardinality(String),
    `system_uptime_seconds` Nullable(UInt32),
    `cpu_usage` Nullable(Float32),
    `ram_usage` Nullable(Float32),
    `disk_usage` Nullable(Float32),
    `firmware` LowCardinality(String),
    `model` LowCardinality(String),
    `network_interface` LowCardinality(String),
    `wifi_ssid` Nullable(String),
    `signal_strength_dbm` Nullable(Int16),
    `mac_wifi` Nullable(String),
    `mac_lan` String,
    `orientation` LowCardinality(String),
    `resolution` LowCardinality(String),
    `timezone` LowCardinality(String),
    `public_ip` LowCardinality(String),
    `private_ip` LowCardinality(String),
    `created_at` DateTime64(3, 'UTC') DEFAULT now64(3)
)
ENGINE = ReplicatedMergeTree
ORDER BY (mac_lan, created_at)
SETTINGS index_granularity = 8192
