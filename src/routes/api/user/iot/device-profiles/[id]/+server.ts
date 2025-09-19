import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { errorHandler } from '$lib/server/errors/errorHandler';

export const GET: RequestHandler = async ({ params, locals }) => {
  try {
    const auth = await locals.auth.validate();
    if (!auth?.user) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = params;

    // Get device profile with settings and assignments
    const profile = await locals.prisma.deviceProfile.findUnique({
      where: { id },
      include: {
        settings: {
          orderBy: { order: 'asc' }
        },
        assignments: {
          include: {
            device: {
              select: {
                id: true,
                name: true,
                deviceType: true,
                status: true
              }
            }
          }
        },
        account: {
          select: {
            id: true,
            name: true
          }
        },
        _count: {
          select: {
            assignments: true
          }
        }
      }
    });

    if (!profile) {
      return json({ error: 'Device profile not found' }, { status: 404 });
    }

    // Check if user has access to this profile (user context - no admin override)
    const hasAccess = await locals.prisma.accountMembership.findFirst({
      where: {
        accountId: profile.accountId,
        userId: auth.user.id
      }
    });

    if (!hasAccess) {
      return json({ error: 'Access denied' }, { status: 403 });
    }

    return json({
      success: true,
      profile
    });

  } catch (error) {
    return errorHandler(error);
  }
};

export const PUT: RequestHandler = async ({ params, request, locals }) => {
  try {
    const auth = await locals.auth.validate();
    if (!auth?.user) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = params;
    const body = await request.json();
    const { name, description, settings } = body;

    // Validate required fields
    if (!name || !settings || !Array.isArray(settings)) {
      return json({ error: 'Name and settings are required' }, { status: 400 });
    }

    // Check if profile exists and user has access
    const existingProfile = await locals.prisma.deviceProfile.findUnique({
      where: { id },
      select: { 
        id: true, 
        accountId: true,
        createdBy: true
      }
    });

    if (!existingProfile) {
      return json({ error: 'Device profile not found' }, { status: 404 });
    }

    // Check permissions (user context - must be OWNER or ADMIN of the account)
    const hasAccess = await locals.prisma.accountMembership.findFirst({
      where: {
        accountId: existingProfile.accountId,
        userId: auth.user.id,
        role: { in: ['OWNER', 'ADMIN', 'MEMBER'] }
      }
    });

    if (!hasAccess) {
      return json({ error: 'Access denied' }, { status: 403 });
    }

    // Update profile and settings in a transaction
    const updatedProfile = await locals.prisma.$transaction(async (tx) => {
      // Update profile
      const profile = await tx.deviceProfile.update({
        where: { id },
        data: {
          name,
          description,
          updatedBy: auth.user.id
        }
      });

      // Delete existing settings
      await tx.deviceProfileSetting.deleteMany({
        where: { profileId: id }
      });

      // Create new settings
      await tx.deviceProfileSetting.createMany({
        data: settings.map((setting: any, index: number) => ({
          profileId: id,
          key: setting.key,
          value: setting.value,
          dataType: setting.dataType,
          label: setting.label,
          category: setting.category,
          order: setting.order || index
        }))
      });

      // Return updated profile with settings
      return await tx.deviceProfile.findUnique({
        where: { id },
        include: {
          settings: {
            orderBy: { order: 'asc' }
          },
          account: {
            select: {
              id: true,
              name: true
            }
          },
        }
      });
    });

    return json({
      success: true,
      profile: updatedProfile
    });

  } catch (error) {
    return errorHandler(error);
  }
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
  try {
    const auth = await locals.auth.validate();
    if (!auth?.user) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = params;

    // Check if profile exists and user has access
    const existingProfile = await locals.prisma.deviceProfile.findUnique({
      where: { id },
      select: { 
        id: true, 
        accountId: true,
        _count: {
          select: {
            assignments: true
          }
        }
      }
    });

    if (!existingProfile) {
      return json({ error: 'Device profile not found' }, { status: 404 });
    }

    // Check permissions (user context - must be OWNER or ADMIN of the account)
    const hasAccess = await locals.prisma.accountMembership.findFirst({
      where: {
        accountId: existingProfile.accountId,
        userId: auth.user.id,
        role: { in: ['OWNER', 'ADMIN', 'MEMBER'] }
      }
    });

    if (!hasAccess) {
      return json({ error: 'Access denied' }, { status: 403 });
    }

    // Check if profile has active assignments
    if (existingProfile._count.assignments > 0) {
      return json({ 
        error: 'Cannot delete profile with active device assignments. Please remove all assignments first.' 
      }, { status: 400 });
    }

    // Delete profile (cascade will handle settings and assignments)
    await locals.prisma.deviceProfile.delete({
      where: { id }
    });

    return json({
      success: true,
      message: 'Device profile deleted successfully'
    });

  } catch (error) {
    return errorHandler(error);
  }
};
