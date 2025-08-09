import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
// Legacy endpoint no longer supported; keep stub to prevent accidental use
import { deviceService } from '$lib/server/device/deviceService';
import { logger } from '$lib/server/logger';

export const POST: RequestHandler = async () => {
  try {
    return json({ error: 'Deprecated endpoint' }, { status: 410 });

  } catch (error) {
    logger.error('Error handling deprecated bundle-status endpoint', { error });
    return json({ error: 'Internal server error' }, { status: 500 });
  }
};
