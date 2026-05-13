import { error } from '@sveltejs/kit';
import { restrict, type AuthenticatedLoadEvent } from '$lib/server/security/guards';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = restrict(
  async (event: AuthenticatedLoadEvent) => {
    const { params, locals, auth } = event;
    const { id: deviceId } = params;
    const { prisma } = locals;

    if (!auth?.user) {
      throw error(401, 'Unauthorized');
    }

    // Check if device exists and user has access
    const device = await prisma.device.findUnique({
      where: { id: deviceId },
      include: {
        account: {
          select: {
            members: {
              where: { userId: auth.user.id },
              select: { role: true }
            }
          }
        }
      }
    });

    if (!device) {
      throw error(404, 'Device not found');
    }

    // Check if user has permission to view this device
    const hasPermission = 
      auth.user.systemRole === 'ADMIN' ||
      device.account?.members?.[0]?.role === 'ADMIN' ||
      device.account?.members?.[0]?.role === 'MEMBER';

    if (!hasPermission) {
      throw error(403, 'You do not have permission to view this device');
    }

    return {
      deviceId,
      user: auth.user
    };
  },
  ['ADMIN', 'USER'] // Allow both admin and regular users
);
