import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { errorHandler } from '$lib/server/errors/errorHandler';

export const POST: RequestHandler = async ({ params, request, locals }) => {
  try {
    const auth = await locals.auth.validate();
    if (!auth?.user) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: profileId } = params;
    const body = await request.json();
    const { deviceIds } = body;

    // Validate required fields
    if (!deviceIds || !Array.isArray(deviceIds) || deviceIds.length === 0) {
      return json({ error: 'Device IDs are required' }, { status: 400 });
    }

    // Check if profile exists
    const profile = await locals.prisma.deviceProfile.findUnique({
      where: { id: profileId },
      select: { 
        id: true, 
        name: true
      }
    });

    if (!profile) {
      return json({ error: 'Device profile not found' }, { status: 404 });
    }

    // Admin users have full access
    if (auth.user.systemRole !== 'ADMIN') {
      return json({ error: 'Admin access required' }, { status: 403 });
    }

    // Verify all devices exist (admin can assign across accounts)
    const devices = await locals.prisma.device.findMany({
      where: {
        id: { in: deviceIds }
      },
      select: {
        id: true,
        name: true,
        deviceType: true
      }
    });

    if (devices.length !== deviceIds.length) {
      return json({ 
        error: 'Some devices not found' 
      }, { status: 400 });
    }

    // Check for existing assignments
    const existingAssignments = await locals.prisma.deviceProfileAssignment.findMany({
      where: {
        deviceId: { in: deviceIds }
      },
      select: {
        deviceId: true,
        profile: {
          select: {
            name: true
          }
        }
      }
    });

    if (existingAssignments.length > 0) {
      const conflictingDevices = existingAssignments.map(a => ({
        deviceId: a.deviceId,
        currentProfile: a.profile.name
      }));
      
      return json({ 
        error: 'Some devices already have profile assignments',
        conflictingDevices
      }, { status: 400 });
    }

    // Create assignments
    const assignments = await locals.prisma.deviceProfileAssignment.createMany({
      data: deviceIds.map(deviceId => ({
        profileId,
        deviceId,
        assignedBy: auth.user.id,
        status: 'PENDING'
      }))
    });

    return json({
      success: true,
      message: `Profile assigned to ${assignments.count} device(s)`,
      assignments: {
        count: assignments.count,
        deviceIds
      }
    });

  } catch (error) {
    return errorHandler(error);
  }
};

export const DELETE: RequestHandler = async ({ params, request, locals }) => {
  try {
    const auth = await locals.auth.validate();
    if (!auth?.user) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: profileId } = params;
    const body = await request.json();
    const { deviceIds } = body;

    // Validate required fields
    if (!deviceIds || !Array.isArray(deviceIds) || deviceIds.length === 0) {
      return json({ error: 'Device IDs are required' }, { status: 400 });
    }

    // Check if profile exists
    const profile = await locals.prisma.deviceProfile.findUnique({
      where: { id: profileId },
      select: { 
        id: true
      }
    });

    if (!profile) {
      return json({ error: 'Device profile not found' }, { status: 404 });
    }

    // Admin users have full access
    if (auth.user.systemRole !== 'ADMIN') {
      return json({ error: 'Admin access required' }, { status: 403 });
    }

    // Remove assignments
    const result = await locals.prisma.deviceProfileAssignment.deleteMany({
      where: {
        profileId,
        deviceId: { in: deviceIds }
      }
    });

    return json({
      success: true,
      message: `Profile unassigned from ${result.count} device(s)`,
      unassigned: {
        count: result.count,
        deviceIds
      }
    });

  } catch (error) {
    return errorHandler(error);
  }
};
