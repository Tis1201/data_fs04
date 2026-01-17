import 'dotenv/config';
import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { createClient, type ClickHouseClient } from '@clickhouse/client';
import { randomUUID } from 'crypto';

/**
 * End-to-end test for radar log Materialized Views and target tables.
 *
 * This test validates:
 * 1. Target table DDL (radar_session, radar_path)
 * 2. Materialized View DDL with type casting
 * 3. Data flow: logs_raw → MV → target table
 * 4. Correct type parsing (DateTime, Float32, Int16)
 *
 * Usage:
 *   npm test -- tests/integrations/logs/logs_radar_schema_e2e.test.ts
 */

describe('Logs Radar Schema E2E', () => {
    let client: ClickHouseClient;
    const testRunId = randomUUID().slice(0, 8);

    // Unique table names for this test run to avoid conflicts
    const sessionTable = `radar_session_test_${testRunId}`;
    const pathTable = `radar_path_test_${testRunId}`;
    const sessionMV = `mv_radar_session_test_${testRunId}`;
    const pathMV = `mv_radar_path_test_${testRunId}`;

    const testAccountId = `test-account-${testRunId}`;
    const testDeviceId = `test-device-${testRunId}`;

    beforeAll(async () => {
        const url = process.env.CLICKHOUSE_URL;
        const username = process.env.CLICKHOUSE_USER_NAME;
        const password = process.env.CLICKHOUSE_PASSWORD;
        
        if (!url || !username || !password) {
            throw new Error('ClickHouse configuration missing: CLICKHOUSE_URL, CLICKHOUSE_USER_NAME, and CLICKHOUSE_PASSWORD must be set');
        }
        

        const database = process.env.CLICKHOUSE_DATABASE;

        client = createClient({
            url,
            username,
            password,
            database
        });

        console.log(`[Schema E2E] Test run ID: ${testRunId}`);
        console.log(`[Schema E2E] Creating target tables and MVs...`);

        // Create target table for session data
        await client.command({
            query: `
                CREATE TABLE IF NOT EXISTS ${sessionTable} (
                    processed_at DateTime,
                    account_id String,
                    device_id String,
                    log_creation_time DateTime,
                    timezone_offset Int16,
                    timezone_label String,
                    sensor_id String,
                    sensor_name String,
                    mac_address String,
                    target_id String,
                    dwell_tracking_area_sec Float32,
                    zone_dwell_times_json String,
                    proximity_m Nullable(Float32)
                ) ENGINE = MergeTree()
                ORDER BY (account_id, log_creation_time)
            `
        });

        // Create target table for path data
        await client.command({
            query: `
                CREATE TABLE IF NOT EXISTS ${pathTable} (
                    processed_at DateTime,
                    account_id String,
                    device_id String,
                    log_creation_time DateTime,
                    timezone_offset Int16,
                    timezone_label String,
                    sensor_id String,
                    sensor_name String,
                    mac_address String,
                    target_id String,
                    x_m Float32,
                    y_m Float32
                ) ENGINE = MergeTree()
                ORDER BY (account_id, log_creation_time)
            `
        });

        // Create MV for session logs
        await client.command({
            query: `
                CREATE MATERIALIZED VIEW ${sessionMV} TO ${sessionTable} AS
                SELECT
                    c1 AS processed_at,
                    c2 AS account_id,
                    c4 AS device_id,
                    parseDateTimeBestEffort(c12) AS log_creation_time,
                    toInt16OrZero(c13) AS timezone_offset,
                    c14 AS timezone_label,
                    c15 AS sensor_id,
                    c16 AS sensor_name,
                    c17 AS mac_address,
                    c18 AS target_id,
                    toFloat32OrZero(c19) AS dwell_tracking_area_sec,
                    c20 AS zone_dwell_times_json,
                    toFloat32OrNull(c21) AS proximity_m
                FROM logs_raw
                WHERE c10 = 'SENSOR_RADAR_SESSION'
                  AND c2 = '${testAccountId}'
            `
        });

        // Create MV for path logs
        await client.command({
            query: `
                CREATE MATERIALIZED VIEW ${pathMV} TO ${pathTable} AS
                SELECT
                    c1 AS processed_at,
                    c2 AS account_id,
                    c4 AS device_id,
                    parseDateTimeBestEffort(c12) AS log_creation_time,
                    toInt16OrZero(c13) AS timezone_offset,
                    c14 AS timezone_label,
                    c15 AS sensor_id,
                    c16 AS sensor_name,
                    c17 AS mac_address,
                    c18 AS target_id,
                    toFloat32OrZero(c19) AS x_m,
                    toFloat32OrZero(c20) AS y_m
                FROM logs_raw
                WHERE c10 = 'SENSOR_RADAR_PATH'
                  AND c2 = '${testAccountId}'
            `
        });

        console.log(`[Schema E2E] ✅ Tables and MVs created`);
    });

    afterAll(async () => {
        // Cleanup: Drop MVs first, then tables
        console.log(`[Schema E2E] Cleaning up test tables and MVs...`);

        await client.command({ query: `DROP VIEW IF EXISTS ${sessionMV}` });
        await client.command({ query: `DROP VIEW IF EXISTS ${pathMV}` });
        await client.command({ query: `DROP TABLE IF EXISTS ${sessionTable}` });
        await client.command({ query: `DROP TABLE IF EXISTS ${pathTable}` });

        console.log(`[Schema E2E] ✅ Cleanup complete`);
        await client.close();
    });

    it('routes session data to target table with correct types', async () => {
        const now = new Date();
        const utcTimestamp = now.toISOString().replace('T', ' ').replace('Z', '').split('.')[0];
        const targetId = randomUUID();

        // Insert session log into logs_raw
        await client.insert({
            table: 'logs_raw',
            values: [{
                c1: utcTimestamp,
                c2: testAccountId,
                c3: 'test-user',
                c4: testDeviceId,
                c5: 'Test Device',
                c10: 'SENSOR_RADAR_SESSION',
                c11: '1.0',
                c12: utcTimestamp,
                c13: '480',
                c14: 'Asia/Singapore',
                c15: `sensor-${testRunId}`,
                c16: 'Test Radar',
                c17: '00:1A:2B:3C:4D:5E',
                c18: targetId,
                c19: '12.5',
                c20: '{"zone1":5.0}',
                c21: '0.85'
            }],
            format: 'JSONEachRow'
        });

        // Query from target table (MV should have routed it)
        const result = await client.query({
            query: `
                SELECT
                    account_id,
                    device_id,
                    log_creation_time,
                    timezone_offset,
                    sensor_id,
                    target_id,
                    dwell_tracking_area_sec,
                    zone_dwell_times_json,
                    proximity_m
                FROM ${sessionTable}
                WHERE target_id = {targetId:String}
            `,
            query_params: { targetId }
        });

        const data = await result.json();
        expect(data.data).toHaveLength(1);

        const row = data.data[0] as Record<string, unknown>;

        // Verify types are correct
        expect(row.account_id).toBe(testAccountId);
        expect(row.device_id).toBe(testDeviceId);
        expect(row.timezone_offset).toBe(480); // Int16, not string
        expect(row.dwell_tracking_area_sec).toBeCloseTo(12.5, 1); // Float32
        expect(row.proximity_m).toBeCloseTo(0.85, 2); // Nullable Float32
        expect(row.zone_dwell_times_json).toBe('{"zone1":5.0}');

        console.log('[Schema E2E] ✅ Session data routed with correct types');
    });

    it('routes path data to target table with correct types', async () => {
        const targetId = randomUUID();
        const baseTime = new Date();

        // Insert 3 path samples
        for (let i = 0; i < 3; i++) {
            const sampleTime = new Date(baseTime.getTime() + i * 1000);
            const utcTimestamp = sampleTime.toISOString().replace('T', ' ').replace('Z', '').split('.')[0];

            await client.insert({
                table: 'logs_raw',
                values: [{
                    c1: utcTimestamp,
                    c2: testAccountId,
                    c3: 'test-user',
                    c4: testDeviceId,
                    c5: 'Test Device',
                    c10: 'SENSOR_RADAR_PATH',
                    c11: '1.0',
                    c12: utcTimestamp,
                    c13: '-300',  // UTC-5 (negative offset test)
                    c14: 'America/New_York',
                    c15: `sensor-${testRunId}`,
                    c16: 'Test Radar',
                    c17: '00:1A:2B:3C:4D:5E',
                    c18: targetId,
                    c19: String(1.5 + i * 0.5),  // x: 1.5, 2.0, 2.5
                    c20: String(3.0 + i * 0.3)   // y: 3.0, 3.3, 3.6
                }],
                format: 'JSONEachRow'
            });
        }

        // Query from target table
        const result = await client.query({
            query: `
                SELECT
                    account_id,
                    timezone_offset,
                    target_id,
                    x_m,
                    y_m
                FROM ${pathTable}
                WHERE target_id = {targetId:String}
                ORDER BY log_creation_time ASC
            `,
            query_params: { targetId }
        });

        const data = await result.json();
        expect(data.data).toHaveLength(3);

        const rows = data.data as Record<string, unknown>[];

        // Verify negative timezone offset works
        expect(rows[0].timezone_offset).toBe(-300);

        // Verify float coordinates
        const xValues = rows.map(r => r.x_m as number).sort((a, b) => a - b);
        expect(xValues[0]).toBeCloseTo(1.5, 1);
        expect(xValues[1]).toBeCloseTo(2.0, 1);
        expect(xValues[2]).toBeCloseTo(2.5, 1);

        console.log('[Schema E2E] ✅ Path data routed with correct types');
    });
});
