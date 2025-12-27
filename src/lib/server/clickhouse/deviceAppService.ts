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
  private clickhouse = getClickHouseClient();

  constructor() {
    // ClickHouse client is initialized in the property declaration
  }

  /**
   * Note: This service only READS from ClickHouse
   * Device app data is inserted by devices via logs_raw → mv_device_apps → device_apps
   * Server only pulls/processes data from ClickHouse
   */

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

      console.log("queryyy", whereConditions)
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
      // Fail gracefully when ClickHouse is unavailable - return empty data
      logger.warn('ClickHouse unavailable for device apps query, returning empty data', {
        error: error instanceof Error ? error.message : String(error),
        deviceId
      });
      return {
        apps: [],
        total: 0,
        page,
        limit
      };
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
      // Fail gracefully when ClickHouse is unavailable
      logger.warn('ClickHouse unavailable for multiple device apps query, returning empty data', {
        error: error instanceof Error ? error.message : String(error),
        deviceIds
      });
      return {};
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
      // Fail gracefully when ClickHouse is unavailable
      logger.warn('ClickHouse unavailable for app search, returning empty data', {
        error: error instanceof Error ? error.message : String(error),
        searchTerm
      });
      return [];
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
      // Fail gracefully when ClickHouse is unavailable
      logger.warn('ClickHouse unavailable for app stats, returning zero stats', {
        error: error instanceof Error ? error.message : String(error)
      });
      return {
        totalApps: 0,
        systemApps: 0,
        userApps: 0,
        lastSync: null,
        topApps: []
      };
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
