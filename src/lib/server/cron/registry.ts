import { logger } from '$lib/server/logger';
import type { CronFunction, CronFunctionMetadata, CronExecutionResult } from './types';

/**
 * Registry of available cron functions
 * Maps functionName to module path and export name
 */
const FUNCTION_REGISTRY: Record<string, CronFunctionMetadata> = {
  'entity-expire': {
    name: 'entity-expire',
    description: 'Generic function to handle expiration for any entity type (FactoryToken, Session, ApiKey, etc.)',
    modulePath: '$lib/server/cron/functions/entity-expire',
    exportName: 'entityExpire'
  },
  'factory-tokens-expire': {
    name: 'factory-tokens-expire',
    description: 'Handle expired FactoryToken records (DEPRECATED: use entity-expire instead)',
    modulePath: '$lib/server/cron/functions/factory-tokens-expire',
    exportName: 'factoryTokensExpire'
  },
  'sessions-expire': {
    name: 'sessions-expire',
    description: 'Delete expired Session records (DEPRECATED: use entity-expire instead)',
    modulePath: '$lib/server/cron/functions/sessions-expire',
    exportName: 'sessionsExpire'
  }
  // Add more functions here as they are created
};

/**
 * Get function metadata from registry
 */
export function getFunctionMetadata(functionName: string): CronFunctionMetadata | null {
  return FUNCTION_REGISTRY[functionName] || null;
}

/**
 * Check if a function exists in the registry
 */
export function hasFunction(functionName: string): boolean {
  return functionName in FUNCTION_REGISTRY;
}

/**
 * Get all registered function names
 */
export function getRegisteredFunctions(): string[] {
  return Object.keys(FUNCTION_REGISTRY);
}

/**
 * Load and execute a cron function dynamically
 * @param functionName - Name of the function to execute
 * @param args - Arguments to pass to the function
 * @param context - Execution context
 * @returns Execution result
 */
export async function executeFunction(
  functionName: string,
  args: any,
  context: { prisma: any; logger: any; jobId: string; jobName: string }
): Promise<CronExecutionResult> {
  const metadata = getFunctionMetadata(functionName);

  if (!metadata) {
    const error = `Function '${functionName}' not found in registry`;
    logger.error(`[CronRegistry] ${error}`);
    return {
      success: false,
      error,
      message: `Function '${functionName}' is not registered`
    };
  }

  try {
    logger.info(`[CronRegistry] Loading function: ${functionName} from ${metadata.modulePath}`);
    
    // Dynamic import of the function module
    const module = await import(metadata.modulePath);
    
    // Get the function from the module
    const fn = module[metadata.exportName] as CronFunction;
    
    if (!fn || typeof fn !== 'function') {
      const error = `Function '${metadata.exportName}' not exported from ${metadata.modulePath}`;
      logger.error(`[CronRegistry] ${error}`);
      return {
        success: false,
        error,
        message: `Function '${metadata.exportName}' is not exported from the module`
      };
    }

    logger.info(`[CronRegistry] Executing function: ${functionName}`);
    
    // Execute the function
    await fn(args, context);
    
    logger.info(`[CronRegistry] Function '${functionName}' executed successfully`);
    
    return {
      success: true,
      message: `Function '${functionName}' executed successfully`
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    logger.error(`[CronRegistry] Error executing function '${functionName}': ${errorMessage}`, {
      error: errorMessage,
      stack: errorStack,
      functionName,
      args
    });
    
    return {
      success: false,
      error: errorMessage,
      message: `Function '${functionName}' failed: ${errorMessage}`
    };
  }
}

/**
 * Register a new cron function (for programmatic registration if needed)
 */
export function registerFunction(metadata: CronFunctionMetadata): void {
  FUNCTION_REGISTRY[metadata.name] = metadata;
  logger.info(`[CronRegistry] Registered function: ${metadata.name}`);
}

