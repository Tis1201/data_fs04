import { json } from '@sveltejs/kit';
import { errorHandler } from '$lib/server/errors/errorHandler';
import type { RequestHandler } from './$types';

export const DELETE: RequestHandler = async ({ params, locals }) => {
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

    if (!profileId) {
      return json({ success: false, error: 'Profile ID is required' }, { status: 400 });
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

    // Get all devices currently assigned to this profile
    const assignedDevices = await locals.prisma.device.findMany({
      where: {
        profileAssignment: {
          profileId: profileId
        }
      },
      select: {
        id: true
      }
    });

    if (assignedDevices.length === 0) {
      return json({ 
        success: true, 
        message: 'No devices were assigned to this profile',
        unassignedCount: 0 
      });
    }

    // Delete all profile assignments for this profile
    const result = await locals.prisma.deviceProfileAssignment.deleteMany({
      where: {
        profileId: profileId
      }
    });

    return json({
      success: true,
      message: `Successfully unassigned ${result.count} devices`,
      unassignedCount: result.count
    });

  } catch (error) {
    return errorHandler(error);
  }
};
