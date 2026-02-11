CREATE MATERIALIZED VIEW mv_device_information TO device_information
(
    `last_connected_at` Nullable(DateTime64(3, 'UTC')),
    `last_status_at` Nullable(DateTime64(3, 'UTC')),
    `os_version` LowCardinality(String),
    `system_uptime_seconds` Nullable(UInt32),
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
    `cpu_usage` Nullable(Float32),
    `ram_usage` Nullable(Float32),
    `disk_usage` Nullable(Float32),
    `private_ip` LowCardinality(String),
    `created_at` DateTime64(3, 'UTC')
) AS
SELECT
    c1 AS last_connected_at,
    c1 AS last_status_at,
    c15 AS os_version,
    c16 AS firmware,
    c17 AS system_uptime_seconds,
    c18 AS signal_strength_dbm,
    c19 AS model,
    c20 AS network_interface,
    c21 AS wifi_ssid,
    c22 AS mac_wifi,
    c23 AS mac_lan,
    c24 AS orientation,
    c25 AS resolution,
    c14 AS timezone,
    c26 AS public_ip,
    c27 AS private_ip,
    c28 AS cpu_usage,
    c29 AS ram_usage,
    c30 AS disk_usage,
    c1 AS created_at
FROM logs_raw
WHERE c10 = 'DEVICE'
ORDER BY (mac_lan, created_at) ASC
