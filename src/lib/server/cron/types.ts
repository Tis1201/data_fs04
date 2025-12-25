import type { PrismaClient } from '@prisma/client';
import type { logger } from '$lib/server/logger';

/**
 * Context provided to cron functions during execution
 */
export interface CronContext {
  prisma: PrismaClient;
  logger: typeof logger;
  jobId: string;
  jobName: string;
}

/**
 * Standard cron function signature
 * @template TArgs - Type of arguments passed to the function
 */
export type CronFunction<TArgs = any> = (args: TArgs, context: CronContext) => Promise<void>;

/**
 * Function metadata for registry
 */
export interface CronFunctionMetadata {
  name: string;
  description?: string;
  modulePath: string;
  exportName: string;
}

/**
 * Execution result for a cron function
 */
export interface CronExecutionResult {
  success: boolean;
  message?: string;
  error?: string;
  metadata?: Record<string, any>;
}

