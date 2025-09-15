import { json } from '@sveltejs/kit';
import { errorHandler } from '$lib/server/errors/errorHandler';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, locals, request }) => {
  try {
    const auth = await locals.auth.validate();
    if (!auth?.user) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: profileId } = params;
    const { deviceIds } = await request.json();

    if (!profileId) {
      return json({ success: false, error: 'Profile ID is required' }, { status: 400 });
    }

    if (!deviceIds || !Array.isArray(deviceIds) || deviceIds.length === 0) {
      return json({ success: false, error: 'Device IDs array is required' }, { status: 400 });
    }

    // Verify the profile exists and user has access
    const profile = await locals.prisma.deviceProfile.findUnique({
      where: { id: profileId },
      select: { 
        id: true, 
        name: true,
        accountId: true
      }
    });

    if (!profile) {
      return json({ success: false, error: 'Device profile not found' }, { status: 404 });
    }

    // Check permissions
    const hasAccess = await locals.prisma.accountMembership.findFirst({
      where: {
        accountId: profile.accountId,
        userId: auth.user.id,
        role: { in: ['OWNER', 'ADMIN'] }
      }
    });

    if (!hasAccess && auth.user.systemRole !== 'ADMIN') {
      return json({ success: false, error: 'Access denied' }, { status: 403 });
    }

    // Verify all devices exist and belong to the same account
    const devices = await locals.prisma.device.findMany({
      where: {
        id: { in: deviceIds },
        accountId: profile.accountId,
        profileAssignment: null // Only get devices that are not already assigned
      },
      select: {
        id: true
      }
    });

    if (devices.length === 0) {
      return json({ 
        success: true, 
        message: 'No available devices to assign',
        assignedCount: 0 
      });
    }

    // Create assignments for all available devices
    const assignments = devices.map(device => ({
      deviceId: device.id,
      profileId: profileId,
      assignedBy: auth.user.id,
      status: 'PENDING' as const
    }));

    const result = await locals.prisma.deviceProfileAssignment.createMany({
      data: assignments,
      skipDuplicates: true
    });

    return json({
      success: true,
      message: `Successfully assigned ${result.count} devices`,
      assignedCount: result.count
    });

  } catch (error) {
    return errorHandler(error);
  }
};
