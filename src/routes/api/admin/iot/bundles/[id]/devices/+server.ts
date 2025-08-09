import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { errorHandler } from '$lib/server/errors/errorHandler';
import { logger } from '$lib/server/logger';

export const POST: RequestHandler = async ({ params, request, locals }) => {
  try {
    const { id: bundleId } = params;
    const { deviceId, status = 'PENDING' } = await request.json();

    // Validate input
    if (!deviceId) {
      return json({ success: false, error: 'Device ID is required' }, { status: 400 });
    }

    // Get authenticated user
    const auth = await locals.auth.validate();
    if (!auth?.user) {
      return json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    
    console.log('Auth object:', auth);
    console.log('Auth user:', auth.user);
    console.log('User ID:', auth.user.id);
    console.log('User ID type:', typeof auth.user.id);

    // Check if bundle exists
    const bundle = await locals.prisma.bundle.findUnique({
      where: { id: bundleId }
    });

    if (!bundle) {
      return json({ success: false, error: 'Bundle not found' }, { status: 404 });
    }

    // Check if device exists
    const device = await locals.prisma.device.findUnique({
      where: { id: deviceId }
    });

    if (!device) {
      return json({ success: false, error: 'Device not found' }, { status: 404 });
    }

    // Check if device is already in bundle
    const existingBundleDevice = await locals.prisma.bundleDevice.findUnique({
      where: {
        bundleId_deviceId: {
          bundleId,
          deviceId
        }
      }
    });

    if (existingBundleDevice) {
      return json({ success: false, error: 'Device is already in this bundle' }, { status: 409 });
    }

    // Add device to bundle
    const createData = {
      bundleId,
      deviceId,
      status,
      createdBy: auth.user.id,
      updatedBy: auth.user.id
    };
    
    console.log('Creating bundleDevice with data:', createData);
    
    const bundleDevice = await locals.prisma.bundleDevice.create({
      data: createData,
      select: {
        id: true,
        bundleId: true,
        deviceId: true,
        status: true,
        createdAt: true
      }
    });

    logger.info(`Device ${deviceId} added to bundle ${bundleId} by user ${auth.user.id}`);

    return json({
      success: true,
      bundleDevice
    });

  } catch (err) {
    return errorHandler(err);
  }
};

export const DELETE: RequestHandler = async ({ params, request, locals }) => {
  try {
    const { id: bundleId } = params;
    const { deviceId } = await request.json();

    // Validate input
    if (!deviceId) {
      return json({ success: false, error: 'Device ID is required' }, { status: 400 });
    }

    // Get authenticated user
    const auth = await locals.auth.validate();
    if (!auth?.user) {
      return json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Remove device from bundle
    const result = await locals.prisma.bundleDevice.deleteMany({
      where: {
        bundleId,
        deviceId
      }
    });

    if (result.count === 0) {
      return json({ success: false, error: 'Device not found in bundle' }, { status: 404 });
    }

    logger.info(`Device ${deviceId} removed from bundle ${bundleId} by user ${auth.user.id}`);

    return json({
      success: true,
      message: 'Device removed from bundle'
    });

  } catch (err) {
    return errorHandler(err);
  }
};
