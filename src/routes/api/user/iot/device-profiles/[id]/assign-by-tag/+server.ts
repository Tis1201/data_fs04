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
    const { tagId } = await request.json();

    if (!profileId) {
      return json({ success: false, error: 'Profile ID is required' }, { status: 400 });
    }

    if (!tagId) {
      return json({ success: false, error: 'Tag ID is required' }, { status: 400 });
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
        role: { in: ['OWNER', 'ADMIN', 'MEMBER'] }
      }
    });

    if (!hasAccess && auth.user.systemRole !== 'ADMIN') {
      return json({ success: false, error: 'Access denied' }, { status: 403 });
    }

    // Get devices with the specified tag that are available for assignment
    const devices = await locals.prisma.device.findMany({
      where: {
        accountId: profile.accountId,
        tags: {
          some: {
            id: tagId
          }
        },
        profileAssignment: null // Only get devices that are not already assigned
      },
      select: {
        id: true
      }
    });

    if (devices.length === 0) {
      return json({ 
        success: true, 
        message: 'No available devices with this tag to assign',
        assignedCount: 0 
      });
    }

    // Create assignments for all available devices with this tag
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

    const deviceIds = devices.map(device => device.id);
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
      message: `Successfully assigned ${result.count} devices with this tag`,
      assignedCount: result.count
    });

  } catch (error) {
    return errorHandler(error);
  }
};
