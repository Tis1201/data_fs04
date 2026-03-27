import { getClickHouseClient } from '$lib/server/clickhouse/client';
import { error, json } from '@sveltejs/kit';
import { logger } from '$lib/server/logger';
import { validateAccountApiKey } from '$lib/server/auth/account-api-key-auth';
import { validateMacAddressForAccount } from '$lib/server/auth/mac-address-auth';
import type { RequestHandler } from './$types';

/**
 * Escape CSV field value
 */
function escapeCsvField(value: any): string {
    if (value === null || value === undefined) {
        return '';
    }
    const str = String(value);
    // If field contains comma, newline, or quote, wrap in quotes and escape quotes
    if (str.includes(',') || str.includes('\n') || str.includes('"')) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
}

// Removed arrayToCsv - using streaming instead for better memory efficiency

/**
 * Parse datetime string to ClickHouse-compatible format
 */
function parseDateTime(dateStr: string): string {
    try {
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) {
            throw new Error('Invalid date');
        }
        // Format as YYYY-MM-DD HH:MM:SS for ClickHouse
        return date.toISOString().replace('T', ' ').split('.')[0];
    } catch (err) {
        throw new Error(`Invalid datetime format: ${dateStr}`);
    }
}

export const GET: RequestHandler = async ({ request, url }) => {
    try {
        // 1. Validate account-level API key
        const apiKey = request.headers.get('x-api-key') || request.headers.get('x-api-Key');
        if (!apiKey) {
            logger.warn('[Radar API] No API key provided');
            return error(401, 'Unauthorized: API key required');
        }

        const keyAuth = await validateAccountApiKey(apiKey);
        if (!keyAuth.valid || !keyAuth.accountId) {
            logger.warn('[Radar API] Invalid API key or not account-level', {
                error: keyAuth.error,
                apiKeyId: keyAuth.apiKeyId
            });
            return error(401, `Unauthorized: ${keyAuth.error || 'Invalid API key'}`);
        }

        // 2. Parse and validate query parameters
        const macAddress = url.searchParams.get('mac_address');
        const startTime = url.searchParams.get('start_time');
        const endTime = url.searchParams.get('end_time');
        const responseType = url.searchParams.get('type') || 'csv';

        if (!macAddress) {
            return error(400, 'Bad Request: mac_address parameter is required');
        }
        if (!startTime) {
            return error(400, 'Bad Request: start_time parameter is required');
        }
        if (!endTime) {
            return error(400, 'Bad Request: end_time parameter is required');
        }

        if (!['csv', 'json'].includes(responseType)) {
            return error(400, 'Bad Request: type parameter must be "csv" or "json"');
        }

        // 3. Validate MAC address belongs to account
        const macAuth = await validateMacAddressForAccount(macAddress, keyAuth.accountId);
        if (!macAuth.valid) {
            logger.warn('[Radar API] MAC address not authorized', {
                macAddress,
                accountId: keyAuth.accountId,
                error: macAuth.error
            });
            return error(403, `Forbidden: ${macAuth.error || 'MAC address not authorized'}`);
        }

        // 4. Parse datetime strings
        let startTimeFormatted: string;
        let endTimeFormatted: string;
        try {
            startTimeFormatted = parseDateTime(startTime);
            endTimeFormatted = parseDateTime(endTime);
        } catch (err) {
            return error(400, `Bad Request: ${err instanceof Error ? err.message : 'Invalid datetime format'}`);
        }

        // 5. Query ClickHouse mv_radar_session
        const client = getClickHouseClient();
        const database = process.env.CLICKHOUSE_DATABASE;
        const query = `
            SELECT
                processed_at,
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
            FROM ${database}.mv_radar_session
            WHERE mac_address = {macAddress: String}
              AND log_creation_time >= {startTime: DateTime}
              AND log_creation_time <= {endTime: DateTime}
            ORDER BY log_creation_time ASC
        `;

        logger.info('[Radar API] Querying sessions', {
            macAddress,
            deviceId: macAuth.deviceId,
            accountId: keyAuth.accountId,
            startTime: startTimeFormatted,
            endTime: endTimeFormatted
        });

        const result = await client.query({
            query,
            query_params: {
                macAddress: macAddress,
                startTime: startTimeFormatted,
                endTime: endTimeFormatted
            }
        });

        const data = await result.json();
        const rows = (data.data || []) as any[];

        logger.info(`[Radar API] Found ${rows.length} session records`);

        // 5. Format response (CSV or JSON)
        if (responseType === 'json') {
            return json(rows, {
                headers: {
                    'Content-Type': 'application/json'
                }
            });
        }

        // CSV format - stream response row by row
        const headers = [
            'processed_at',
            'account_id',
            'device_id',
            'log_creation_time',
            'timezone_offset',
            'timezone_label',
            'sensor_id',
            'sensor_name',
            'mac_address',
            'target_id',
            'dwell_tracking_area_sec',
            'zone_dwell_times_json',
            'proximity_m'
        ];

        // Create a streaming CSV response
        const stream = new ReadableStream({
            start(controller) {
                // Send CSV header
                const headerLine = headers.join(',') + '\n';
                controller.enqueue(new TextEncoder().encode(headerLine));

                // Stream rows in batches for better performance
                let index = 0;
                const BATCH_SIZE = 100; // Process 100 rows at a time

                const processBatch = () => {
                    if (index >= rows.length) {
                        controller.close();
                        return;
                    }

                    // Process a batch of rows
                    const batchEnd = Math.min(index + BATCH_SIZE, rows.length);
                    let batchContent = '';

                    for (let i = index; i < batchEnd; i++) {
                        const row = rows[i];
                        const values = headers.map(header => escapeCsvField(row[header]));
                        batchContent += values.join(',') + '\n';
                    }

                    controller.enqueue(new TextEncoder().encode(batchContent));
                    index = batchEnd;

                    // Process next batch asynchronously
                    if (typeof setImmediate !== 'undefined') {
                        setImmediate(processBatch);
                    } else {
                        setTimeout(processBatch, 0);
                    }
                };

                processBatch();
            }
        });

        return new Response(stream, {
            headers: {
                'Content-Type': 'text/csv; charset=utf-8',
                'Content-Disposition': `attachment; filename="sessions_${macAddress}_${startTimeFormatted.replace(/[ :]/g, '_')}.csv"`
            }
        });
    } catch (err) {
        if (err && typeof err === 'object' && 'status' in err) {
            throw err;
        }

        logger.error('[Radar API] Error in sessions endpoint', {
            error: err instanceof Error ? err.message : String(err),
            stack: err instanceof Error ? err.stack : undefined
        });
        return error(500, 'Internal Server Error: Failed to retrieve session data');
    }
};

