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

-- Verify tables created
SHOW TABLES;
