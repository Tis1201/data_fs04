import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { restrict } from '$lib/server/security/guards';
import { SystemRole } from '$lib/types/roles';
import { logger } from '$lib/server/logger';

export const GET: RequestHandler = restrict(
  async ({ locals }: { locals: any }) => {
    try {
      // Get all resources without any filtering
      const allResources = await locals.prisma.resource.findMany({
        select: {
          id: true,
          name: true,
          type: true,
          format: true,
          version: true,
          packageName: true,
          size: true,
          createdAt: true
        },
        orderBy: { createdAt: 'desc' },
        take: 10
      });

      // Get count by type
      const countByType = await locals.prisma.resource.groupBy({
        by: ['type'],
        _count: { type: true }
      });

      // Get count by format
      const countByFormat = await locals.prisma.resource.groupBy({
        by: ['format'],
        _count: { format: true }
      });

      return json({
        success: true,
        totalResources: allResources.length,
        recentResources: allResources,
        countByType,
        countByFormat
      });
    } catch (err) {
      logger.error(`[DebugAPI] Error fetching resources: ${String(err)}`);
      return json({ success: false, error: 'Failed to fetch resources' }, { status: 500 });
    }
  },
  [SystemRole.ADMIN]
);
