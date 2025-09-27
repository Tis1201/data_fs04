import { createClient } from '@clickhouse/client';
import { logger } from '$lib/server/logger';

export type ClickHouseEvent = {
  deviceId: string;
  waveId: string;
  bundleId: string;
  status: string;
  progress: string;
  message: string;
  ts: string;
  type: string;
  eventId?: string; // Generated for deduplication
};

let clickhouseClient: ReturnType<typeof createClient> | null = null;

export function getClickHouseClient() {
  if (!clickhouseClient) {
    const url = process.env.CLICKHOUSE_URL || 'http://localhost:8123';
    const username = process.env.CLICKHOUSE_USER_NAME || 'admin';
    const password = process.env.CLICKHOUSE_PASSWORD || 'admin0823';

    clickhouseClient = createClient({
      url,
      username,
      password,
      database: 'fs_04'
    });

    logger.info(`[ClickHouse] Connected to ${url} with user ${username}`);
  }

  return clickhouseClient;
}

export async function queryClickHouseEvents(
  processableBundleIds: string[],
  windowHours: number = 3
): Promise<ClickHouseEvent[]> {
  const client = getClickHouseClient();
  
  try {
    if (processableBundleIds.length === 0) {
      logger.debug(`[ClickHouse] No processable bundles, skipping query`);
      return [];
    }

    // Use a sliding window approach: look for events in the last N hours
    // This handles network delays, clock skew, and out-of-order events
    const windowStart = new Date(Date.now() - windowHours * 60 * 60 * 1000);
    const windowStartStr = windowStart.toISOString()
      .replace('T', ' ')
      .replace('Z', '')
      .split('.')[0]; // Remove milliseconds if present

    // Create bundle ID list for SQL IN clause
    const bundleIdList = processableBundleIds.map(id => `'${id}'`).join(',');

    // Query events from the sliding window for processable bundles only
    const query = `
      SELECT 
        deviceId,
        waveId,
        bundleId,
        status,
        toString(progress) as progress,
        message,
        ts,
        type,
        concat(deviceId, ':', waveId, ':', bundleId, ':', toString(ts)) as eventId
      FROM mv_bundle_logs 
      WHERE ts >= '${windowStartStr}'
        AND bundleId IN (${bundleIdList})
        AND status IN ('IN_PROGRESS', 'COMPLETED', 'FAILED')
      ORDER BY ts ASC
      LIMIT 10000
    `;

    logger.debug(`[ClickHouse] Querying events for ${processableBundleIds.length} processable bundles from ${windowStartStr}`);
    logger.debug(`[ClickHouse] Querying events for ${query}`);

    const result = await client.query({
      query
    });

    const data = await result.json();
    return data.data || [];
  } catch (error) {
    logger.error(`[ClickHouse] Query failed: ${error instanceof Error ? error.message : String(error)}`);
    return [];
  }
}

export async function testClickHouseConnection(): Promise<boolean> {
  try {
    const client = getClickHouseClient();
    await client.query({ query: 'SELECT 1' });
    logger.info('[ClickHouse] Connection test successful');
    return true;
  } catch (error) {
    logger.error(`[ClickHouse] Connection test failed: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}
