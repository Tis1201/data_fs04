CREATE TABLE device_apps
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
)
ENGINE = ReplacingMergeTree
ORDER BY (device_id, created_at, package_name)
SETTINGS index_granularity = 8192
