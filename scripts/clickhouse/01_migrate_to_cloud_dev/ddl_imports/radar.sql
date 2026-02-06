CREATE TABLE radar
(
    `timestamp` DateTime,
    `sub` String,
    `account_id` String,
    `device_id` String,
    `col_01` String,
    `col_02` String,
    `col_03` String,
    `col_04` String,
    `created_at` DateTime DEFAULT now()
)
ENGINE = ReplicatedMergeTree
ORDER BY (timestamp, device_id)
SETTINGS index_granularity = 8192
