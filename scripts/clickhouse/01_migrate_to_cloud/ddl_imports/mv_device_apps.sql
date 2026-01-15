CREATE MATERIALIZED VIEW mv_device_apps TO device_apps
(
    `device_id` String,
    `package_name` String,
    `app_name` String,
    `version` String,
    `app_type` String,
    `metadata` String,
    `created_at` DateTime,
    `last_modified` DateTime,
    `size_bytes` String
) AS
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
WHERE c10 = 'DEVICE_APPS'
ORDER BY (device_id, created_at, package_name) ASC
