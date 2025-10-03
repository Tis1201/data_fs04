import { error } from '@sveltejs/kit';
import { restrict } from '$lib/server/security/guards';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = restrict(
  async ({ params, locals, auth }) => {
    const { id: deviceId } = params;
    const { prisma } = locals;

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
