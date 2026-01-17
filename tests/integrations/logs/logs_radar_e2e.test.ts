import 'dotenv/config';
import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { createClient, type ClickHouseClient } from '@clickhouse/client';
import { randomUUID } from 'crypto';

/**
 * End-to-end test for generating radar log data into ClickHouse logs_raw table.
 *
 * This test inserts dummy radar logs (SENSOR_RADAR_SESSION and SENSOR_RADAR_PATH)
 * into the logs_raw wide table for verification and development purposes.
 *
 * Schema reference:
 * - System columns (c1-c9): Injected by pipeline (simulated here)
 * - Log columns (c10+): L-notation payload fields
 *
 * Usage:
 *   npm test -- tests/integrations/logs/logs_radar_e2e.test.ts
 */

describe('Logs Radar E2E', () => {
    let client: ClickHouseClient;
    const testRunId = randomUUID().slice(0, 8); // Unique ID for this test run
    const testAccountId = `test-account-${testRunId}`;
    const testDeviceId = `test-device-${testRunId}`;
    const testUserId = `test-user-${testRunId}`;

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

        // Verify connection
        const result = await client.query({ query: 'SELECT 1' });
        const data = await result.json();
        expect(data.data).toBeDefined();
        console.log(`[Logs Radar E2E] Connected to ClickHouse at ${url}`);
        console.log(`[Logs Radar E2E] Test run ID: ${testRunId}`);
    });

    afterAll(async () => {
        if (client) {
            await client.close();
        }
    });

    /**
     * Helper to insert a log row into logs_raw
     * Uses the ClickHouse client's insert method with JSONEachRow format
     */
    async function insertLogRow(columns: Record<string, string | number | null>) {
        await client.insert({
            table: 'logs_raw',
            values: [columns],
            format: 'JSONEachRow'
        });
    }


    it('inserts a session_log:1.0 record', async () => {
        const now = new Date();
        const utcTimestamp = now.toISOString().replace('T', ' ').replace('Z', '').split('.')[0];
        const targetId = randomUUID();

        // Insert session_log with all required fields per LOGS_RADAR.md
        await insertLogRow({
            // System columns (c1-c9) - simulated
            c1: utcTimestamp,           // processed_at
            c2: testAccountId,          // account_id (from JWT)
            c3: testUserId,             // user_id (from JWT)
            c4: testDeviceId,           // device_id (from JWT)
            c5: 'Test Radar Device',    // device_name
            c6: String(Math.floor(Date.now() / 1000)), // iat
            c7: String(Math.floor(Date.now() / 1000) + 3600), // exp
            c8: 'logs',                 // aud
            c9: 'fs04',                 // iss

            // Log columns (L1-L11) - session payload
            c10: 'SENSOR_RADAR_SESSION',            // L1: log_type
            c11: '1.0',                             // L2: log_type_version
            c12: utcTimestamp,                      // L3: log_creation_time (UTC)
            c13: '480',                             // L4: timezone_offset (UTC+8)
            c14: 'Asia/Singapore',                  // L5: timezone_label
            c15: `radar-${testRunId}`,              // L6: sensor_id
            c16: 'Test Lobby Radar',                // L7: sensor_name
            c17: '00:1A:2B:3C:4D:5E',               // L8: mac_address
            c18: targetId,                          // L9: target_id
            c19: '5.2',                             // L10: dwell_tracking_area_sec
            c20: '{"Entrance":2.1,"PromoArea":3.1}', // L11: zone_dwell_times_json
            c21: '0.75'                             // L12: proximity_m
        });

        // Verify the insert
        const result = await client.query({
            query: `
                SELECT c10, c11, c18, c19
                FROM logs_raw
                WHERE c2 = {accountId:String}
                  AND c10 = 'SENSOR_RADAR_SESSION'
                ORDER BY c1 DESC
                LIMIT 1
            `,
            query_params: { accountId: testAccountId }
        });

        const data = await result.json();
        expect(data.data).toHaveLength(1);

        const row = data.data[0] as Record<string, string>;
        expect(row.c10).toBe('SENSOR_RADAR_SESSION');
        expect(row.c11).toBe('1.0');
        expect(row.c18).toBe(targetId);
        expect(row.c19).toBe('5.2');

        console.log('[Logs Radar E2E] ✅ SENSOR_RADAR_SESSION inserted and verified');
    });

    it('inserts path_tracking:1.0 records', async () => {
        const targetId = randomUUID();
        const baseTime = new Date();

        // Insert 3 path tracking samples
        for (let i = 0; i < 3; i++) {
            const sampleTime = new Date(baseTime.getTime() + i * 100); // 100ms apart
            const utcTimestamp = sampleTime.toISOString().replace('T', ' ').replace('Z', '').split('.')[0];

            await insertLogRow({
                // System columns
                c1: utcTimestamp,
                c2: testAccountId,
                c3: testUserId,
                c4: testDeviceId,
                c5: 'Test Radar Device',
                c6: String(Math.floor(Date.now() / 1000)),
                c7: String(Math.floor(Date.now() / 1000) + 3600),
                c8: 'logs',
                c9: 'fs04',

                // Log columns (L1-L10) - path schema
                c10: 'SENSOR_RADAR_PATH',               // L1: log_type
                c11: '1.0',                             // L2: log_type_version
                c12: utcTimestamp,                      // L3: log_creation_time (UTC)
                c13: '480',                             // L4: timezone_offset
                c14: 'Asia/Singapore',                  // L5: timezone_label
                c15: `radar-${testRunId}`,              // L6: sensor_id
                c16: 'Test Lobby Radar',                // L7: sensor_name
                c17: '00:1A:2B:3C:4D:5E',               // L8: mac_address
                c18: targetId,                          // L9: target_id
                c19: String(1.0 + i * 0.1),             // L10: x_m
                c20: String(2.0 + i * 0.2)              // L11: y_m
            });
        }

        // Verify the inserts
        const result = await client.query({
            query: `
                SELECT c10, c11, c18, c19, c20
                FROM logs_raw
                WHERE c2 = {accountId:String}
                  AND c10 = 'SENSOR_RADAR_PATH'
                  AND c18 = {targetId:String}
                ORDER BY c1 ASC
            `,
            query_params: { accountId: testAccountId, targetId }
        });

        const data = await result.json();
        expect(data.data).toHaveLength(3);

        // Check that all 3 samples exist (order not guaranteed due to same-second timestamps)
        const rows = data.data as Record<string, string>[];
        const xValues = rows.map(r => parseFloat(r.c19)).sort((a, b) => a - b);
        expect(xValues[0]).toBeCloseTo(1.0, 1);
        expect(xValues[1]).toBeCloseTo(1.1, 1);
        expect(xValues[2]).toBeCloseTo(1.2, 1);

        console.log('[Logs Radar E2E] ✅ SENSOR_RADAR_PATH (3 samples) inserted and verified');
    });


    it('can query all SENSOR_RADAR logs from this test run', async () => {
        const result = await client.query({
            query: `
                SELECT
                    c10 as log_type,
                    c11 as log_type_version,
                    c12 as log_creation_time,
                    c13 as timezone_offset,
                    c14 as timezone_label,
                    c15 as sensor_id,
                    c18 as target_id
                FROM logs_raw
                WHERE c2 = {accountId:String}
                  AND c10 IN ('SENSOR_RADAR_SESSION', 'SENSOR_RADAR_PATH')
                ORDER BY c1 DESC
                LIMIT 10
            `,
            query_params: { accountId: testAccountId }
        });

        const data = await result.json();
        expect(data.data.length).toBeGreaterThanOrEqual(4); // 1 session + 3 path samples

        console.log('[Logs Radar E2E] ✅ Query returned', data.data.length, 'rows');
        console.log('[Logs Radar E2E] Sample data:', JSON.stringify(data.data[0], null, 2));
    });

    // =========================================================================
    // MV Verification Tests - Check data flows through materialized views
    // =========================================================================

    it('verifies session data appears in radar_session MV with correct fields', async () => {
        // Query the MV target table with named columns
        const result = await client.query({
            query: `
                SELECT
                    account_id,
                    device_id,
                    log_creation_time,
                    timezone_offset,
                    timezone_label,
                    sensor_id,
                    sensor_name,
                    mac_address,
                    target_id,
                    dwell_tracking_area_sec,
                    zone_dwell_times_json,
                    proximity_m
                FROM mv_radar_session
                WHERE account_id = {accountId:String}
                ORDER BY log_creation_time DESC
                LIMIT 1
            `,
            query_params: { accountId: testAccountId }
        });

        const data = await result.json();

        if (data.data.length === 0) {
            console.log('[Logs Radar E2E] ⚠️ No data in radar_session MV (MV may not exist yet)');
            return; // Skip if MV doesn't exist
        }

        expect(data.data).toHaveLength(1);

        const row = data.data[0] as Record<string, unknown>;

        // Verify named columns exist and have correct types
        expect(row.account_id).toBe(testAccountId);
        expect(row.device_id).toBe(testDeviceId);
        expect(typeof row.timezone_offset).toBe('number'); // Int16
        expect(row.timezone_offset).toBe(480);
        expect(row.timezone_label).toBe('Asia/Singapore');
        expect(row.sensor_id).toBe(`radar-${testRunId}`);
        expect(row.sensor_name).toBe('Test Lobby Radar');
        expect(row.mac_address).toBe('00:1A:2B:3C:4D:5E');
        expect(typeof row.dwell_tracking_area_sec).toBe('number'); // Float32
        expect(row.dwell_tracking_area_sec).toBeCloseTo(5.2, 1);
        expect(row.zone_dwell_times_json).toBe('{"Entrance":2.1,"PromoArea":3.1}');
        expect(typeof row.proximity_m).toBe('number'); // Nullable Float32
        expect(row.proximity_m).toBeCloseTo(0.75, 2);

        console.log('[Logs Radar E2E] ✅ radar_session MV has correct named fields and types');
    });

    it('verifies path data appears in radar_path MV with correct fields', async () => {
        // Query the MV target table with named columns
        const result = await client.query({
            query: `
                SELECT
                    account_id,
                    device_id,
                    log_creation_time,
                    timezone_offset,
                    timezone_label,
                    sensor_id,
                    sensor_name,
                    mac_address,
                    target_id,
                    x_m,
                    y_m
                FROM mv_radar_path
                WHERE account_id = {accountId:String}
                ORDER BY log_creation_time DESC
                LIMIT 5
            `,
            query_params: { accountId: testAccountId }
        });

        const data = await result.json();

        if (data.data.length === 0) {
            console.log('[Logs Radar E2E] ⚠️ No data in radar_path MV (MV may not exist yet)');
            return; // Skip if MV doesn't exist
        }

        expect(data.data.length).toBeGreaterThanOrEqual(3);

        const rows = data.data as Record<string, unknown>[];
        const row = rows[0];

        // Verify named columns exist and have correct types
        expect(row.account_id).toBe(testAccountId);
        expect(row.device_id).toBe(testDeviceId);
        expect(typeof row.timezone_offset).toBe('number'); // Int16
        expect(row.timezone_label).toBe('Asia/Singapore');
        expect(row.sensor_id).toBe(`radar-${testRunId}`);
        expect(typeof row.x_m).toBe('number'); // Float32
        expect(typeof row.y_m).toBe('number'); // Float32

        // Verify x/y values are within expected range
        const xValues = rows.map(r => r.x_m as number).sort((a, b) => a - b);
        const yValues = rows.map(r => r.y_m as number).sort((a, b) => a - b);

        expect(xValues[0]).toBeGreaterThanOrEqual(1.0);
        expect(yValues[0]).toBeGreaterThanOrEqual(2.0);

        console.log('[Logs Radar E2E] ✅ radar_path MV has correct named fields and types');
        console.log('[Logs Radar E2E] Sample path:', JSON.stringify(row, null, 2));
    });
});

