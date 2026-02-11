CREATE TABLE device
(
    `device_id` UUID DEFAULT generateUUIDv4(),
    `device_name` String,
    `device_type` String,
    `serial_number` String,
    `mac_address` String,
    `ip_address` IPv4,
    `last_seen` DateTime,
    `status` Enum8('error' = -1, 'offline' = 0, 'online' = 1),
    `location` String,
    `firmware_version` String,
    `tags` Array(String),
    `created_at` DateTime DEFAULT now(),
    `updated_at` DateTime DEFAULT now()
)
ENGINE = ReplicatedMergeTree
PRIMARY KEY device_id
ORDER BY device_id
SETTINGS index_granularity = 8192
