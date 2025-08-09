import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { errorHandler } from '$lib/server/errors/errorHandler';
import { logger } from '$lib/server/logger';

export const DELETE: RequestHandler = async ({ params, locals }) => {
  try {
    const { id: bundleId, bundleDeviceId } = params as { id: string; bundleDeviceId: string };

    // Auth
    const auth = await locals.auth.validate();
    if (!auth?.user) {
      return json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Find the bundleDevice
    const existing = await locals.prisma.bundleDevice.findUnique({
      where: { id: bundleDeviceId },
      select: { id: true, bundleId: true, deviceId: true }
    });

    if (!existing || existing.bundleId !== bundleId) {
      return json({ success: false, error: 'Device not found in bundle' }, { status: 404 });
    }

    // Delete
    await locals.prisma.bundleDevice.delete({ where: { id: bundleDeviceId } });

    logger.info(`BundleDevice ${bundleDeviceId} removed from bundle ${bundleId} by user ${auth.user.id}`);

    return json({ success: true, message: 'Device removed from bundle' });
  } catch (err) {
    return errorHandler(err);
  }
};


