#!/bin/bash
# ============================================================================
# ClickHouse Cloud Migration Script - Complete Version
# ============================================================================
# Dynamically discovers and migrates:
#   - Database
#   - Tables (base tables)
#   - Materialized Views
#   - Views
#   - Data for all tables
#
# Usage:
#   ./migrate-clickhouse-to-cloud.sh          # Normal migration (skip existing)
#   ./migrate-clickhouse-to-cloud.sh --force  # Drop and recreate everything
# ============================================================================

set -euo pipefail

# ============================================================================
# CONFIGURATION
# ============================================================================

# Source
SOURCE_URL="${CLICKHOUSE_URL:-http://localhost:8123}"
SOURCE_USER="${CLICKHOUSE_USER_NAME:-admin}"
SOURCE_PASS="${CLICKHOUSE_PASSWORD:-admin0823}"

# Target  
TARGET_URL="${CLICKHOUSE_COM_URL:-https://dg7m1hwwez.us-central1.gcp.clickhouse.cloud:8443}"
TARGET_USER="${CLICKHOUSE_COM_USER_NAME:-fs04_admin}"
TARGET_PASS="${CLICKHOUSE_COM_PASSWORD:-Admin0823Admin!}"

# Databases (source and target can differ)
SOURCE_DATABASE="${CLICKHOUSE_DATABASE:-fs_04}"
TARGET_DATABASE="${CLICKHOUSE_COM_DATABASE:-${SOURCE_DATABASE}}"
TEMP_DIR="/tmp/ch_migration_$$"

# Parse args
FORCE_MODE=false
[[ "${1:-}" == "--force" ]] && FORCE_MODE=true

# ============================================================================
# FUNCTIONS
# ============================================================================

log() { echo "[$(date '+%H:%M:%S')] $*"; }
err() { echo "[$(date '+%H:%M:%S')] ❌ $*" >&2; }
ok()  { echo "[$(date '+%H:%M:%S')] ✅ $*"; }

mask() {
    local p="$1"
    [[ ${#p} -gt 4 ]] && echo "${p:0:2}***${p: -2}" || echo "****"
}

source_query() {
    curl -sf -u "${SOURCE_USER}:${SOURCE_PASS}" "${SOURCE_URL}/" --data "$1" 2>/dev/null
}

target_query() {
    curl -sf -u "${TARGET_USER}:${TARGET_PASS}" "${TARGET_URL}/" --data "$1" 2>/dev/null
}

target_ddl() {
    curl -sf -u "${TARGET_USER}:${TARGET_PASS}" "${TARGET_URL}/" --data-binary "@$1" 2>&1
}

target_insert() {
    local table="$1"
    local file="$2"
    curl -sf -u "${TARGET_USER}:${TARGET_PASS}" \
        "${TARGET_URL}/?query=INSERT%20INTO%20${TARGET_DATABASE}.${table}%20FORMAT%20Native" \
        --data-binary "@${file}" 2>&1
}

# ============================================================================
# DISCOVERY
# ============================================================================

discover_objects() {
    log "Discovering database objects in ${SOURCE_DATABASE}..."
    
    # Get all tables grouped by type (exclude .inner tables used by MVs)
    TABLES=$(source_query "SELECT name FROM system.tables WHERE database='${SOURCE_DATABASE}' AND engine NOT LIKE '%View%' AND name NOT LIKE '.inner%' ORDER BY name" | tr '\n' ' ')
    MATERIALIZED_VIEWS=$(source_query "SELECT name FROM system.tables WHERE database='${SOURCE_DATABASE}' AND engine = 'MaterializedView' ORDER BY name" | tr '\n' ' ')
    VIEWS=$(source_query "SELECT name FROM system.tables WHERE database='${SOURCE_DATABASE}' AND engine = 'View' ORDER BY name" | tr '\n' ' ')
    
    echo ""
    log "📋 Discovery Results:"
    log "   Tables: ${TABLES:-none}"
    log "   Materialized Views: ${MATERIALIZED_VIEWS:-none}"
    log "   Views: ${VIEWS:-none}"
    echo ""
}

# ============================================================================
# TEST CONNECTIONS
# ============================================================================

test_connections() {
    log "Testing connections..."
    log "   Source: ${SOURCE_URL} (user: ${SOURCE_USER}, pass: $(mask "$SOURCE_PASS"))"
    log "   Target: ${TARGET_URL} (user: ${TARGET_USER}, pass: $(mask "$TARGET_PASS"))"
    
    if ! source_query "SELECT 1" >/dev/null 2>&1; then
        err "Cannot connect to source ClickHouse"
        exit 1
    fi
    ok "Source connection OK"
    
    if ! target_query "SELECT 1" >/dev/null 2>&1; then
        err "Cannot connect to target ClickHouse Cloud"
        exit 1
    fi
    ok "Target connection OK"
}

# ============================================================================
# CREATE DATABASE
# ============================================================================

create_database() {
    if $FORCE_MODE; then
        log "Force mode: Dropping database ${TARGET_DATABASE}..."
        target_query "DROP DATABASE IF EXISTS ${TARGET_DATABASE}" >/dev/null 2>&1 || true
        ok "Database dropped"
    fi
    
    log "Creating database ${TARGET_DATABASE} on target..."
    target_query "CREATE DATABASE IF NOT EXISTS ${TARGET_DATABASE}" >/dev/null 2>&1 || true
    ok "Database ${TARGET_DATABASE} ready"
}

# ============================================================================
# SCHEMA MIGRATION
# ============================================================================

get_ddl() {
    local object="$1"
    source_query "SHOW CREATE TABLE ${SOURCE_DATABASE}.${object} FORMAT TabSeparatedRaw"
}

drop_object() {
    local object="$1"
    local object_type="$2"
    
    if [[ "$object_type" == "materialized view" ]]; then
        target_query "DROP VIEW IF EXISTS ${TARGET_DATABASE}.${object}" >/dev/null 2>&1 || true
    else
        target_query "DROP TABLE IF EXISTS ${TARGET_DATABASE}.${object}" >/dev/null 2>&1 || true
    fi
}

create_object() {
    local object="$1"
    local object_type="$2"  # table, mv, view
    
    log "Creating ${object_type}: ${TARGET_DATABASE}.${object}"
    
    # Force mode: drop first
    if $FORCE_MODE; then
        drop_object "$object" "$object_type"
        log "   Dropped existing (force mode)"
    else
        # Check if already exists
        local exists=$(target_query "SELECT count() FROM system.tables WHERE database='${TARGET_DATABASE}' AND name='${object}'" 2>/dev/null || echo "0")
        if [[ "$exists" == "1" ]]; then
            log "   Already exists, skipping"
            return 0
        fi
    fi
    
    # Get DDL
    local ddl_file="${TEMP_DIR}/${object}.sql"
    get_ddl "$object" > "$ddl_file"
    
    if [[ ! -s "$ddl_file" ]]; then
        err "   Failed to get DDL"
        return 1
    fi
    
    # Replace source database with target database in DDL
    if [[ "${SOURCE_DATABASE}" != "${TARGET_DATABASE}" ]]; then
        # Handle cases where DDL explicitly mentions source database
        sed -i.bak "s/${SOURCE_DATABASE}\./${TARGET_DATABASE}\./g" "$ddl_file"
    fi

    # Convert MergeTree to ReplicatedMergeTree for Cloud
    sed -i.bak 's/MergeTree/ReplicatedMergeTree/g' "$ddl_file"
    
    # Create on target
    local result=$(target_ddl "$ddl_file")
    
    if [[ "$result" == *"Exception"* && "$result" != *"already exists"* ]]; then
        err "   Failed: $result"
        return 1
    fi
    
    ok "   Created"
    return 0
}

migrate_schema() {
    log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    log "PHASE 1: Migrating Schema"
    log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    
    # 1. If force mode, drop MVs first (they depend on tables)
    if $FORCE_MODE && [[ -n "$MATERIALIZED_VIEWS" ]]; then
        log "🗑️ Dropping existing materialized views..."
        for mv in $MATERIALIZED_VIEWS; do
            drop_object "$mv" "materialized view"
            log "   Dropped $mv"
        done
        echo ""
    fi
    
    # 2. Create base tables
    log "📦 Creating base tables..."
    for table in $TABLES; do
        create_object "$table" "table" || true
    done
    echo ""
    
    # 3. Create materialized views (they depend on base tables)
    if [[ -n "$MATERIALIZED_VIEWS" ]]; then
        log "📊 Creating materialized views..."
        for mv in $MATERIALIZED_VIEWS; do
            create_object "$mv" "materialized view" || true
        done
        echo ""
    fi
    
    # 4. Create regular views
    if [[ -n "$VIEWS" ]]; then
        log "👁️ Creating views..."
        for view in $VIEWS; do
            create_object "$view" "view" || true
        done
        echo ""
    fi
}

# ============================================================================
# DATA MIGRATION
# ============================================================================

migrate_table_data() {
    local table="$1"
    
    log "Migrating data: ${SOURCE_DATABASE}.${table} -> ${TARGET_DATABASE}.${table}"
    
    # Get source row count
    local source_count=$(source_query "SELECT count() FROM ${SOURCE_DATABASE}.${table}" 2>/dev/null | tr -d '[:space:]')
    log "   Source rows: ${source_count:-0}"
    
    if [[ -z "$source_count" || "$source_count" == "0" ]]; then
        log "   No data to migrate"
        return 0
    fi
    
    # Get target row count (skip if already same, unless force mode)
    if ! $FORCE_MODE; then
        local target_before=$(target_query "SELECT count() FROM ${TARGET_DATABASE}.${table}" 2>/dev/null | tr -d '[:space:]' || echo "0")
        if [[ "$target_before" == "$source_count" ]]; then
            log "   Data already migrated (${target_before} rows)"
            return 0
        fi
    fi
    
    # Export data
    local data_file="${TEMP_DIR}/${table}.native"
    log "   Exporting..."
    
    curl -sf -u "${SOURCE_USER}:${SOURCE_PASS}" "${SOURCE_URL}/" \
        --data "SELECT * FROM ${SOURCE_DATABASE}.${table} FORMAT Native" \
        -o "$data_file"
    
    local file_size=$(ls -lh "$data_file" 2>/dev/null | awk '{print $5}')
    log "   Exported: ${file_size}"
    
    if [[ ! -s "$data_file" ]]; then
        err "   Failed to export"
        return 1
    fi
    
    # Import
    log "   Importing..."
    local result=$(target_insert "$table" "$data_file")
    
    if [[ "$result" == *"Exception"* ]]; then
        err "   Import failed: $result"
        return 1
    fi
    
    # Verify
    local target_after=$(target_query "SELECT count() FROM ${TARGET_DATABASE}.${table}" 2>/dev/null | tr -d '[:space:]' || echo "0")
    
    if [[ "$target_after" -ge "$source_count" ]]; then
        ok "   Done (${target_after} rows)"
    else
        err "   Mismatch: source=${source_count}, target=${target_after}"
        return 1
    fi
    
    rm -f "$data_file"
    return 0
}

migrate_data() {
    log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    log "PHASE 2: Migrating Data"
    log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    
    for table in $TABLES; do
        migrate_table_data "$table" || true
        echo ""
    done
}

# ============================================================================
# VERIFICATION
# ============================================================================

verify() {
    echo ""
    log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    log "PHASE 3: Verification"
    log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    
    # Tables
    echo "📦 TABLES"
    printf "   %-25s %12s %12s %s\n" "NAME" "SOURCE" "TARGET" ""
    echo "   ─────────────────────────────────────────────────────"
    
    for table in $TABLES; do
        local src=$(source_query "SELECT count() FROM ${SOURCE_DATABASE}.${table}" 2>/dev/null | tr -d '[:space:]' || echo "0")
        local tgt=$(target_query "SELECT count() FROM ${TARGET_DATABASE}.${table}" 2>/dev/null | tr -d '[:space:]' || echo "0")
        local status="✅"
        [[ "$tgt" -lt "$src" ]] && status="❌"
        printf "   %-25s %12s %12s %s\n" "$table" "$src" "$tgt" "$status"
    done
    echo ""
    
    # Materialized Views
    if [[ -n "$MATERIALIZED_VIEWS" ]]; then
        echo "📊 MATERIALIZED VIEWS"
        for mv in $MATERIALIZED_VIEWS; do
            local exists=$(target_query "SELECT count() FROM system.tables WHERE database='${TARGET_DATABASE}' AND name='${mv}'" 2>/dev/null || echo "0")
            local status="✅"
            [[ "$exists" != "1" ]] && status="❌"
            echo "   $mv $status"
        done
        echo ""
    fi
    
    # Views
    if [[ -n "$VIEWS" ]]; then
        echo "👁️ VIEWS"
        for view in $VIEWS; do
            local exists=$(target_query "SELECT count() FROM system.tables WHERE database='${TARGET_DATABASE}' AND name='${view}'" 2>/dev/null || echo "0")
            local status="✅"
            [[ "$exists" != "1" ]] && status="❌"
            echo "   $view $status"
        done
        echo ""
    fi
}

# ============================================================================
# MAIN
# ============================================================================

main() {
    echo ""
    echo "╔════════════════════════════════════════════════════════╗"
    echo "║     ClickHouse → ClickHouse Cloud Migration            ║"
    echo "║     Source DB: ${SOURCE_DATABASE}                              ║"
    echo "║     Target DB: ${TARGET_DATABASE}                              ║"
    $FORCE_MODE && echo "║     Mode: FORCE (drop and recreate)                    ║"
    echo "╚════════════════════════════════════════════════════════╝"
    echo ""
    
    # Setup
    mkdir -p "$TEMP_DIR"
    trap "rm -rf $TEMP_DIR" EXIT
    
    # Run
    test_connections
    echo ""
    
    discover_objects
    
    create_database
    echo ""
    
    migrate_schema
    
    migrate_data
    
    verify
    
    echo ""
    ok "Migration complete!"
    echo ""
    echo "Next steps:"
    echo "  1. Update your app's environment variables:"
    echo "     CLICKHOUSE_URL=${TARGET_URL}"
    echo "     CLICKHOUSE_USER_NAME=${TARGET_USER}"
    echo "     CLICKHOUSE_PASSWORD=<your_password>"
    echo "  2. Restart your application"
    echo ""
}

main "$@"
