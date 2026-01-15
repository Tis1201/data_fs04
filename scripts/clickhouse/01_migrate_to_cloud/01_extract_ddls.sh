#!/bin/bash
# ============================================================================
# Step 1: Extract DDLs
# ============================================================================
# Extracts DDL statements for all Tables, Materialized Views, and Views
# from the source ClickHouse instance and saves them to local .sql files.
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

# Output Directory
OUTPUT_DIR="ddl_imports"
mkdir -p "$OUTPUT_DIR"

# ============================================================================
# FUNCTIONS
# ============================================================================

log() { echo "[$(date '+%H:%M:%S')] $*"; }
err() { echo "[$(date '+%H:%M:%S')] ❌ $*" >&2; }
ok()  { echo "[$(date '+%H:%M:%S')] ✅ $*"; }

source_query() {
    curl -sf -u "${SOURCE_USER}:${SOURCE_PASS}" "${SOURCE_URL}/" --data "$1" 2>/dev/null
}

test_connection() {
    log "Testing source connection to ${SOURCE_URL}..."
    if ! source_query "SELECT 1" >/dev/null 2>&1; then
        err "Cannot connect to source ClickHouse"
        exit 1
    fi
    ok "Source connection OK"
}

get_ddl() {
    local object="$1"
    source_query "SHOW CREATE TABLE ${SOURCE_DATABASE}.${object} FORMAT TabSeparatedRaw"
}

# ============================================================================
# MAIN
# ============================================================================

main() {
    log "Starting DDL extraction from database: ${SOURCE_DATABASE}"
    test_connection
    
    # Discover objects
    log "Discovering objects..."
    
    # logical tables (excluding inner tables and views)
    TABLES=$(source_query "SELECT name FROM system.tables WHERE database='${SOURCE_DATABASE}' AND engine NOT LIKE '%View%' AND name NOT LIKE '.inner%' ORDER BY name" | tr '\n' ' ')
    
    # Materialized Views
    MATERIALIZED_VIEWS=$(source_query "SELECT name FROM system.tables WHERE database='${SOURCE_DATABASE}' AND engine = 'MaterializedView' ORDER BY name" | tr '\n' ' ')
    
    # Views
    VIEWS=$(source_query "SELECT name FROM system.tables WHERE database='${SOURCE_DATABASE}' AND engine = 'View' ORDER BY name" | tr '\n' ' ')
    
    log "Found Tables: ${TABLES:-none}"
    log "Found MVs: ${MATERIALIZED_VIEWS:-none}"
    log "Found Views: ${VIEWS:-none}"
    
    echo ""
    
    # Process Tables
    for table in $TABLES; do
        if [[ -z "$table" ]]; then continue; fi
        log "Exporting TABLE: $table"
        
        file="${OUTPUT_DIR}/${table}.sql"
        get_ddl "$table" > "$file"
        
        # Cleanups / Transformations
        # Convert MergeTree to ReplicatedMergeTree
        sed -i.bak 's/MergeTree/ReplicatedMergeTree/g' "$file"
        
        # Remove source database qualification (e.g. fs_04.) to make DDL portable
        sed -i.bak "s/${SOURCE_DATABASE}\.//g" "$file"

        # Specific fix for logs_raw: c6/c7 should be String, not UInt64
        if [[ "$table" == "logs_raw" ]]; then
            # Change c6 and c7 from UInt64 to String
            sed -i.bak 's/`c6` UInt64/`c6` String/g' "$file"
            sed -i.bak 's/`c7` UInt64/`c7` String/g' "$file"
            # Change c61 from Nullable(DateTime) to Nullable(String) to avoid empty string errors from Vector
            sed -i.bak 's/`c61` Nullable(DateTime)/`c61` Nullable(String)/g' "$file"
            log "   Applied fix for logs_raw (c6, c7 -> String)"
        fi
        
        rm "${file}.bak"
        
        ok "Saved to $file"
    done
    
    # Process Materialized Views
    for mv in $MATERIALIZED_VIEWS; do
        if [[ -z "$mv" ]]; then continue; fi
        log "Exporting MATERIALIZED VIEW: $mv"
        
        file="${OUTPUT_DIR}/${mv}.sql"
        get_ddl "$mv" > "$file"
        
        # Remove source database qualification
        sed -i.bak "s/${SOURCE_DATABASE}\.//g" "$file"

        # Convert MergeTree to ReplicatedMergeTree
        sed -i.bak 's/MergeTree/ReplicatedMergeTree/g' "$file"

        # Specific fix for mv_device_information if applicable
        if [[ "$mv" == "mv_device_information" ]]; then
             sed -i.bak '/AS device_id/d' "$file"
             sed -i.bak 's/ORDER BY (device_id, created_at)/ORDER BY (mac_lan, created_at)/g' "$file"
             rm "${file}.bak"
             log "   Applied fix for mv_device_information"
        fi
        
        # Ensure cleanup happens even if the specific fix block wasn't entered
        rm -f "${file}.bak"
        
        ok "Saved to $file"
    done
    
    # Process Views
    for view in $VIEWS; do
        if [[ -z "$view" ]]; then continue; fi
        log "Exporting VIEW: $view"
        
        file="${OUTPUT_DIR}/${view}.sql"
        get_ddl "$view" > "$file"

        # Remove source database qualification
        sed -i.bak "s/${SOURCE_DATABASE}\.//g" "$file"
        rm "${file}.bak"

        ok "Saved to $file"
    done
    
    echo ""
    ok "DDL Extraction Complete. Files are in ${OUTPUT_DIR}/"
}

main "$@"
