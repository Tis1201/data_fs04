import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { logger } from '$lib/server/logger';
import { getAdminPrisma } from '$lib/server/prisma';

/**
 * GET /api/device/claim-status/[deviceId]
 *
 * Public API - no authentication required.
 * Returns whether a device is claimed or not. Used by devices when they receive
 * an unclaim notification to confirm with the server before clearing credentials.
 */
export const GET: RequestHandler = async ({ params }) => {
	try {
		const deviceId = params.deviceId?.trim();
		if (!deviceId) {
			return json({ claimed: false, error: 'deviceId required' }, { status: 400 });
		}

		const prisma = getAdminPrisma();
		const device = await prisma.device.findUnique({
			where: { id: deviceId },
			select: { id: true, accountId: true }
		});

		if (!device) {
			// Device not found - treat as unclaimed
			return json({ claimed: false });
		}

		const claimed = device.accountId != null && device.accountId !== '';

		return json({ claimed });
	} catch (e) {
		logger.error(`[ClaimStatus] Error: ${String(e)}`);
		return json({ error: 'Internal Server Error' }, { status: 500 });
	}
};
