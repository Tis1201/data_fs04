import { json } from '@sveltejs/kit';
import { logger } from '$lib/server/logger';
import { getClickHouseClient } from '$lib/server/clickhouse/client';
import { restrict } from '$lib/server/security/guards';
import type { RequestHandler } from './$types';

export const GET = restrict(
  async ({ url, auth }: any) => {
    try {
      const search = url.searchParams.get('search') || '';
      const page = parseInt(url.searchParams.get('page') || '1');
      const limit = parseInt(url.searchParams.get('limit') || '100');
      
      // Validate parameters
      if (page < 1 || limit < 1 || limit > 1000) {
        return json({
          success: false,
          error: 'Invalid parameters',
          message: 'Page must be >= 1, limit must be between 1 and 1000'
        }, { status: 400 });
      }

      const clickhouse = getClickHouseClient();
      const offset = (page - 1) * limit;
      
      // Build query with proper ClickHouse syntax
      let whereClause = "WHERE package_name IS NOT NULL AND package_name != ''";
      let searchParam = '';
      
      if (search) {
        whereClause += " AND package_name ILIKE {search:String}";
        searchParam = `%${search}%`;
      }
      
      // First, get total count
      const countQuery = `
        SELECT COUNT(DISTINCT package_name) as total
        FROM mv_device_apps
        ${whereClause}
      `;
      
      const countResult = await clickhouse.query({
        query: countQuery,
        query_params: search ? { search: searchParam } : {},
        format: 'JSONEachRow'
      });
      
      const countData = await countResult.json() as Array<{total: number}>;
      const total = countData[0]?.total || 0;
      
      // Then get paginated results
      const dataQuery = `
        SELECT DISTINCT package_name
        FROM mv_device_apps
        ${whereClause}
        ORDER BY package_name ASC
        LIMIT {limit:UInt32} OFFSET {offset:UInt32}
      `;
      
      const dataResult = await clickhouse.query({
        query: dataQuery,
        query_params: {
          ...(search ? { search: searchParam } : {}),
          limit,
          offset
        },
        format: 'JSONEachRow'
      });

      const apps = await dataResult.json() as Array<{package_name: string}>;
      const packageNames = apps.map(row => row.package_name);

      logger.info(`Retrieved ${packageNames.length} unique package names from ClickHouse`, {
        count: packageNames.length,
        total,
        page,
        limit,
        search,
        userId: auth.user.id
      });

      return json({
        success: true,
        data: {
          apps: packageNames,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
            hasNext: page < Math.ceil(total / limit),
            hasPrev: page > 1
          },
          search,
          timestamp: new Date().toISOString()
        }
      });

    } catch (error) {
      logger.error('Failed to retrieve available apps from ClickHouse', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });

      return json({
        success: false,
        error: 'Failed to retrieve available apps',
        message: error instanceof Error ? error.message : 'Unknown error'
      }, { status: 500 });
    }
  },
  ['ADMIN', 'MEMBER'] // Allow both admin and member users
);
