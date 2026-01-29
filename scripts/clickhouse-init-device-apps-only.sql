-- Create device-apps tables only (logs_raw, mv_device_apps, mv_device_apps_ingest).
-- Run this if you already have ClickHouse but ran init before device-apps were added.
-- Usage: docker exec -i clickhouse-server clickhouse-client --password clickhouse123 < scripts/clickhouse-init-device-apps-only.sql

CREATE DATABASE IF NOT EXISTS fs04;
USE fs04;

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
