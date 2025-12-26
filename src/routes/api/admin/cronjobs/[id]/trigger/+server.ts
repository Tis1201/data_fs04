import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { restrict, type AuthenticatedEvent } from '$lib/server/security/guards';
import { SystemRole } from '$lib/types/roles';
import { logger } from '$lib/server/logger';
import { PrismaClient } from '@prisma/client';
import { executeFunction, hasFunction } from '$lib/server/cron/registry';
import { withDistributedLock } from '$lib/server/scheduler/distributedLock';

const adminPrisma = new PrismaClient();
const LOCK_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * POST /api/admin/cronjobs/[id]/trigger - Manually trigger a cronjob
 */
export const POST: RequestHandler = restrict(
  async ({ params, locals, auth }: AuthenticatedEvent) => {
    try {
      const { id } = params;

      // Get cronjob
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

      // Check if job is already running
      if (cronjob.isRunning) {
        return json(
          {
            success: false,
            error: 'Cronjob is already running'
          },
          { status: 409 }
        );
      }

      // Validate function exists
      if (!hasFunction(cronjob.functionName)) {
        return json(
          {
            success: false,
            error: `Function '${cronjob.functionName}' not found in registry`
          },
          { status: 400 }
        );
      }

      const lockResource = `lock:cronjob:${id}`;
      const startTime = Date.now();

      // Execute with distributed lock
      const result = await withDistributedLock(
        lockResource,
        LOCK_TTL_MS,
        async () => {
          // Double-check job is still not running
          const currentJob = await (adminPrisma as any).cronJob.findUnique({
            where: { id }
          });

          if (!currentJob) {
            throw new Error('Cronjob not found');
          }

          if (currentJob.isRunning) {
            throw new Error('Cronjob started running by another process');
          }

          // Mark as running
          await (adminPrisma as any).cronJob.update({
            where: { id },
            data: { isRunning: true }
          });

          // Create execution record
          const execution = await (adminPrisma as any).cronJobExecution.create({
            data: {
              cronJobId: id,
              status: 'RUNNING',
              startedAt: new Date()
            }
          });

          let executionResult: any = { success: true };
          let executionError: string | null = null;

          try {
            // Prepare execution context
            const context = {
              prisma: adminPrisma,
              logger,
              jobId: id,
              jobName: cronjob.name
            };

            // Execute with timeout if specified
            if (cronjob.timeout && cronjob.timeout > 0) {
              const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error(`Job timeout after ${cronjob.timeout}ms`)), cronjob.timeout!);
              });

              const executionPromise = executeFunction(cronjob.functionName, cronjob.args, context);

              executionResult = await Promise.race([executionPromise, timeoutPromise]);
            } else {
              executionResult = await executeFunction(cronjob.functionName, cronjob.args, context);
            }

            if (!executionResult.success) {
              executionError = executionResult.error || executionResult.message || 'Unknown error';
              throw new Error(executionError);
            }
          } catch (error) {
            executionError = error instanceof Error ? error.message : String(error);
            executionResult = {
              success: false,
              error: executionError
            };
            throw error;
          } finally {
            const duration = Date.now() - startTime;

            // Update job status
            await (adminPrisma as any).cronJob.update({
              where: { id },
              data: {
                isRunning: false,
                lastRunAt: new Date(),
                lastResult: executionError || executionResult.message || 'Success'
              }
            });

            // Update execution record
            await (adminPrisma as any).cronJobExecution.update({
              where: { id: execution.id },
              data: {
                status: executionResult.success ? 'SUCCESS' : 'FAILED',
                completedAt: new Date(),
                duration,
                result: executionResult.success ? executionResult.message : null,
                error: executionError,
                metadata: executionResult.metadata ? JSON.parse(JSON.stringify(executionResult.metadata)) : null
              }
            });
          }

          return {
            success: executionResult.success,
            duration,
            message: executionResult.message,
            error: executionError
          };
        },
        { skipIfLocked: false, maxWaitTime: 1000 }
      );

      if (!result) {
        return json(
          {
            success: false,
            error: 'Failed to acquire lock - job may be running'
          },
          { status: 409 }
        );
      }

      logger.info(`Cronjob manually triggered: ${id} by ${auth?.user?.id}`);

      return json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Error triggering cronjob:', {
        error: error instanceof Error ? error.message : String(error)
      });

      // Ensure isRunning is reset on error
      try {
        await (adminPrisma as any).cronJob.update({
          where: { id: params.id },
          data: { isRunning: false }
        });
      } catch (updateError) {
        logger.error(`Failed to reset isRunning for job ${params.id}:`, {
          error: updateError instanceof Error ? updateError.message : String(updateError)
        });
      }

      return json(
        {
          success: false,
          error: 'Failed to trigger cronjob',
          message: error instanceof Error ? error.message : String(error)
        },
        { status: 500 }
      );
    }
  },
  [SystemRole.ADMIN, SystemRole.SUPER_ADMIN]
);

