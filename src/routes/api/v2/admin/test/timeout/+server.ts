import type { RequestHandler } from './$types';
import { unifiedEndpoint } from '$lib/server/api/unifiedEndpoint';
import { triggerTimeoutCheck } from '$lib/server/scheduler/bundleTimeoutManager';
import { logger } from '$lib/server/logger';

/**
 * POST /api/v2/admin/test/timeout
 * Manually trigger timeout check for bundle deployments (Admin only)
 * Used for testing and debugging timeout functionality
 */
export const POST: RequestHandler = unifiedEndpoint(
	async ({ context }) => {
		const { session } = context;
		
		logger.info(`[TestTimeout] Manual timeout check triggered by user ${session.user.id}`);
		
		await triggerTimeoutCheck();
		
		return {
			success: true,
			data: {
				message: 'Timeout check completed'
			}
		};
	},
	{ permission: 'admin.test' }
);

