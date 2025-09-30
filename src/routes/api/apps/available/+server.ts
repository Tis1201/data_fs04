import { json } from '@sveltejs/kit';
import { logger } from '$lib/server/logger';
// Switched to Prisma Resource as the source of truth for user-uploaded apps
import { restrict } from '$lib/server/security/guards';
import type { RequestHandler } from './$types';

export const GET = restrict(
  async ({ url, auth, locals }: any) => {
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

      const { prisma } = locals;
      const offset = (page - 1) * limit;

      // Count user-uploaded apps (Resource with packageName)
      const total = await prisma.resource.count({
        where: {
          createdBy: auth.user.id,
          packageName: { not: null },
          OR: search
            ? [
                { packageName: { contains: search, mode: 'insensitive' } },
                { name: { contains: search, mode: 'insensitive' } }
              ]
            : undefined
        }
      });

      // Fetch paginated list
      const resources = await prisma.resource.findMany({
        where: {
          createdBy: auth.user.id,
          packageName: { not: null },
          OR: search
            ? [
                { packageName: { contains: search, mode: 'insensitive' } },
                { name: { contains: search, mode: 'insensitive' } }
              ]
            : undefined
        },
        orderBy: [
          { packageName: 'asc' }
        ],
        skip: offset,
        take: limit,
        select: {
          packageName: true,
          name: true
        }
      });

      const apps = resources.map((r: any) => ({
        package_name: r.packageName,
        app_name: r.name ?? r.packageName
      }));

      logger.info(`Retrieved ${apps.length} user-uploaded apps`, {
        count: apps.length,
        total,
        page,
        limit,
        search,
        userId: auth.user.id
      });

      return json({
        success: true,
        data: {
          apps,
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
  ['ADMIN', 'MEMBER', 'USER'] // Allow admin, member, and regular users
);
