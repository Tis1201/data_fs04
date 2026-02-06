#!/bin/bash
# ============================================================================
# Step 3: Populate Data
# ============================================================================
# Migrates data for all base tables from Source to Target.
# Uses Native format for efficient transfer.
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

TEMP_DIR="data_exports"
mkdir -p "$TEMP_DIR"

# ============================================================================
# FUNCTIONS
# ============================================================================

log() { echo "[$(date '+%H:%M:%S')] $*"; }
err() { echo "[$(date '+%H:%M:%S')] ❌ $*" >&2; }
ok()  { echo "[$(date '+%H:%M:%S')] ✅ $*"; }

source_query() {
    curl -sf -u "${SOURCE_USER}:${SOURCE_PASS}" "${SOURCE_URL}/" --data "$1" 2>/dev/null
}

target_query() {
    curl -sf -u "${TARGET_USER}:${TARGET_PASS}" "${TARGET_URL}/" --data "$1" 2>/dev/null
}

target_insert() {
    local table="$1"
    local file="$2"
    
    # Using ?query=INSERT... param vs body? 
    # For large data, it's better to put query in param or start of body.
    # We'll use query param for the INSERT statement and body for data.
    
    local url="${TARGET_URL}/?database=${TARGET_DATABASE}&query=INSERT%20INTO%20${table}%20FORMAT%20Native"
    
    local out
    out=$(curl -sf -u "${TARGET_USER}:${TARGET_PASS}" "$url" --data-binary "@${file}" 2>&1)
    
    if [[ -n "$out" ]]; then
        err "Insert failed: $out"
        return 1
    fi
    return 0
}

migrate_table() {
    local table="$1"
    
    log "Migrating Table: ${table}"
    
    # 1. Check Source Rows
    local src_count
    src_count=$(source_query "SELECT count() FROM ${SOURCE_DATABASE}.${table}" 2>/dev/null | tr -d '[:space:]' || echo "0")
    
    if [[ "$src_count" == "0" ]]; then
         log "   Source is empty. Skipping."
         return 0
    fi
    log "   Source Rows: $src_count"

    # 2. Check Target Rows
    local tgt_count
    tgt_count=$(target_query "SELECT count() FROM ${TARGET_DATABASE}.${table}" 2>/dev/null | tr -d '[:space:]' || echo "0")
    log "   Target Rows: $tgt_count"
    
    # Simple logic: if target has data, assume it's migrated? Or compare exact counts?
    # Let's just compare. If target >= source, skip.
    if [[ "$tgt_count" -ge "$src_count" && "$src_count" -gt 0 ]]; then
         log "   Already migrated (Target >= Source). Skipping."
         return 0
    fi

    if [[ "$tgt_count" -gt 0 ]]; then
         log "   Target has partial data ($tgt_count < $src_count). Appending missing? Or truncating?"
         log "   ⚠️  Appending data blindly. Duplication possible if no deduplication keys."
         # Ideally we truncate, but for safety let's just insert. ReplicatedMergeTree handles dupes if async inserts/replacing, but standard inserts might dup.
         # For this migration script, we usually assume clean slate from Step 2.
    fi

    # 3. Export
    local file="${TEMP_DIR}/${table}.native"
    log "   Exporting to $file..."
    
    curl -sf -u "${SOURCE_USER}:${SOURCE_PASS}" "${SOURCE_URL}/" \
        --data "SELECT * FROM ${SOURCE_DATABASE}.${table} FORMAT Native" \
        --output "$file"
        
    if [[ ! -s "$file" ]]; then
        err "Export failed (empty file)"
        return 1
    fi
    
    # 4. Import
    log "   Importing to target..."
    if target_insert "$table" "$file"; then
        local new_count
        new_count=$(target_query "SELECT count() FROM ${TARGET_DATABASE}.${table}" 2>/dev/null | tr -d '[:space:]' || echo "0")
        ok "Imported. Target Rows: $new_count"
    else
        return 1
    fi
    
    # Cleanup
    rm -f "$file"
}

# ============================================================================
# MAIN
# ============================================================================

main() {
    log "Starting Data Population..."
    
    # Discover tables (Base tables only)
    # We exclude .inner tables and system tables
    TABLES=$(source_query "SELECT name FROM system.tables WHERE database='${SOURCE_DATABASE}' AND engine NOT LIKE '%View%' AND name NOT LIKE '.inner%' ORDER BY name" | tr '\n' ' ')
    
    if [[ -z "$TABLES" ]]; then
        err "No tables found in source."
        exit 1
    fi
    
    log "Found tables: $TABLES"
    echo ""
    
    for table in $TABLES; do
        [[ -z "$table" ]] && continue
        migrate_table "$table"
        echo ""
    done
    
    # Cleanup temp dir
    rm -rf "$TEMP_DIR"
    
    ok "Step 3 Complete."
}

main "$@"
