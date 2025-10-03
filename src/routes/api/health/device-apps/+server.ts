import { json } from '@sveltejs/kit';
import { logger } from '$lib/server/logger';
import { createDeviceAppMonitoring } from '$lib/server/monitoring/deviceAppMonitoring';
import type { RequestHandler } from './$types';

let monitoring: ReturnType<typeof createDeviceAppMonitoring> | null = null;

export const GET: RequestHandler = async ({ locals }) => {
  try {
    // Initialize monitoring if not already done
    if (!monitoring) {
      monitoring = createDeviceAppMonitoring(locals.prisma);
    }

    // Perform health check
    const healthCheck = await monitoring.performHealthCheck();

    // Determine HTTP status code
    let statusCode = 200;
    if (healthCheck.status === 'degraded') {
      statusCode = 200; // Still operational but with issues
    } else if (healthCheck.status === 'unhealthy') {
      statusCode = 503; // Service unavailable
    }

    logger.info('Device app health check completed', {
      status: healthCheck.status,
      issues: healthCheck.issues.length,
      timestamp: healthCheck.timestamp
    });

    return json({
      status: healthCheck.status,
      timestamp: healthCheck.timestamp,
      metrics: healthCheck.metrics,
      issues: healthCheck.issues,
      uptime: process.uptime(),
      version: process.env.npm_package_version || 'unknown'
    }, { status: statusCode });

  } catch (error) {
    logger.error('Health check failed', {
      error: error instanceof Error ? error.message : String(error)
    });

    return json({
      status: 'unhealthy',
      timestamp: new Date(),
      error: 'Health check failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      uptime: process.uptime()
    }, { status: 503 });
  }
};
