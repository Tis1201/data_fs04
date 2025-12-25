import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { restrict, type AuthenticatedEvent } from '$lib/server/security/guards';
import { SystemRole } from '$lib/types/roles';
import { logger } from '$lib/server/logger';
import { z } from 'zod';
import { hasFunction } from '$lib/server/cron/registry';
import { validateCronExpression, calculateNextRun } from '$lib/server/cron/cronParser';
import { invalidateCache } from '$lib/server/cron/cache';

// Schema for creating a cronjob
const createCronJobSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  functionName: z.string().min(1, 'Function name is required'),
  args: z.any().optional().default({}),
  cronExpression: z.string().min(1, 'Cron expression is required'),
  status: z.enum(['SCHEDULED', 'COMPLETED', 'FAILED', 'PAUSED']).optional().default('SCHEDULED'),
  maxRetries: z.number().int().min(0).max(10).optional().default(3),
  timeout: z.number().int().min(0).optional(),
  accountId: z.string().optional().nullable()
});

/**
 * GET /api/admin/cronjobs - List cronjobs
 */
export const GET: RequestHandler = restrict(
  async ({ url, locals, auth }: AuthenticatedEvent) => {
    try {
      const page = Math.max(1, Number(url.searchParams.get('page') || '1'));
      const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get('pageSize') || '20')));
      const status = url.searchParams.get('status');
      const accountId = url.searchParams.get('accountId');
      const search = url.searchParams.get('search')?.trim();

      const where: any = {};

      if (status) {
        where.status = status;
      }

      if (accountId) {
        where.accountId = accountId;
      }

      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { functionName: { contains: search, mode: 'insensitive' } }
        ];
      }

      // Non-admin: restrict by account memberships
      if ((auth?.user?.systemRole || '').toUpperCase() !== 'ADMIN') {
        const memberships = await locals.prisma.accountMembership.findMany({
          where: { userId: auth?.user?.id },
          select: { accountId: true }
        });
        const accountIds = memberships.map((m: any) => m.accountId);
        if (accountIds.length > 0) {
          where.accountId = { in: accountIds };
        } else {
          where.accountId = '__NO_ACCOUNT__';
        }
      }

      const [cronjobs, total] = await Promise.all([
        (locals.prisma as any).cronJob.findMany({
          where,
          skip: (page - 1) * pageSize,
          take: pageSize,
          orderBy: { createdAt: 'desc' },
          include: {
            creator: {
              select: { id: true, name: true, email: true }
            },
            account: {
              select: { id: true, name: true, slug: true }
            },
            executions: {
              take: 1,
              orderBy: { startedAt: 'desc' },
              select: {
                id: true,
                status: true,
                startedAt: true,
                completedAt: true,
                duration: true,
                error: true
              }
            }
          }
        }),
        (locals.prisma as any).cronJob.count({ where })
      ]);

      return json({
        success: true,
        data: {
          cronjobs,
          pagination: {
            page,
            pageSize,
            total,
            totalPages: Math.ceil(total / pageSize)
          }
        }
      });
    } catch (error) {
      logger.error('Error listing cronjobs:', {
        error: error instanceof Error ? error.message : String(error)
      });
      return json(
        {
          success: false,
          error: 'Failed to list cronjobs',
          message: error instanceof Error ? error.message : String(error)
        },
        { status: 500 }
      );
    }
  },
  [SystemRole.ADMIN, SystemRole.SUPER_ADMIN]
);

/**
 * POST /api/admin/cronjobs - Create cronjob
 */
export const POST: RequestHandler = restrict(
  async ({ request, locals, auth }: AuthenticatedEvent) => {
    try {
      const body = await request.json();

      // Validate request
      const validationResult = createCronJobSchema.safeParse(body);
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

      // Validate cron expression
      if (!validateCronExpression(data.cronExpression)) {
        return json(
          {
            success: false,
            error: 'Invalid cron expression'
          },
          { status: 400 }
        );
      }

      // Validate function exists in registry
      if (!hasFunction(data.functionName)) {
        return json(
          {
            success: false,
            error: `Function '${data.functionName}' not found in registry`
          },
          { status: 400 }
        );
      }

      // Calculate next run time
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

      // Create cronjob
      const cronjob = await (locals.prisma as any).cronJob.create({
        data: {
          name: data.name,
          functionName: data.functionName,
          args: data.args || {},
          cronExpression: data.cronExpression,
          status: data.status,
          maxRetries: data.maxRetries,
          timeout: data.timeout,
          nextRunAt,
          createdBy: auth?.user?.id,
          accountId: data.accountId || null
        },
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

      logger.info(`Cronjob created: ${cronjob.id} by ${auth?.user?.id}`);

      return json({
        success: true,
        data: cronjob
      });
    } catch (error) {
      logger.error('Error creating cronjob:', {
        error: error instanceof Error ? error.message : String(error)
      });
      return json(
        {
          success: false,
          error: 'Failed to create cronjob',
          message: error instanceof Error ? error.message : String(error)
        },
        { status: 500 }
      );
    }
  },
  [SystemRole.ADMIN, SystemRole.SUPER_ADMIN]
);

