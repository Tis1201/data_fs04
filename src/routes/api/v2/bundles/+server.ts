import { unifiedEndpoint } from '$lib/server/api/unifiedEndpoint';
import { successResponse } from '$lib/types/api';

/**
 * GET /api/v2/bundles
 * List bundles with pagination and filtering
 * 
 * Query params:
 * - status: string - Filter by status (all, DRAFT, PUBLISHED, IN_PROGRESS, COMPLETED, FAILED)
 * - limit: number - Items per page (default: 100)
 * - offset: number - Pagination offset (default: 0)
 * 
 * Admin: See all bundles
 * User: See all bundles (bundles are not account-scoped in current implementation)
 * 
 * Returns bundles with app and device counts
 */
export const GET = unifiedEndpoint(
  async ({ context, event }) => {
    const { prisma } = context;
    const url = event.url;

    const status = url.searchParams.get('status');
    const limit = parseInt(url.searchParams.get('limit') || '100');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    // Build where clause
    const where: any = {};
    if (status && status !== 'all') {
      where.status = status;
    }

    // Get bundles from database
    const bundles = await prisma.bundle.findMany({
      where,
      select: {
        id: true,
        name: true,
        description: true,
        status: true,
        os: true,
        version: true,
        reboot: true,
        createdAt: true,
        updatedAt: true,
        apps: {
          select: {
            id: true,
            order: true,
            autoOpen: true,
            resource: {
              select: {
                id: true,
                name: true,
                type: true,
                size: true
              }
            }
          },
          orderBy: { order: 'asc' }
        },
        _count: {
          select: {
            apps: true,
            devices: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset
    });

    const total = await prisma.bundle.count({ where });

    return successResponse({
      bundles,
      total,
      pagination: {
        limit,
        offset,
        hasMore: offset + limit < total
      }
    });
  },
  { permission: 'bundle.view' }
);
