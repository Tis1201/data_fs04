#!/bin/bash
# ============================================================================
# Step 5: Query Materialized Views
# ============================================================================
# verification script that runs sample queries against the Target MVs
# to ensure data is accessible and correctly structured.
# ============================================================================

set -euo pipefail

# ============================================================================
# CONFIGURATION
# ============================================================================

# Target
TARGET_URL="${CLICKHOUSE_COM_URL:-https://dg7m1hwwez.us-central1.gcp.clickhouse.cloud:8443}"
TARGET_USER="${CLICKHOUSE_COM_USER_NAME:-fs04_admin}"
TARGET_PASS="${CLICKHOUSE_COM_PASSWORD:-Admin0823Admin!}"
TARGET_DATABASE="${CLICKHOUSE_COM_DATABASE:-fs_04_dev}"

# ============================================================================
# FUNCTIONS
# ============================================================================

log() { echo "[$(date '+%H:%M:%S')] $*"; }

target_query() {
    curl -sf -u "${TARGET_USER}:${TARGET_PASS}" "${TARGET_URL}/?database=${TARGET_DATABASE}" --data "$1" 2>/dev/null
}

check_mv() {
    local mv="$1"
    echo "---------------------------------------------------------"
    echo "🔎 Checking MV: ${mv}"
    echo "---------------------------------------------------------"
    
    # Check Count
    local count
    count=$(target_query "SELECT count() FROM ${mv}" | tr -d '[:space:]')
    echo "   Row Count: ${count}"
    
    # Check Max Time (if applicable column exists)
    # Most MVs have 'created_at' or 'processed_at' or 'log_creation_time'
    # We'll try to guess or just pick first likely timestamp column
    local time_col=""
    if [[ "$mv" == "mv_device_information" ]]; then
        time_col="created_at"
    elif [[ "$mv" == "mv_radar_path" ]] || [[ "$mv" == "mv_radar_session" ]]; then
        time_col="log_creation_time"
    elif [[ "$mv" == "mv_bundle_logs" ]]; then
        time_col="timestamp" 
    fi
    
    if [[ -n "$time_col" ]]; then
         local max_time
         # Use try/catch style by checking if we get an error
         max_time=$(target_query "SELECT max(${time_col}) FROM ${mv}" 2>/dev/null | tr -d '[:space:]' || echo "N/A")
         echo "   Max ${time_col}: ${max_time}"
    fi

    echo ""
    echo "   sample data (limit 3):"
    
    # Get 3 rows in TSVWithNames
    target_query "SELECT * FROM ${mv} LIMIT 3 FORMAT TSVWithNames" | sed 's/^/   /g'
    
    echo ""
}

# ============================================================================
# MAIN
# ============================================================================

main() {
    echo "Connecting to: ${TARGET_DATABASE} @ ${TARGET_URL}"
    echo ""
    
    # Get List of MVs
    MVS=$(target_query "SELECT name FROM system.tables WHERE database='${TARGET_DATABASE}' AND engine = 'MaterializedView' ORDER BY name" | tr '\n' ' ')
    
    if [[ -z "$MVS" ]]; then
        echo "❌ No Materialized Views found in ${TARGET_DATABASE}"
        exit 1
    fi
    
    for mv in $MVS; do
        [[ -z "$mv" ]] && continue
        check_mv "$mv"
    done
    
    echo "✅ Verification checks complete."
}

main "$@"
