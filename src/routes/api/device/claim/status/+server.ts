import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { restrict_device } from '$lib/server/security/guards';
import { logger } from '$lib/server/logger';

export const GET: RequestHandler = async ({ locals, request }) => {
  try {
    const result = await restrict_device({ locals, request });
    if ('error' in result) {
      return json({ success: false, error: result.error }, { status: result.response.status });
    }

    const { device } = result;

    if (!device) {
      return json({ success: true, data: { claimed: false, status: 'NOT_FOUND' } }, { status: 200 });
    }

    if (device.status !== 'ACTIVE') {
      return json({ success: true, data: { claimed: false, status: device.status || 'INACTIVE' } }, { status: 200 });
    }

    return json({
      success: true,
      data: {
        claimed: true,
        deviceId: device.id,
        accountId: device.accountId ?? null,
        status: device.status
      }
    });
  } catch (e) {
    logger.error(`[ClaimStatus] Error: ${String(e)}`);
    return json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
};


