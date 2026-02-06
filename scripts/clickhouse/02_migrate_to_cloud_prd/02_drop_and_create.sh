#!/bin/bash
# ============================================================================
# Step 2: Drop and Create
# ============================================================================
# Drops the target database (if exists) and recreates it.
# Then imports all DDLs from the ddl_imports/ directory in the correct order.
# ============================================================================

set -euo pipefail

# ============================================================================
# CONFIGURATION
# ============================================================================

# Target (ClickHouse Cloud)
TARGET_URL="${CLICKHOUSE_COM_URL:-https://dg7m1hwwez.us-central1.gcp.clickhouse.cloud:8443}"
TARGET_USER="${CLICKHOUSE_COM_USER_NAME:-fs04_prd}"
TARGET_PASS="${CLICKHOUSE_COM_PASSWORD:-Admin0823Prd!}"
TARGET_DATABASE="${CLICKHOUSE_COM_DATABASE:-fs_04_prd}"

DDL_DIR="ddl_imports"

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

# Run query against root (no specific DB, or default DB)
target_root_query() {
    curl -sf -u "${TARGET_USER}:${TARGET_PASS}" "${TARGET_URL}/" --data "$1" 2>/dev/null
}

# Run query with database context
target_db_query() {
    curl -sf -u "${TARGET_USER}:${TARGET_PASS}" "${TARGET_URL}/?database=${TARGET_DATABASE}" --data "$1" 2>/dev/null
}

# Run DDL from file against target database
target_ddl() {
    local file="$1"
    # We use param ?database=... to ensure DDLs without qualification are created in right DB
    local out
    # Remove -f so we can capture the error message body. Use -sS to show curl errors but capture output.
    out=$(curl -sS -u "${TARGET_USER}:${TARGET_PASS}" "${TARGET_URL}/?database=${TARGET_DATABASE}" --data-binary "@${file}" 2>&1)
    
    # Check for curl errors or CH exceptions
    # ClickHouse usually returns "Code: X. DB::Exception: ..." on error.
    if [[ "$out" == *"Exception"* ]] || [[ "$out" == *"Code:"* ]]; then
        # Check if "already exists" (though we drop DB, so unlikely unless dupes)
        if [[ "$out" == *"already exists"* ]]; then
             log "   ⚠️  Already exists: $out"
        else
             err "   Failed to execute DDL in $(basename "$file")"
             err "   Response: $out"
             return 1
        fi
    fi
    return 0
}

# ============================================================================
# MAIN
# ============================================================================

main() {
    log "Starting Drop and Create..."
    log "Target: ${TARGET_URL}"
    log "Database: ${TARGET_DATABASE}"
    echo ""

    # 1. Connection Check
    if ! target_root_query "SELECT 1" >/dev/null 2>&1; then
        err "Cannot connect to target ClickHouse"
        exit 1
    fi
    ok "Target connection OK"

    # 2. Drop and Create Database
    log "Dropping database ${TARGET_DATABASE} if exists..."
    target_root_query "DROP DATABASE IF EXISTS ${TARGET_DATABASE} SYNC"
    ok "Dropped"

    log "Creating database ${TARGET_DATABASE}..."
    target_root_query "CREATE DATABASE ${TARGET_DATABASE}"
    ok "Created"
    
    if [[ ! -d "$DDL_DIR" ]]; then
        err "Directory $DDL_DIR not found. Run Step 1 first."
        exit 1
    fi

    # 3. Tables
    log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    log "Creating Tables..."
    # Find files containing "CREATE TABLE"
    # Using grep -l to list files. sort to ensure deterministic order.
    TABLES=$(grep -l "CREATE TABLE" "${DDL_DIR}"/*.sql | sort || true)
    
    for file in $TABLES; do
        [[ -z "$file" ]] && continue
        name=$(basename "$file" .sql)
        log "Creating TABLE: $name"
        target_ddl "$file"
    done

    # 4. Materialized Views
    log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    log "Creating Materialized Views..."
    MVS=$(grep -l "CREATE MATERIALIZED VIEW" "${DDL_DIR}"/*.sql | sort || true)
    
    for file in $MVS; do
        [[ -z "$file" ]] && continue
        name=$(basename "$file" .sql)
        log "Creating MV: $name"
        target_ddl "$file"
    done

    # 5. Views (excluding Materialized Views, just in case grep overlaps or we have View engine)
    log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    log "Creating Views..."
    # grep "CREATE VIEW" but exclude if it also says "MATERIALIZED" on the same line? 
    # Actually standard SQL is CREATE VIEW. CH uses CREATE VIEW for normal views.
    # But grep -l matches file if pattern exists.
    # We want files that have CREATE VIEW but NOT CREATE MATERIALIZED VIEW if possible, 
    # but simplest is to just list files that are "CREATE VIEW" and ensure they aren't in MVS list.
    
    ALL_VIEWS=$(grep -l "CREATE VIEW" "${DDL_DIR}"/*.sql | sort || true)
    
    for file in $ALL_VIEWS; do
        [[ -z "$file" ]] && continue
        # Check if it was already processed as MV (simple duplication check)
        is_mv=$(grep "CREATE MATERIALIZED VIEW" "$file" || true)
        if [[ -n "$is_mv" ]]; then
            continue
        fi
        
        name=$(basename "$file" .sql)
        log "Creating VIEW: $name"
        target_ddl "$file"
    done
    
    echo ""
    ok "Step 2 Complete: Schema created in ${TARGET_DATABASE}."
}

main "$@"
