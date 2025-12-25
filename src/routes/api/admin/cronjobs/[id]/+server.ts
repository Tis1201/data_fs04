import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { restrict, type AuthenticatedEvent } from '$lib/server/security/guards';
import { SystemRole } from '$lib/types/roles';
import { logger } from '$lib/server/logger';
import { z } from 'zod';
import { hasFunction } from '$lib/server/cron/registry';
import { validateCronExpression, calculateNextRun } from '$lib/server/cron/cronParser';
import { invalidateCache } from '$lib/server/cron/cache';

// Schema for updating a cronjob
const updateCronJobSchema = z.object({
  name: z.string().min(1).optional(),
  functionName: z.string().min(1).optional(),
  args: z.any().optional(),
  cronExpression: z.string().min(1).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'PAUSED', 'COMPLETED']).optional(),
  maxRetries: z.number().int().min(0).max(10).optional(),
  timeout: z.number().int().min(0).optional().nullable(),
  accountId: z.string().optional().nullable()
});

/**
 * GET /api/admin/cronjobs/[id] - Get cronjob by ID
 */
export const GET: RequestHandler = restrict(
  async ({ params, locals, auth }: AuthenticatedEvent) => {
    try {
      const { id } = params;

      const cronjob = await (locals.prisma as any).cronJob.findUnique({
        where: { id },
        include: {
          creator: {
            select: { id: true, name: true, email: true }
          },
          account: {
            select: { id: true, name: true, slug: true }
          },
          executions: {
            take: 10,
            orderBy: { startedAt: 'desc' }
          }
        }
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

      return json({
        success: true,
        data: cronjob
      });
    } catch (error) {
      logger.error('Error getting cronjob:', {
        error: error instanceof Error ? error.message : String(error)
      });
      return json(
        {
          success: false,
          error: 'Failed to get cronjob',
          message: error instanceof Error ? error.message : String(error)
        },
        { status: 500 }
      );
    }
  },
  [SystemRole.ADMIN, SystemRole.SUPER_ADMIN]
);

/**
 * PUT /api/admin/cronjobs/[id] - Update cronjob
 */
export const PUT: RequestHandler = restrict(
  async ({ params, request, locals, auth }: AuthenticatedEvent) => {
    try {
      const { id } = params;
      const body = await request.json();

      // Validate request
      const validationResult = updateCronJobSchema.safeParse(body);
      if (!validationResult.success) {
        return json(
          {
            success: false,
            error: 'Validation failed',
            errors: validationResult.error.format()
          },
          { status: 400 }
        );
      }

      const data = validationResult.data;

      // Check if cronjob exists
      const existing = await (locals.prisma as any).cronJob.findUnique({
        where: { id }
      });

      if (!existing) {
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
        if (existing.accountId) {
          const membership = await locals.prisma.accountMembership.findFirst({
            where: {
              userId: auth?.user?.id,
              accountId: existing.accountId
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

      // Validate cron expression if provided
      if (data.cronExpression && !validateCronExpression(data.cronExpression)) {
        return json(
          {
            success: false,
            error: 'Invalid cron expression'
          },
          { status: 400 }
        );
      }

      // Validate function if provided
      if (data.functionName && !hasFunction(data.functionName)) {
        return json(
          {
            success: false,
            error: `Function '${data.functionName}' not found in registry`
          },
          { status: 400 }
        );
      }

      // Calculate next run time if cron expression changed
      const updateData: any = { ...data };
      if (data.cronExpression) {
        const nextRunAt = calculateNextRun(data.cronExpression);
        if (!nextRunAt) {
          return json(
            {
              success: false,
              error: 'Failed to calculate next run time from cron expression'
            },
            { status: 400 }
          );
        }
        updateData.nextRunAt = nextRunAt;
      }

      // Update cronjob
      const cronjob = await (locals.prisma as any).cronJob.update({
        where: { id },
        data: updateData,
        include: {
          creator: {
            select: { id: true, name: true, email: true }
          },
          account: {
            select: { id: true, name: true, slug: true }
          }
        }
      });

      // Invalidate cache
      await invalidateCache();

      logger.info(`Cronjob updated: ${id} by ${auth?.user?.id}`);

      return json({
        success: true,
        data: cronjob
      });
    } catch (error) {
      logger.error('Error updating cronjob:', {
        error: error instanceof Error ? error.message : String(error)
      });
      return json(
        {
          success: false,
          error: 'Failed to update cronjob',
          message: error instanceof Error ? error.message : String(error)
        },
        { status: 500 }
      );
    }
  },
  [SystemRole.ADMIN, SystemRole.SUPER_ADMIN]
);

/**
 * DELETE /api/admin/cronjobs/[id] - Delete cronjob
 */
export const DELETE: RequestHandler = restrict(
  async ({ params, locals, auth }: AuthenticatedEvent) => {
    try {
      const { id } = params;

      // Check if cronjob exists
      const existing = await (locals.prisma as any).cronJob.findUnique({
        where: { id }
      });

      if (!existing) {
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
        if (existing.accountId) {
          const membership = await locals.prisma.accountMembership.findFirst({
            where: {
              userId: auth?.user?.id,
              accountId: existing.accountId
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

      // Delete cronjob (cascade will delete executions)
      await (locals.prisma as any).cronJob.delete({
        where: { id }
      });

      // Invalidate cache
      await invalidateCache();

      logger.info(`Cronjob deleted: ${id} by ${auth?.user?.id}`);

      return json({
        success: true,
        message: 'Cronjob deleted successfully'
      });
    } catch (error) {
      logger.error('Error deleting cronjob:', {
        error: error instanceof Error ? error.message : String(error)
      });
      return json(
        {
          success: false,
          error: 'Failed to delete cronjob',
          message: error instanceof Error ? error.message : String(error)
        },
        { status: 500 }
      );
    }
  },
  [SystemRole.ADMIN, SystemRole.SUPER_ADMIN]
);

