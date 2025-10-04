import { json } from '@sveltejs/kit';
import { logger } from '$lib/server/logger';
import { restrictJWT, type JWTAuthenticatedEvent } from '$lib/server/security/jwt-guard';
import { withRateLimit, deviceIdKeyGenerator } from '$lib/server/security/rate-limit';
import type { RequestHandler } from './$types';

/**
 * GET endpoint for available apps - JWT authenticated version
 * This endpoint is designed for device clients using JWT Bearer tokens
 * 
 * Features:
 * - JWT Bearer token authentication
 * - Rate limiting (100 requests per minute per device)
 * - Same business logic as /api/apps/available
 * 
 * Usage:
 * ```
 * curl -H "Authorization: Bearer <jwt_token>" \
 *      http://localhost:5173/api/apps/available-jwt?search=myapp&page=1&limit=10
 * ```
 */
export const GET: RequestHandler = restrictJWT(
  async (event: JWTAuthenticatedEvent) => {
    // Apply rate limiting: 100 requests per minute per device
    return withRateLimit(
      {
        maxRequests: 100,
        windowSeconds: 60,
        keyGenerator: deviceIdKeyGenerator
      },
      async () => {
        try {
          const { url, auth, locals, deviceId, accountId } = event;
          
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

          // Determine if user is admin
          const isAdmin = auth.user.systemRole === 'ADMIN';

          // Build where clause - admins see all apps, others see only their own
          const whereClause: any = {
            packageName: { not: null },
            OR: search
              ? [
                  { packageName: { contains: search, mode: 'insensitive' } },
                  { name: { contains: search, mode: 'insensitive' } }
                ]
              : undefined
          };

          // Non-admins can only see their own apps
          if (!isAdmin) {
            whereClause.createdBy = auth.user.id;
          }

          // Get unique packageNames with aggregation
          const uniquePackages = await prisma.resource.groupBy({
            by: ['packageName'],
            where: whereClause,
            orderBy: {
              packageName: 'asc'
            },
            _count: {
              packageName: true
            }
          });

          const total = uniquePackages.length;
          const paginatedPackages = uniquePackages.slice(offset, offset + limit);

          // For each unique packageName, get one representative resource with download info
          const packageNames = paginatedPackages.map((p: any) => p.packageName).filter(Boolean);
          const resourceDetails = await prisma.resource.findMany({
            where: {
              packageName: { in: packageNames },
              ...whereClause
            },
            distinct: ['packageName'],
            select: {
              id: true,
              packageName: true,
              name: true,
              version: true,
              size: true,
              type: true,
              format: true
            },
            orderBy: {
              packageName: 'asc'
            }
          });

          const apps = resourceDetails.map((r: any) => ({
            resource_id: r.id,
            package_name: r.packageName,
            app_name: r.name ?? r.packageName,
            version: r.version,
            size: r.size,
            type: r.type,
            format: r.format,
            download_url: `/api/device/resources/${r.id}`
          }));

          logger.info(`[JWT] Retrieved ${apps.length} user-uploaded apps`, {
            count: apps.length,
            total,
            page,
            limit,
            search,
            userId: auth.user.id,
            deviceId,
            accountId,
            isAdmin,
            scope: isAdmin ? 'all users' : 'current user'
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
          logger.error('[JWT] Failed to retrieve available apps', {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
            deviceId: event.deviceId,
            userId: event.auth.user.id
          });

          return json({
            success: false,
            error: 'Failed to retrieve available apps',
            message: error instanceof Error ? error.message : 'Unknown error'
          }, { status: 500 });
        }
      }
    )(event);
  },
  ['ADMIN', 'MEMBER', 'USER'] // Allow admin, member, and regular users
);

