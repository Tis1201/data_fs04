import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { errorHandler } from '$lib/server/errors/errorHandler';
import { logger } from '$lib/server/logger';
import { logAudit } from '$lib/server/audit-logger';
import { AuditActionType } from '$lib/constants/system';

export const POST: RequestHandler = async ({ params, request, locals, getClientAddress }) => {
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

    const bundle = await locals.prisma.bundle.findUnique({
      where: { id: bundleId }
    });

    if (!bundle) {
      return json({ success: false, error: 'Bundle not found' }, { status: 404 });
    }

    const currentAccountId = (locals as any).currentAccount?.account?.id;
    if (currentAccountId && bundle.accountId !== currentAccountId) {
      return json({ success: false, error: 'Access denied' }, { status: 403 });
    }

    if (bundle.status !== 'DRAFT') {
      return json({ success: false, error: 'Bundle is not editable (must be DRAFT)' }, { status: 403 });
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

    // Log audit for bundle device creation
    await logAudit({
      actionType: AuditActionType.INSERT,
      tableName: 'BundleDevice',
      recordId: bundleDevice.id,
      oldData: null,
      newData: bundleDevice,
      userId: auth.user.id,
      ipAddress: (locals as any).ipAddress || getClientAddress?.() || 'unknown',
      prisma: locals.prisma
    });

    return json({
      success: true,
      bundleDevice
    });

  } catch (err) {
    return errorHandler(err);
  }
};

export const DELETE: RequestHandler = async ({ params, request, locals, getClientAddress }) => {
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

    // Verify bundle belongs to current account
    const bundleDel = await locals.prisma.bundle.findUnique({ where: { id: bundleId }, select: { accountId: true } });
    const currentAccountIdDel = (locals as any).currentAccount?.account?.id;
    if (currentAccountIdDel && bundleDel?.accountId !== currentAccountIdDel) {
      return json({ success: false, error: 'Access denied' }, { status: 403 });
    }

    const existingBundleDevices = await locals.prisma.bundleDevice.findMany({
      where: {
        bundleId,
        deviceId
      }
    });

    if (existingBundleDevices.length === 0) {
      return json({ success: false, error: 'Device not found in bundle' }, { status: 404 });
    }

    // Remove device from bundle
    const result = await locals.prisma.bundleDevice.deleteMany({
      where: {
        bundleId,
        deviceId
      }
    });

    logger.info(`Device ${deviceId} removed from bundle ${bundleId} by user ${auth.user.id}`);

    // Log audit for each bundle device deletion
    for (const bundleDevice of existingBundleDevices) {
      await logAudit({
        actionType: AuditActionType.DELETE,
        tableName: 'BundleDevice',
        recordId: bundleDevice.id,
        oldData: bundleDevice,
        newData: null,
        userId: auth.user.id,
        ipAddress: (locals as any).ipAddress || getClientAddress?.() || 'unknown',
        prisma: locals.prisma
      });
    }

    return json({
      success: true,
      message: 'Device removed from bundle'
    });

  } catch (err) {
    return errorHandler(err);
  }
};
