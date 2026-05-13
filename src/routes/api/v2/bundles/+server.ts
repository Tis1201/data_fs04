import { unifiedEndpoint } from '$lib/server/api/unifiedEndpoint';
import { successResponse } from '$lib/types/api';

/**
 * GET /api/v2/bundles
 * List bundles (id and name only).
 *
 * Query params:
 * - status: string - Filter by status (e.g. DRAFT)
 * - limit: number - Max items (default: 10 when no search; 50 when search provided)
 * - offset: number - Pagination offset (default: 0)
 * - search: string - Filter by name (case-insensitive contains); when present, search API is used
 */
export const GET = unifiedEndpoint(
  async ({ context, event }) => {
    const { prisma } = context;
    const url = event.url;

    const status = url.searchParams.get('status');
    const search = (url.searchParams.get('search') || '').trim();
    const offset = parseInt(url.searchParams.get('offset') || '0');
    const limitParam = url.searchParams.get('limit');
    const limit = limitParam != null ? parseInt(limitParam) : (search ? 50 : 10);

    const where: any = {};
    if (status && status !== 'all') {
      where.status = status;
    }
    if (search) {
      where.name = { contains: search, mode: 'insensitive' };
    }

    const bundles = await prisma.bundle.findMany({
      where,
      select: { id: true, name: true },
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
  // ACL commented out: allow list for Assign Deployment modal
  { permission: 'bundle.view', skipPermission: true }
);
