import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { restrict, type AuthenticatedEvent } from '$lib/server/security/guards';
import { SystemRole } from '$lib/types/roles';
import { logger } from '$lib/server/logger';
import { calculateNextRun } from '$lib/server/cron/cronParser';
import { invalidateCache } from '$lib/server/cron/cache';

/**
 * POST /api/admin/cronjobs/[id]/resume - Resume a paused cronjob
 */
export const POST: RequestHandler = restrict(
  async ({ params, locals, auth }: AuthenticatedEvent) => {
    try {
      const { id } = params;

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

      if (cronjob.status !== 'PAUSED') {
        return json(
          {
            success: false,
            error: 'Cronjob is not paused'
          },
          { status: 400 }
        );
      }

      // Recalculate next run time
      const nextRunAt = calculateNextRun(cronjob.cronExpression);

      const updated = await (locals.prisma as any).cronJob.update({
        where: { id },
        data: {
          status: 'SCHEDULED',
          nextRunAt: nextRunAt
        }
      });

      // Invalidate cache
      await invalidateCache();

      logger.info(`Cronjob resumed: ${id} by ${auth?.user?.id}`);

      return json({
        success: true,
        data: updated
      });
    } catch (error) {
      logger.error('Error resuming cronjob:', {
        error: error instanceof Error ? error.message : String(error)
      });
      return json(
        {
          success: false,
          error: 'Failed to resume cronjob',
          message: error instanceof Error ? error.message : String(error)
        },
        { status: 500 }
      );
    }
  },
  [SystemRole.ADMIN, SystemRole.SUPER_ADMIN]
);

