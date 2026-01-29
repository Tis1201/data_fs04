/**
 * ClickHouse Device App Data Service
 * Handles insertion and querying of device app data
 */
import { getClickHouseClient } from './client';
import { logger } from '$lib/server/logger';

/**
 * Parse size string like "30MB", "1.5GB" to bytes
 */
function parseSizeString(sizeStr: string): number {
  if (typeof sizeStr === 'number') return sizeStr;
  if (!sizeStr || typeof sizeStr !== 'string') return 0;
  
  const match = sizeStr.match(/^([\d.]+)\s*(B|KB|MB|GB|TB)?$/i);
  if (!match) return 0;
  
  const value = parseFloat(match[1]);
  const unit = (match[2] || 'B').toUpperCase();
  
  const multipliers: Record<string, number> = {
    'B': 1,
    'KB': 1024,
    'MB': 1024 * 1024,
    'GB': 1024 * 1024 * 1024,
    'TB': 1024 * 1024 * 1024 * 1024
  };
  
  return Math.round(value * (multipliers[unit] || 1));
}

export interface DeviceAppData {
  device_id: string;
  package_name: string;
  app_name: string;
  version: string;
  app_type: string;
  metadata: string;
  created_at: Date;
}

export interface DeviceAppSummary {
  device_id: string;
  total_apps: number;
  system_apps: number;
  normal_apps: number;
  user_apps: number;
  last_app_sync: Date;
}

export class DeviceAppService {
  private _clickhouse: ReturnType<typeof getClickHouseClient> | null = null;

  private get clickhouse() {
    if (!this._clickhouse) {
      this._clickhouse = getClickHouseClient();
    }
    return this._clickhouse;
  }

  constructor() {
    // ClickHouse client is lazily initialized when first accessed
  }

  /**
   * Check if ClickHouse is configured and available (without throwing).
   * Used by API routes to return empty app list instead of 500 when ClickHouse is not set up.
   */
  isAvailable(): boolean {
    try {
      const url = process.env.CLICKHOUSE_URL;
      const username = process.env.CLICKHOUSE_USER_NAME;
      const password = process.env.CLICKHOUSE_PASSWORD;
      return !!(url && username && password);
    } catch {
      return false;
    }
  }

  /**
   * Note: This service READS from ClickHouse; optionally WRITES via insertDeviceAppReport
   * (used by emulator/device to report app list so GET apps returns data from ClickHouse, same as production).
   * Data flow: device/app report → logs_raw → mv_device_apps_ingest → mv_device_apps table.
   */

  /**
   * Insert a device app list into logs_raw so it flows through the MV into mv_device_apps.
   * All rows use the same timestamp so they appear as one "sync" for getDeviceApps.
   * Only call when isAvailable() is true.
   */
  async insertDeviceAppReport(
    deviceId: string,
    apps: Array<{ packageName: string; appName: string; version?: string; appType?: string; metadata?: string; sizeBytes?: number | string }>
  ): Promise<void> {
    if (!apps.length) return;
    const now = new Date();
    const c1 = now.toISOString().slice(0, 19).replace('T', ' ');
    const empty = (s: string | undefined) => s ?? '';
    const rows = apps.map((app) => ({
      c1,
      c2: '',
      c3: '',
      c4: deviceId,
      c5: '',
      c6: '',
      c7: '',
      c8: '',
      c9: '',
      c10: 'DEVICE_APPS',
      c11: '',
      c12: '',
      c13: '',
      c14: '',
      c15: empty(app.packageName),
      c16: empty(app.appName),
      c17: empty(app.version),
      c18: empty(app.appType),
      c19: typeof app.metadata === 'string' ? app.metadata : (app.metadata ? JSON.stringify(app.metadata) : '{}'),
      c20: '',
      c21: app.sizeBytes != null ? String(app.sizeBytes) : '0',
      c22: '',
      c23: '',
      c24: '',
      c25: '',
      c26: '',
      c27: '',
      c28: '',
      c29: '',
      c30: '',
      c31: '',
      c32: '',
      c33: '',
      c34: '',
      c35: '',
      c36: '',
      c37: '',
      c38: '',
      c39: '',
      c40: '',
      c41: '',
      c42: '',
      c43: '',
      c44: '',
      c45: '',
      c46: '',
      c47: '',
      c48: '',
      c49: '',
      c50: '',
      c51: '',
      c52: '',
      c53: '',
      c54: '',
      c55: '',
      c56: '',
      c57: '',
      c58: '',
      c59: '',
      c60: '',
      c61: null as string | null
    }));
    await this.clickhouse.insert({
      table: 'logs_raw',
      values: rows,
      format: 'JSONEachRow'
    });
    logger.debug('[DeviceAppService] insertDeviceAppReport', { deviceId, count: apps.length });
  }

  /**
   * Get current app data for a device with pagination
   */
  async getDeviceApps(deviceId: string, page: number = 1, limit: number = 10, filters: {
    search?: string;
    filter?: string;
    sortBy?: string;
    sortOrder?: string;
  } = {}): Promise<{apps: DeviceAppData[], total: number, page: number, limit: number}> {
    try {
      const offset = (page - 1) * limit;
      const { search = '', filter = 'all', sortBy = 'name', sortOrder = 'asc' } = filters;
      
      // Build WHERE conditions
      let whereConditions = 'device_id = {deviceId:String}';
      const queryParams: any = { deviceId };
      
      if (search) {
        whereConditions += ' AND (lower(app_name) LIKE {searchPattern:String} OR lower(package_name) LIKE {searchPattern:String})';
        queryParams.searchPattern = `%${search.toLowerCase()}%`;
      }
      
      if (filter !== 'all') {
        whereConditions += ' AND lower(app_type) = {filterType:String}';
        queryParams.filterType = filter.toLowerCase();
      }
      
      // Build ORDER BY clause
      let orderBy = 'app_name ASC';
      switch (sortBy) {
        case 'name':
          orderBy = `app_name ${sortOrder.toUpperCase()}`;
          break;
        case 'package':
          orderBy = `package_name ${sortOrder.toUpperCase()}`;
          break;
        case 'version':
          orderBy = `version ${sortOrder.toUpperCase()}`;
          break;
        case 'size':
          orderBy = `size_bytes ${sortOrder.toUpperCase()}`;
          break;
        case 'modified':
          orderBy = `created_at ${sortOrder.toUpperCase()}`;
          break;
      }

      // First, get the latest sync time for this device
      const latestTimeResult = await this.clickhouse.query({
        query: `
          SELECT max(created_at) as latest_time
          FROM mv_device_apps
          WHERE device_id = {deviceId:String}
        `,
        query_params: { deviceId }
      });

      const latestTimeResponse = await latestTimeResult.json();
      const latestTime = (latestTimeResponse?.data?.[0] as any)?.latest_time;

      if (!latestTime) {
        // No apps found for this device
        return {
          apps: [],
          total: 0,
          page,
          limit
        };
      }

      // Update where conditions to include only apps from the latest sync time
      whereConditions += ' AND created_at = {latestTime:String}';
      queryParams.latestTime = latestTime;

      // Get total count (all apps from latest sync)
      const countResult = await this.clickhouse.query({
        query: `
          SELECT count() as total
          FROM mv_device_apps 
          WHERE ${whereConditions}
        `,
        query_params: queryParams
      });

      const countResponse = await countResult.json();
      const total = Number((countResponse?.data?.[0] as any)?.total || 0);

      // Get paginated apps (all apps from latest sync)
      const result = await this.clickhouse.query({
        query: `
          SELECT 
            device_id,
            package_name,
            app_name,
            version,
            app_type,
            metadata,
            created_at,
            last_modified,
            size_bytes
          FROM mv_device_apps 
          WHERE ${whereConditions}
          ORDER BY ${orderBy}
          LIMIT {limit:UInt32} OFFSET {offset:UInt32}
        `,
        query_params: { ...queryParams, limit, offset }
      });

      const response = await result.json();
      // Extract the actual data array from the response
      const data = response?.data || [];
      
      // Transform the data to match the expected format
      const transformedData = data.map((app: any) => ({
        device_id: app.device_id,
        account_id: app.account_id || '',
        package_name: app.package_name,
        app_name: app.app_name,
        version: app.version,
        app_type: app.app_type || 'Normal',
        metadata: app.metadata || {},
        created_at: app.created_at,
        last_modified: app.last_modified || app.created_at,
        install_date: app.install_date || app.created_at,
        // Parse size_bytes: if it's a string like "30MB", convert to bytes
        size_bytes: typeof app.size_bytes === 'string' 
          ? parseSizeString(app.size_bytes) 
          : (app.size_bytes || 0),
        is_pinned: app.is_pinned || false,
        is_system_app: app.is_system_app || app.app_type?.toLowerCase() === 'system',
        permissions: app.permissions || [],
      }));
      
      return {
        apps: transformedData || [],
        total,
        page,
        limit
      };
    } catch (error) {
      // Preserve old behaviour: throw so API returns 5xx when ClickHouse is configured but fails
      logger.error('Failed to query device apps from ClickHouse', {
        error: error instanceof Error ? error.message : String(error),
        deviceId,
        stack: error instanceof Error ? error.stack : undefined
      });
      throw error;
    }
  }


  /**
   * Get app data for multiple devices
   */
  async getMultipleDeviceApps(deviceIds: string[], limit: number = 100): Promise<DeviceAppData[]> {
    try {
      const result = await this.clickhouse.query({
        query: `
          SELECT 
            device_id,
            package_name,
            app_name,
            version,
            app_type,
            metadata,
            created_at
          FROM (
            SELECT 
              device_id,
              package_name,
              app_name,
              version,
              app_type,
              metadata,
              created_at,
              ROW_NUMBER() OVER (PARTITION BY device_id, package_name ORDER BY created_at DESC) as rn
            FROM mv_device_apps 
            WHERE device_id IN {deviceIds:Array(String)}
          ) ranked
          WHERE rn = 1
          ORDER BY device_id, app_name ASC
          LIMIT {limit:UInt32}
        `,
        query_params: { deviceIds, limit }
      });

      const response = await result.json();
      const data = response?.data || [];
      return data as unknown as DeviceAppData[];
    } catch (error) {
      logger.error('Failed to query multiple device apps from ClickHouse', {
        error: error instanceof Error ? error.message : String(error),
        deviceIds
      });
      throw error;
    }
  }

  /**
   * Search apps by name or package name
   */
  async searchApps(
    searchTerm: string, 
    limit: number = 50
  ): Promise<DeviceAppData[]> {
    try {
      const result = await this.clickhouse.query({
        query: `
          SELECT 
            device_id,
            package_name,
            app_name,
            version,
            app_type,
            metadata,
            created_at
          FROM mv_device_apps 
          WHERE (app_name ILIKE {searchTerm:String} OR package_name ILIKE {searchTerm:String})
          ORDER BY app_name ASC
          LIMIT {limit:UInt32}
        `,
        query_params: { 
          searchTerm: `%${searchTerm}%`,
          limit 
        }
      });

      const response = await result.json();
      const data = response?.data || [];
      return data as unknown as DeviceAppData[];
    } catch (error) {
      logger.error('Failed to search apps in ClickHouse', {
        error: error instanceof Error ? error.message : String(error),
        searchTerm
      });
      throw error;
    }
  }

  /**
   * Get app statistics
   */
  async getAppStats(): Promise<{
    total_devices: number;
    total_apps: number;
    unique_apps: number;
    system_apps: number;
    normal_apps: number;
    user_apps: number;
    last_sync: Date;
  }> {
    try {
      const result = await this.clickhouse.query({
        query: `
          SELECT 
            uniqExact(device_id) as total_devices,
            count() as total_apps,
            uniqExact(package_name) as unique_apps,
            countIf(app_type = 'System') as system_apps,
            countIf(app_type = 'Normal') as normal_apps,
            countIf(app_type = 'User') as user_apps,
            max(created_at) as last_sync
          FROM mv_device_apps
        `
      });

      const response = await result.json();
      const data = response?.data || [];
      const stats = data?.[0];
      
      if (!stats) {
        return {
          total_devices: 0,
          total_apps: 0,
          unique_apps: 0,
          system_apps: 0,
          normal_apps: 0,
          user_apps: 0,
          last_sync: new Date()
        };
      }

      return {
        total_devices: Number((stats as any).total_devices),
        total_apps: Number((stats as any).total_apps),
        unique_apps: Number((stats as any).unique_apps),
        system_apps: Number((stats as any).system_apps),
        normal_apps: Number((stats as any).normal_apps),
        user_apps: Number((stats as any).user_apps),
        last_sync: new Date((stats as any).last_sync)
      };
    } catch (error) {
      logger.error('Failed to query app stats from ClickHouse', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Test ClickHouse connection
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.clickhouse.query({ query: 'SELECT 1' });
      return true;
    } catch (error) {
      logger.error('ClickHouse connection test failed', {
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }
}

// Export singleton instance
export const deviceAppService = new DeviceAppService();
