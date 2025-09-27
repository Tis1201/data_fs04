/**
 * ClickHouse Device App Data Service
 * Handles insertion and querying of device app data
 */
import { getClickHouseClient } from './client';
import { logger } from '$lib/server/logger';

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
      
      // Get total count
      const countResult = await this.clickhouse.query({
        query: `
          SELECT count() as total
          FROM (
            SELECT 
              package_name,
              ROW_NUMBER() OVER (PARTITION BY package_name ORDER BY created_at DESC) as rn
            FROM mv_device_apps 
            WHERE ${whereConditions}
          ) ranked
          WHERE rn = 1
        `,
        query_params: queryParams
      });

      const countResponse = await countResult.json();
      const total = Number(countResponse?.data?.[0]?.total || 0);

      // Get paginated apps
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
              ROW_NUMBER() OVER (PARTITION BY package_name ORDER BY created_at DESC) as rn
            FROM mv_device_apps 
            WHERE ${whereConditions}
          ) ranked
          WHERE rn = 1
          ORDER BY ${orderBy}
          LIMIT {limit:UInt32} OFFSET {offset:UInt32}
        `,
        query_params: { ...queryParams, limit, offset }
      });

      const response = await result.json();
      // Extract the actual data array from the response
      const data = response?.data || [];
      const typedData = data as unknown as DeviceAppData[];
      
      return {
        apps: typedData || [],
        total,
        page,
        limit
      };
    } catch (error) {
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
        total_devices: Number(stats.total_devices),
        total_apps: Number(stats.total_apps),
        unique_apps: Number(stats.unique_apps),
        system_apps: Number(stats.system_apps),
        normal_apps: Number(stats.normal_apps),
        user_apps: Number(stats.user_apps),
        last_sync: new Date(stats.last_sync)
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
