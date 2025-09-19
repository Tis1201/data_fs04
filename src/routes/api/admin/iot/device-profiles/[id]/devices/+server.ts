import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { errorHandler } from '$lib/server/errors/errorHandler';

export const GET: RequestHandler = async ({ params, url, locals }) => {
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
    const search = url.searchParams.get('search');
    const deviceType = url.searchParams.get('deviceType');
    const tagId = url.searchParams.get('tagId');
    const status = url.searchParams.get('status');
    const limit = parseInt(url.searchParams.get('limit') || '100');
    const offset = parseInt(url.searchParams.get('offset') || '0');

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

    // Build where clause for devices
    const where: any = {
      status: 'ACTIVE'
    };

    // Search filter
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { macAddress: { contains: search, mode: 'insensitive' } },
        { deviceType: { contains: search, mode: 'insensitive' } },
        { status: { contains: search, mode: 'insensitive' } }
      ];
    }

    // Device type filter
    if (deviceType && deviceType !== 'all') {
      where.deviceType = deviceType;
    }

    // Tag filter
    if (tagId && tagId !== 'all') {
      where.tags = {
        some: {
          id: tagId
        }
      };
    }

    // Status filter (assigned/available)
    if (status === 'assigned') {
      where.profileAssignment = {
        isNot: null
      };
    } else if (status === 'available') {
      where.profileAssignment = null;
    }

    // Get devices with their current profile assignments
    const devices = await locals.prisma.device.findMany({
      where,
      select: {
        id: true,
        name: true,
        description: true,
        deviceType: true,
        status: true,
        macAddress: true,
        connected: true,
        createdAt: true,
        tags: {
          select: {
            id: true,
            name: true,
            description: true
          }
        },
        profileAssignment: {
          select: {
            id: true,
            status: true,
            assignedAt: true,
            profile: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset
    });

    // Filter devices by specific profile if status is 'assigned'
    let filteredDevices = devices;
    let totalCount = await locals.prisma.device.count({ where });

    console.log("where", where)
    console.log("totalCount", totalCount)

    if (status === 'assigned') {
      filteredDevices = devices.filter(device => 
        device.profileAssignment?.profile?.id === profileId
      );
      
      // Get the correct total count for assigned devices
      const assignedWhere = { ...where };
      assignedWhere.profileAssignment = {
        isNot: null
      };
      const allAssignedDevices = await locals.prisma.device.findMany({
        where: assignedWhere,
        select: {
          id: true,
          profileAssignment: {
            select: {
              profile: {
                select: {
                  id: true
                }
              }
            }
          }
        }
      });
      totalCount = allAssignedDevices.filter(device => 
        device.profileAssignment?.profile?.id === profileId
      ).length;
    }

    return json({
      success: true,
      devices: filteredDevices,
      total: totalCount,
      pagination: {
        limit,
        offset,
        hasMore: offset + limit < totalCount
      }
    });

  } catch (error) {
    return errorHandler(error);
  }
};
