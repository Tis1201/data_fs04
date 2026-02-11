#!/bin/bash
# ============================================================================
# Step 4: Verification
# ============================================================================
# Compares row counts between Source and Target for all Tables and Materialized Views.
# ============================================================================

set -euo pipefail

# ============================================================================
# CONFIGURATION
# ============================================================================

# Source
SOURCE_URL="${CLICKHOUSE_URL:-http://localhost:8123}"
SOURCE_USER="${CLICKHOUSE_USER_NAME:-admin}"
SOURCE_PASS="${CLICKHOUSE_PASSWORD:-admin0823}"
SOURCE_DATABASE="${CLICKHOUSE_DATABASE:-fs_04}"

# Target
TARGET_URL="${CLICKHOUSE_COM_URL:-https://dg7m1hwwez.us-central1.gcp.clickhouse.cloud:8443}"
TARGET_USER="${CLICKHOUSE_COM_USER_NAME:-fs04_admin}"
TARGET_PASS="${CLICKHOUSE_COM_PASSWORD:-Admin0823Admin!}"
TARGET_DATABASE="${CLICKHOUSE_COM_DATABASE:-fs_04_dev}"

# ============================================================================
# FUNCTIONS
# ============================================================================

log() { echo "[$(date '+%H:%M:%S')] $*"; }
error_log() { echo "❌ $*" >&2; }

source_query() {
    curl -sf -u "${SOURCE_USER}:${SOURCE_PASS}" "${SOURCE_URL}/" --data "$1" 2>/dev/null
}

target_query() {
    curl -sf -u "${TARGET_USER}:${TARGET_PASS}" "${TARGET_URL}/?database=${TARGET_DATABASE}" --data "$1" 2>/dev/null
}

check_table_counts() {
    local title="$1"
    local tables="$2" # Space separated list

    if [[ -z "$tables" ]]; then
        return
    fi

    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo " $title"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    printf "%-30s | %-12s | %-12s | %s\n" "TABLE/VIEW" "SOURCE" "TARGET" "STATUS"
    echo "-------------------------------+--------------+--------------+-------"

    for table in $tables; do
        # Get Source Count
        local src_res
        src_res=$(source_query "SELECT count() FROM ${SOURCE_DATABASE}.${table}" 2>/dev/null)
        local src_count=$(echo "$src_res" | tr -d '[:space:]')
        
        # Get Target Count
        local tgt_res
        tgt_res=$(target_query "SELECT count() FROM ${TARGET_DATABASE}.${table}" 2>/dev/null)
        local tgt_count=$(echo "$tgt_res" | tr -d '[:space:]')

        # Handle empty results (connection error or object missing)
        if [[ -z "$src_count" ]]; then src_count="ERR"; fi
        if [[ -z "$tgt_count" ]]; then tgt_count="ERR"; fi

        # Determine Status
        local status="✅"
        
        if [[ "$src_count" == "ERR" || "$tgt_count" == "ERR" ]]; then
            status="❌ Error"
        elif [[ "$tgt_count" -lt "$src_count" ]]; then
            # If target has FEWER rows, it's definitely an error (data loss)
            status="❌ Mismatch"
        elif [[ "$tgt_count" -gt "$src_count" ]]; then
             # If target has MORE rows, it might be OK (duplication or new data), but usually implies mismatch for migration validation
             status="⚠️  Target > Source"
        fi
        
        printf "%-30s | %12s | %12s | %s\n" "$table" "$src_count" "$tgt_count" "$status"
    done
}

# ============================================================================
# MAIN
# ============================================================================

main() {
    echo "Starting Verification..."
    echo "Source: ${SOURCE_DATABASE} (${SOURCE_URL})"
    echo "Target: ${TARGET_DATABASE} (${TARGET_URL})"
    
    # Discover Objects from Source
    # 1. Base Tables (excluding .inner, views, system tables)
    TABLES=$(source_query "SELECT name FROM system.tables WHERE database='${SOURCE_DATABASE}' AND engine NOT LIKE '%View%' AND name NOT LIKE '.inner%' ORDER BY name" | tr '\n' ' ')
    
    # 2. Materialized Views
    MVS=$(source_query "SELECT name FROM system.tables WHERE database='${SOURCE_DATABASE}' AND engine = 'MaterializedView' ORDER BY name" | tr '\n' ' ')
    
    # 3. Regular Views
    VIEWS=$(source_query "SELECT name FROM system.tables WHERE database='${SOURCE_DATABASE}' AND engine = 'View' ORDER BY name" | tr '\n' ' ')

    check_table_counts "📦 BASE TABLES" "$TABLES"
    
    check_table_counts "📊 MATERIALIZED VIEWS" "$MVS"
    
    # Views don't hold data themselves, but we can verify they exist and query them (usually count() on a view works if underlying table works)
    # Note: `count()` on a View executes the view query.
    if [[ -n "$VIEWS" ]]; then
        check_table_counts "👁️  VIEWS" "$VIEWS"
    fi

    echo ""
    echo "Verification Complete."
}

main "$@"
