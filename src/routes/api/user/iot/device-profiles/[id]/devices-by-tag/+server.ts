import { json } from '@sveltejs/kit';
import { errorHandler } from '$lib/server/errors/errorHandler';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, locals, url }) => {
  try {
    const auth = await locals.auth.validate();
    if (!auth?.user) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: profileId } = params;
    const tagId = url.searchParams.get('tagId');

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
        id: true,
        name: true,
        deviceType: true,
        macAddress: true,
        status: true
      }
    });

    return json({
      success: true,
      devices,
      count: devices.length
    });

  } catch (error) {
    return errorHandler(error);
  }
};
