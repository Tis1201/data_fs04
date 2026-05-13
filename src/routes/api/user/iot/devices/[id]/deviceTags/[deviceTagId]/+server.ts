import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { errorHandler } from '$lib/server/errors/errorHandler';
import { logger } from '$lib/server/logger';

export const DELETE: RequestHandler = async ({ params, locals }) => {
  try {
    const { id: deviceId, deviceTagId } = params as { id: string; deviceTagId: string };

    const auth = await locals.auth.validate();
    if (!auth?.user) {
      return json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const device = await locals.prisma.device.findUnique({ where: { id: deviceId }, select: { accountId: true } });
    const currentAccountId = (locals as any).currentAccount?.account?.id;
    if (currentAccountId && device?.accountId !== currentAccountId) {
      return json({ success: false, error: 'Access denied' }, { status: 403 });
    }

    await locals.prisma.device.update({
      where: { id: deviceId },
      data: {
        tags: {
          disconnect: { id: deviceTagId }
        }
      }
    });

    logger.info(`Device tag ${deviceTagId} removed from device ${deviceId} by user ${auth.user.id}`);

    return json({ success: true, message: 'Device tag removed from device' });
  } catch (err) {
    return errorHandler(err);
  }
};


