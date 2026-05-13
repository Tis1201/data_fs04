import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { restrict, type AuthenticatedEvent } from '$lib/server/security/guards';
import { SystemRole } from '$lib/types/roles';
import { logger } from '$lib/server/logger';

/**
 * GET /api/admin/cronjobs/[id]/executions - Get execution history for a cronjob
 */
export const GET: RequestHandler = restrict(
  async ({ params, url, locals, auth }: AuthenticatedEvent) => {
    try {
      const { id } = params;
      const page = Math.max(1, Number(url.searchParams.get('page') || '1'));
      const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get('pageSize') || '20')));
      const status = url.searchParams.get('status');

      // Check if cronjob exists
      const cronjob = await (locals.prisma as any).cronJob.findUnique({
        where: { id }
      });

      if (!cronjob) {
        return json(
          {
            success: false,
            error: 'Cronjob not found'
          },
          { status: 404 }
        );
      }

      // Check permissions for non-admin users
      if ((auth?.user?.systemRole || '').toUpperCase() !== 'ADMIN') {
        if (cronjob.accountId) {
          const membership = await locals.prisma.accountMembership.findFirst({
            where: {
              userId: auth?.user?.id,
              accountId: cronjob.accountId
            }
          });
          if (!membership) {
            return json(
              {
                success: false,
                error: 'Forbidden'
              },
              { status: 403 }
            );
          }
        }
      }

      const where: any = {
        cronJobId: id
      };

      if (status) {
        where.status = status;
      }

      const [executions, total] = await Promise.all([
        (locals.prisma as any).cronJobExecution.findMany({
          where,
          skip: (page - 1) * pageSize,
          take: pageSize,
          orderBy: { startedAt: 'desc' }
        }),
        (locals.prisma as any).cronJobExecution.count({ where })
      ]);

      return json({
        success: true,
        data: {
          executions,
          pagination: {
            page,
            pageSize,
            total,
            totalPages: Math.ceil(total / pageSize)
          }
        }
      });
    } catch (error) {
      logger.error('Error getting execution history:', {
        error: error instanceof Error ? error.message : String(error)
      });
      return json(
        {
          success: false,
          error: 'Failed to get execution history',
          message: error instanceof Error ? error.message : String(error)
        },
        { status: 500 }
      );
    }
  },
  [SystemRole.ADMIN, SystemRole.SUPER_ADMIN]
);

