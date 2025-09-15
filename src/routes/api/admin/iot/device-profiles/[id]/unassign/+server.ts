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
        accountId: true
      }
    });

    if (!profile) {
      return json({ error: 'Device profile not found' }, { status: 404 });
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
      return json({ error: 'Access denied' }, { status: 403 });
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
