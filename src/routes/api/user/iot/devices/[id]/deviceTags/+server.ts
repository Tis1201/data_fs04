import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { errorHandler } from '$lib/server/errors/errorHandler';
import { logger } from '$lib/server/logger';

export const POST: RequestHandler = async ({ params, request, locals }) => {
  try {
    const { id: deviceId } = params;
    const { deviceTagId } = await request.json();

    // Validate input
    if (!deviceTagId) {
      return json({ success: false, error: 'Device Tag ID is required' }, { status: 400 });
    }

    // Get authenticated user
    const auth = await locals.auth.validate();
    if (!auth?.user) {
      return json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const device = await locals.prisma.device.findUnique({
      where: { id: deviceId }
    });

    if (!device) {
      return json({ success: false, error: 'Device not found' }, { status: 404 });
    }

    const currentAccountId = (locals as any).currentAccount?.account?.id;
    if (currentAccountId && device.accountId !== currentAccountId) {
      return json({ success: false, error: 'Access denied' }, { status: 403 });
    }

    // Check if device tag is already on this device
    const existingDeviceDeviceTag = await locals.prisma.device.findFirst({
      where: {
        id: deviceId,
        tags: {
          some: { id: deviceTagId }
        }
      }
    });

    if (existingDeviceDeviceTag) {
      return json({ success: false, error: 'Device tag is already in this device' }, { status: 409 });
    }

    // Add device tag to device
    const deviceDeviceTag = await locals.prisma.device.update({
      where: { id: deviceId },
      data: {
        tags: {
          connect: { id: deviceTagId }
        }
      }
    });

    logger.info(`Device tag ${deviceTagId} added to device ${deviceId} by user ${auth.user.id}`);

    return json({
      success: true,
      deviceDeviceTag
    });

  } catch (err) {
    return errorHandler(err);
  }
};

export const DELETE: RequestHandler = async ({ params, request, locals }) => {
  try {
    const { id: deviceId } = params;
    const { deviceTagId } = await request.json();

    // Validate input
    if (!deviceTagId) {
      return json({ success: false, error: 'Device ID is required' }, { status: 400 });
    }

    // Get authenticated user
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
