import { json } from '@sveltejs/kit';
import { logger } from '$lib/server/logger';
import { deviceAppService } from '$lib/server/clickhouse/deviceAppService';
import { restrict } from '$lib/server/security/guards';
import type { RequestHandler } from './$types';

export const GET = restrict(
  async ({ params, url, locals, auth }: any) => {
    try {
      const { id: deviceId } = params;
      
      // Get pagination parameters from query string
      const page = parseInt(url.searchParams.get('page') || '1');
      const limit = parseInt(url.searchParams.get('limit') || '10');
      const search = url.searchParams.get('search') || '';
      const filter = url.searchParams.get('filter') || 'all';
      const sortBy = url.searchParams.get('sortBy') || 'name';
      const sortOrder = url.searchParams.get('sortOrder') || 'asc';
      
      // Validate pagination parameters
      if (page < 1 || limit < 1 || limit > 100) {
        return json({
          success: false,
          error: 'Invalid pagination parameters',
          message: 'Page must be >= 1, limit must be between 1 and 100'
        }, { status: 400 });
      }

      // Get device app data from ClickHouse with pagination and filters
      const result = await deviceAppService.getDeviceApps(deviceId, page, limit, {
        search,
        filter,
        sortBy,
        sortOrder
      });
      
      // Check if result is valid
      if (!result || !Array.isArray(result.apps)) {
        logger.error(`[DeviceAppsAPI] Invalid result:`, { result, type: typeof result });
        throw new Error(`DeviceAppService returned invalid data: ${typeof result}`);
      }

      logger.info(`Retrieved ${result.apps.length} apps for device ${deviceId} (page ${page}/${Math.ceil(result.total / limit)})`, {
        deviceId,
        userId: auth.user.id,
        total: result.total,
        page: result.page,
        limit: result.limit
      });

      return json({
        success: true,
        data: {
          deviceId,
          apps: result.apps,
          pagination: {
            page: result.page,
            limit: result.limit,
            total: result.total,
            totalPages: Math.ceil(result.total / result.limit),
            hasNext: result.page < Math.ceil(result.total / result.limit),
            hasPrev: result.page > 1
          },
          timestamp: new Date().toISOString()
        }
      });

    } catch (error) {
      logger.error('Failed to retrieve device apps', {
        error: error instanceof Error ? error.message : String(error),
        deviceId: params.id,
        stack: error instanceof Error ? error.stack : undefined
      });

      return json({
        success: false,
        error: 'Failed to retrieve device apps',
        message: error instanceof Error ? error.message : 'Unknown error'
      }, { status: 500 });
    }
  },
  ['ADMIN'] // Restrict to admin users
);
