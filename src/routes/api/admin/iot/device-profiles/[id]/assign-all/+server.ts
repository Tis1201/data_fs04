import { json } from '@sveltejs/kit';
import { errorHandler } from '$lib/server/errors/errorHandler';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, locals, request, fetch }) => {
  try {
    const auth = await locals.auth.validate();
    if (!auth?.user) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Admin users have full access
    if (auth.user.systemRole !== 'ADMIN') {
      return json({ error: 'Admin access required' }, { status: 403 });
    }

    const { id: profileId } = params;
    const { deviceIds } = await request.json();

    if (!profileId) {
      return json({ success: false, error: 'Profile ID is required' }, { status: 400 });
    }

    if (!deviceIds || !Array.isArray(deviceIds) || deviceIds.length === 0) {
      return json({ success: false, error: 'Device IDs array is required' }, { status: 400 });
    }

    // Verify the profile exists
    const profile = await locals.prisma.deviceProfile.findUnique({
      where: { id: profileId },
      select: { 
        id: true, 
        name: true
      }
    });

    if (!profile) {
      return json({ success: false, error: 'Device profile not found' }, { status: 404 });
    }

    // Verify all devices exist (admin can assign across accounts)
    const devices = await locals.prisma.device.findMany({
      where: {
        id: { in: deviceIds },
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

    const response = await fetch(`/api/device-profiles/${profileId}/assign`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            deviceIds
        })
    });

    if (!response.ok) {
        const data = await response.json();
        console.error('Error broadcasting device profile settings: ', data);
    }

    return json({
      success: true,
      message: `Successfully assigned ${result.count} devices`,
      assignedCount: result.count
    });

  } catch (error) {
    return errorHandler(error);
  }
};
