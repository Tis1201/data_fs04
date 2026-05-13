import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { restrict } from '$lib/server/security/guards';
import { triggerTimeoutCheck } from '$lib/server/scheduler/bundleTimeoutManager';
import { logger } from '$lib/server/logger';

export const POST: RequestHandler = restrict(async ({ auth }: any) => {
  try {
    logger.info(`[TestTimeout] Manual timeout check triggered by user ${auth.user?.id}`);
    await triggerTimeoutCheck();
    return json({ success: true, message: 'Timeout check completed' });
  } catch (error: any) {
    logger.error(`[TestTimeout] Failed to trigger timeout check: ${String(error?.message || error)}`);
    return json({ success: false, error: String(error?.message || error) }, { status: 500 });
  }
}, ['ADMIN']);
