#!/bin/bash
# ============================================================================
# Step 7: Debug Curl Insert
# ============================================================================
# Tries to insert a single JSON row into Cloud ClickHouse logs_raw
# to reproduce the 400 error and see the full message.
# ============================================================================

TARGET_URL="${CLICKHOUSE_COM_URL:-https://dg7m1hwwez.us-central1.gcp.clickhouse.cloud:8443}"
TARGET_USER="${CLICKHOUSE_COM_USER_NAME:-fs04_admin}"
TARGET_PASS="${CLICKHOUSE_COM_PASSWORD:-Admin0823Admin!}"
TARGET_DATABASE="${CLICKHOUSE_COM_DATABASE:-fs_04_dev}"

echo "Attempting insert to ${TARGET_URL}..."

# Construct a minimal JSON payload resembling Vector's output
# Note: c1 is Datetime, c6/c7 are String (per our migration)
PAYLOAD=$(cat <<EOF
{
  "c1": "$(date '+%Y-%m-%d %H:%M:%S')",
  "c2": "test_account",
  "c3": "test_user",
  "c4": "test_device",
  "c5": "test_device_name",
  "c6": "1234567890",
  "c7": "1234567890",
  "c8": "aud",
  "c9": "iss",
  "c10": "test_value"
}
EOF
)

echo "Payload:"
echo "$PAYLOAD"
echo ""

curl -v -u "${TARGET_USER}:${TARGET_PASS}" \
  "${TARGET_URL}/?database=${TARGET_DATABASE}&query=INSERT+INTO+logs_raw+FORMAT+JSONEachRow" \
  --data "$PAYLOAD"
