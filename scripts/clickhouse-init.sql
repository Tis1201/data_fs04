-- ClickHouse initialization script for FS04
-- Run this after starting ClickHouse container

-- Create database
CREATE DATABASE IF NOT EXISTS fs04;

-- Use the database
USE fs04;

-- Create device_information table for storing device metrics
CREATE TABLE IF NOT EXISTS device_information (
    device_id String,
    mac_lan String,
    mac_wifi String,
    os_version String,
    firmware String,
    model String,
    network_interface String,
    wifi_ssid String,
    signal_strength_dbm Int32,
    public_ip String,
    private_ip String,
    cpu_usage Float64,
    ram_usage Float64,
    disk_usage Float64,
    system_uptime_seconds Int64,
    orientation String DEFAULT '',
    resolution String DEFAULT '',
    timezone String DEFAULT '',
    last_connected_at DateTime64(3) DEFAULT now(),
    last_status_at DateTime64(3) DEFAULT now(),
    created_at DateTime64(3) DEFAULT now()
) ENGINE = MergeTree()
ORDER BY (mac_lan, created_at)
TTL created_at + INTERVAL 30 DAY;

-- Create materialized view for latest device information (used by the app)
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_device_information
ENGINE = ReplacingMergeTree(created_at)
ORDER BY mac_lan
AS SELECT
    device_id,
    mac_lan,
    mac_wifi,
    os_version,
    firmware,
    model,
    network_interface,
    wifi_ssid,
    signal_strength_dbm,
    public_ip,
    private_ip,
    cpu_usage,
    ram_usage,
    disk_usage,
    system_uptime_seconds,
    orientation,
    resolution,
    timezone,
    last_connected_at,
    last_status_at,
    created_at
FROM device_information;

-- Create bundle_events table for deployment tracking
CREATE TABLE IF NOT EXISTS bundle_events (
    device_id String,
    wave_id String,
    bundle_id String,
    status String,
    progress Float64,
    message String,
    type String,
    ts DateTime64(3) DEFAULT now()
) ENGINE = MergeTree()
ORDER BY (bundle_id, device_id, ts)
TTL ts + INTERVAL 90 DAY;

-- =============================================================================
-- Device apps (logs_raw → mv_device_apps → table for GET /api/v2/devices/[id]/apps)
-- Same flow as production: device/app reports app list → logs_raw → MV → queryable table.
-- =============================================================================

-- Wide table for all log types; device app rows use c10 = 'DEVICE_APPS' and c4 = device_id, c15–c21 = app fields.
CREATE TABLE IF NOT EXISTS logs_raw (
    c1 DateTime,
    c2 String DEFAULT '',
    c3 String DEFAULT '',
    c4 String DEFAULT '',
    c5 String DEFAULT '',
    c6 String DEFAULT '',
    c7 String DEFAULT '',
    c8 String DEFAULT '',
    c9 String DEFAULT '',
    c10 String DEFAULT '',
    c11 String DEFAULT '',
    c12 String DEFAULT '',
    c13 String DEFAULT '',
    c14 String DEFAULT '',
    c15 String DEFAULT '',
    c16 String DEFAULT '',
    c17 String DEFAULT '',
    c18 String DEFAULT '',
    c19 String DEFAULT '',
    c20 String DEFAULT '',
    c21 String DEFAULT '',
    c22 String DEFAULT '',
    c23 String DEFAULT '',
    c24 String DEFAULT '',
    c25 String DEFAULT '',
    c26 String DEFAULT '',
    c27 String DEFAULT '',
    c28 String DEFAULT '',
    c29 String DEFAULT '',
    c30 String DEFAULT '',
    c31 String DEFAULT '',
    c32 String DEFAULT '',
    c33 String DEFAULT '',
    c34 String DEFAULT '',
    c35 String DEFAULT '',
    c36 String DEFAULT '',
    c37 String DEFAULT '',
    c38 String DEFAULT '',
    c39 String DEFAULT '',
    c40 String DEFAULT '',
    c41 String DEFAULT '',
    c42 String DEFAULT '',
    c43 String DEFAULT '',
    c44 String DEFAULT '',
    c45 String DEFAULT '',
    c46 String DEFAULT '',
    c47 String DEFAULT '',
    c48 String DEFAULT '',
    c49 String DEFAULT '',
    c50 String DEFAULT '',
    c51 String DEFAULT '',
    c52 String DEFAULT '',
    c53 String DEFAULT '',
    c54 String DEFAULT '',
    c55 String DEFAULT '',
    c56 String DEFAULT '',
    c57 String DEFAULT '',
    c58 String DEFAULT '',
    c59 String DEFAULT '',
    c60 String DEFAULT '',
    c61 Nullable(String) DEFAULT NULL
) ENGINE = MergeTree()
ORDER BY (toDate(c1), c2, c4)
SETTINGS index_granularity = 8192;

-- Target table for device apps (API queries this table; service uses name mv_device_apps in SQL, so we name table mv_device_apps for compatibility).
CREATE TABLE IF NOT EXISTS mv_device_apps (
    device_id String,
    package_name String,
    app_name String,
    version String,
    app_type String,
    metadata String,
    created_at DateTime,
    last_modified DateTime,
    size_bytes String
) ENGINE = MergeTree()
ORDER BY (created_at, device_id, package_name)
SETTINGS index_granularity = 8192;

-- Materialized view: on insert into logs_raw with c10='DEVICE_APPS', populate mv_device_apps (same column mapping as production).
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_device_apps_ingest TO mv_device_apps AS
SELECT
    c4 AS device_id,
    c15 AS package_name,
    c16 AS app_name,
    c17 AS version,
    c18 AS app_type,
    c19 AS metadata,
    c1 AS created_at,
    c1 AS last_modified,
    c21 AS size_bytes
FROM logs_raw
WHERE c10 = 'DEVICE_APPS';

-- Verify tables created
SHOW TABLES;
