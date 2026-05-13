CREATE TABLE device_apps
(
    `device_id` String,
    `package_name` String,
    `app_name` LowCardinality(String),
    `version` LowCardinality(String),
    `app_type` LowCardinality(String),
    `metadata` String,
    `created_at` DateTime64(3, 'UTC') DEFAULT now64(3),
    `last_modified` Nullable(DateTime64(3, 'UTC')) DEFAULT now64(3),
    `size_bytes` Nullable(String)
)
ENGINE = ReplicatedMergeTree
ORDER BY (created_at, device_id, package_name)
SETTINGS index_granularity = 8192
