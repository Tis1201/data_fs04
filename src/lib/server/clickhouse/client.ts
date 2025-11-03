import { createClient } from '@clickhouse/client';
import { logger } from '$lib/server/logger';

export type ClickHouseEvent = {
  device_id: string;
  wave_id: string;
  bundle_id: string;
  status: string;
  progress: number;
  message: string;
  ts: string;
  type: string;
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
    // Convert to UTC+0 since ClickHouse stores data in UTC
    const nowUTC = new Date();
    const windowStart = new Date(nowUTC.getTime() - windowHours * 60 * 60 * 1000);
    const windowStartStr = windowStart.toISOString()
      .replace('T', ' ')
      .replace('Z', '')
      .split('.')[0]; // Remove milliseconds if present

    // Create bundle ID list for SQL IN clause
    const bundleIdList = processableBundleIds.map(id => `'${id}'`).join(',');

    // Query events from the sliding window for processable bundles only
    const query = `
      SELECT 
        device_id,
        wave_id,
        bundle_id,
        status,
        progress,
        message,
        ts,
        type
      FROM mv_bundle_logs 
      WHERE ts >= '${windowStartStr}'
        AND bundle_id IN (${bundleIdList})
        AND status IN ('IN_PROGRESS', 'COMPLETED', 'FAILED')
      ORDER BY ts ASC
      LIMIT 10000
    `;

    logger.debug(`[ClickHouse] Querying events for ${processableBundleIds.length} processable bundles from ${windowStartStr} (UTC)`);
    logger.debug(`[ClickHouse] Query: ${query}`);

    const result = await client.query({
      query
    });

    const data = await result.json();
    return (data.data || []) as ClickHouseEvent[];
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

export type DeviceInformation = {
  last_connected_at: string | null;
  last_status_at: string | null;
  os_version: string;
  system_uptime_seconds: number | null;
  firmware: string;
  model: string;
  network_interface: string;
  wifi_ssid: string | null;
  signal_strength_dbm: number | null;
  mac_wifi: string | null;
  mac_lan: string;
  orientation: string;
  resolution: string;
  timezone: string;
  public_ip: string;
  private_ip: string;
  created_at: string;
};

export async function getLatestDeviceInformation(macAddress: string | null): Promise<DeviceInformation | null> {
  const client = getClickHouseClient();
  
  try {
    // If no MAC address provided, return null
    if (!macAddress) {
      logger.debug(`[ClickHouse] No MAC address provided, skipping device_information query`);
      return null;
    }

    const query = `
      SELECT 
        last_connected_at,
        last_status_at,
        os_version,
        system_uptime_seconds,
        firmware,
        model,
        network_interface,
        wifi_ssid,
        signal_strength_dbm,
        mac_wifi,
        mac_lan,
        orientation,
        resolution,
        timezone,
        public_ip,
        private_ip,
        created_at
      FROM device_information
      WHERE mac_lan = {macAddress: String}
      ORDER BY created_at DESC
      LIMIT 1
    `;

    logger.debug(`[ClickHouse] Querying device_information for MAC address ${macAddress}`);

    const result = await client.query({
      query,
      query_params: {
        macAddress
      }
    });

    const data = await result.json();
    const rows = data.data || [];
    
    if (rows.length === 0) {
      logger.debug(`[ClickHouse] No device_information found for MAC address ${macAddress}`);
      return null;
    }

    logger.info(`[ClickHouse] Found device_information for MAC address ${macAddress}`);
    return rows[0] as DeviceInformation;
  } catch (error) {
    logger.error(`[ClickHouse] Failed to query device_information for MAC address ${macAddress}: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}
