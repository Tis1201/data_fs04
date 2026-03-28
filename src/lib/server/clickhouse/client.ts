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

/** True when ClickHouse is missing, unreachable, or TLS/URL is misconfigured (not a query/logic error). */
export function isClickHouseInfrastructureError(message: string): boolean {
  if (!message) return false;
  return /ClickHouse configuration missing|TLS|ECONNREFUSED|socket disconnected|ENOTFOUND|ETIMEDOUT|certificate|SSL|ECONNRESET|connect/i.test(
    message
  );
}

export function getClickHouseClient() {
  if (!clickhouseClient) {
    const url = process.env.CLICKHOUSE_URL;
    const username = process.env.CLICKHOUSE_USER_NAME;
    const password = process.env.CLICKHOUSE_PASSWORD;
    
    if (!url || !username || !password) {
      throw new Error('ClickHouse configuration missing: CLICKHOUSE_URL, CLICKHOUSE_USER_NAME, and CLICKHOUSE_PASSWORD must be set');
    }
    
    const database = process.env.CLICKHOUSE_DATABASE

    clickhouseClient = createClient({
      url,
      username,
      password,
      database
    });

    logger.info(`[ClickHouse] Connected to ${url} with user ${username}, database: ${database}`);
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
  cpu_usage: number | null;
  ram_usage: number | null;
  disk_usage: number | null;
  manufacturer?: string | null;
  hardware_id?: string | null;
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
        created_at,
        cpu_usage,
        ram_usage,
        disk_usage,
        manufacturer,
        hardware_id
      FROM mv_device_information
      WHERE mac_lan = {macAddress: String}
         OR mac_wifi = {macAddress: String}
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

/** Fetch latest device_information by device_id (e.g. for emulators that report metrics but use synthetic mac_lan). */
export async function getLatestDeviceInformationByDeviceId(deviceId: string | null): Promise<DeviceInformation | null> {
  if (!deviceId) return null;
  const client = getClickHouseClient();
  try {
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
        created_at,
        cpu_usage,
        ram_usage,
        disk_usage,
        manufacturer,
        hardware_id
      FROM mv_device_information
      WHERE device_id = {deviceId: String}
      ORDER BY created_at DESC
      LIMIT 1
    `;
    const result = await client.query({ query, query_params: { deviceId } });
    const data = await result.json();
    const rows = data.data || [];
    if (rows.length === 0) return null;
    return rows[0] as DeviceInformation;
  } catch (error) {
    logger.debug(`[ClickHouse] No device_information by device_id ${deviceId}: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

/** Fetch latest device_information for multiple device_ids (e.g. for listing when devices use synthetic mac_lan). */
export async function getBulkDeviceInformationByDeviceIds(deviceIds: string[]): Promise<Map<string, DeviceInformation>> {
  const resultMap = new Map<string, DeviceInformation>();
  if (!deviceIds.length) return resultMap;
  const validIds = deviceIds.filter((id) => id && id.trim().length > 0);
  if (!validIds.length) return resultMap;
  const client = getClickHouseClient();
  try {
    const query = `
      SELECT 
        device_id,
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
        created_at,
        cpu_usage,
        ram_usage,
        disk_usage,
        manufacturer,
        hardware_id
      FROM (
        SELECT 
          *,
          ROW_NUMBER() OVER (PARTITION BY device_id ORDER BY created_at DESC) as rn
        FROM mv_device_information
        WHERE device_id IN {deviceIds:Array(String)}
      ) ranked
      WHERE rn = 1
    `;
    const result = await client.query({ query, query_params: { deviceIds: validIds } });
    const data = await result.json();
    const rows = data.data || [];
    for (const row of rows) {
      const info = row as DeviceInformation & { device_id?: string };
      if (info.device_id) {
        const { device_id: _, ...rest } = info;
        resultMap.set(info.device_id, rest as DeviceInformation);
      }
    }
    logger.debug(`[ClickHouse] Found device_information for ${resultMap.size} of ${validIds.length} device_ids`);
    return resultMap;
  } catch (error) {
    logger.debug(`[ClickHouse] getBulkDeviceInformationByDeviceIds failed: ${error instanceof Error ? error.message : String(error)}`);
    return resultMap;
  }
}

export async function getMultipleDeviceInformation(macAddresses: string[]): Promise<Map<string, DeviceInformation>> {
  const client = getClickHouseClient();
  const resultMap = new Map<string, DeviceInformation>();
  
  try {
    if (macAddresses.length === 0) {
      logger.debug(`[ClickHouse] No MAC addresses provided, skipping bulk device_information query`);
      return resultMap;
    }

    // Filter out null/empty MAC addresses
    const validMacAddresses = macAddresses.filter(mac => mac && mac.trim().length > 0);
    if (validMacAddresses.length === 0) {
      return resultMap;
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
        created_at,
        cpu_usage,
        ram_usage,
        disk_usage,
        manufacturer,
        hardware_id
      FROM (
        SELECT 
          *,
          ROW_NUMBER() OVER (PARTITION BY mac_lan ORDER BY created_at DESC) as rn
        FROM mv_device_information
        WHERE mac_lan IN {macAddresses:Array(String)}
      ) ranked
      WHERE rn = 1
    `;

    logger.debug(`[ClickHouse] Querying device_information for ${validMacAddresses.length} MAC addresses`);

    const result = await client.query({
      query,
      query_params: {
        macAddresses: validMacAddresses
      }
    });

    const data = await result.json();
    const rows = data.data || [];
    
    // Map results by mac_lan
    for (const row of rows) {
      const info = row as DeviceInformation;
      if (info.mac_lan) {
        resultMap.set(info.mac_lan, info);
      }
    }

    logger.info(`[ClickHouse] Found device_information for ${resultMap.size} of ${validMacAddresses.length} MAC addresses`);
    return resultMap;
  } catch (error) {
    logger.error(`[ClickHouse] Failed to query multiple device_information: ${error instanceof Error ? error.message : String(error)}`);
    return resultMap;
  }
}

/** Monthly issue counts from ClickHouse device_information (actual metrics: cpu, ram, disk, network). */
export type MonthlyIssuesFromClickHouse = {
  cpuOverload: number[];
  memoryCritical: number[];
  storageLow: number[];
  networkUnstable: number[];
};

/** Fetch monthly issue counts from raw device_information (historical metrics). Uses thresholds: >=80% critical. */
export async function getMonthlyIssuesFromClickHouse(
  deviceIds: string[],
  startOfYear: Date,
  endOfYear: Date
): Promise<MonthlyIssuesFromClickHouse> {
  const empty = (): MonthlyIssuesFromClickHouse => ({
    cpuOverload: Array(12).fill(0),
    memoryCritical: Array(12).fill(0),
    storageLow: Array(12).fill(0),
    networkUnstable: Array(12).fill(0)
  });

  if (!deviceIds.length) return empty();

  const validIds = deviceIds.filter((id) => id && id.trim().length > 0);
  if (!validIds.length) return empty();

  const client = getClickHouseClient();
  try {
    const y = startOfYear.getFullYear();
    const startStr = `${y}-01-01 00:00:00`;
    const endStr = `${y}-12-31 23:59:59`;

    const query = `
      SELECT
        toMonth(created_at) AS month,
        uniqExactIf(device_id, cpu_usage >= 80) AS cpu_overload,
        uniqExactIf(device_id, ram_usage >= 80) AS memory_critical,
        uniqExactIf(device_id, disk_usage >= 80) AS storage_low,
        uniqExactIf(device_id, isNotNull(signal_strength_dbm) AND signal_strength_dbm < -75) AS network_unstable
      FROM device_information
      WHERE device_id IN {deviceIds:Array(String)}
        AND created_at >= toDateTime({start:String})
        AND created_at <= toDateTime({end:String})
      GROUP BY month
    `;

    const result = await client.query({
      query,
      query_params: {
        deviceIds: validIds,
        start: startStr,
        end: endStr
      }
    });

    const data = await result.json();
    const rows = (data.data || []) as { month: number; cpu_overload: number; memory_critical: number; storage_low: number; network_unstable: number }[];

    const out = empty();
    for (const row of rows) {
      const idx = row.month - 1;
      if (idx >= 0 && idx < 12) {
        out.cpuOverload[idx] = Number(row.cpu_overload) || 0;
        out.memoryCritical[idx] = Number(row.memory_critical) || 0;
        out.storageLow[idx] = Number(row.storage_low) || 0;
        out.networkUnstable[idx] = Number(row.network_unstable) || 0;
      }
    }
    logger.debug(`[ClickHouse] getMonthlyIssuesFromClickHouse: ${rows.length} months for ${validIds.length} devices`);
    return out;
  } catch (error) {
    logger.warn(`[ClickHouse] getMonthlyIssuesFromClickHouse failed: ${error instanceof Error ? error.message : String(error)}`);
    return empty();
  }
}
