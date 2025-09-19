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

    // Check if profile exists and user has access
    const profile = await locals.prisma.deviceProfile.findUnique({
      where: { id: profileId },
      select: { 
        id: true, 
        name: true,
        accountId: true
      }
    });

    if (!profile) {
      return json({ error: 'Device profile not found' }, { status: 404 });
    }

    // Check permissions (user context - must be OWNER, ADMIN, or MEMBER of the account)
    const hasAccess = await locals.prisma.accountMembership.findFirst({
      where: {
        accountId: profile.accountId,
        userId: auth.user.id,
        role: { in: ['OWNER', 'ADMIN', 'MEMBER'] }
      }
    });

    if (!hasAccess) {
      return json({ error: 'Access denied' }, { status: 403 });
    }

    // Verify all devices exist and belong to the same account
    const devices = await locals.prisma.device.findMany({
      where: {
        id: { in: deviceIds },
        accountId: profile.accountId
      },
      select: {
        id: true,
        name: true,
        deviceType: true
      }
    });

    if (devices.length !== deviceIds.length) {
      return json({ 
        error: 'Some devices not found or do not belong to your account' 
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
