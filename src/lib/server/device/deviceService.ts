import { getAdminPrisma } from '$lib/server/prisma';
import { logger } from '$lib/server/logger';

const prisma = getAdminPrisma();

export const deviceService = {
  async getDeviceByApiKey(apiKey: string) {
    if (!apiKey) return null;
    try {
      const device = await prisma.device.findFirst({
        where: { apiKey },
        include: {
          account: true,
          user: true
        }
      });
      return device;
    } catch (error: any) {
      logger.error('deviceService.getDeviceByApiKey failed', { error: error?.message || String(error) });
      return null;
    }
  },

  async getDeviceById(deviceId: string) {
    if (!deviceId) return null;
    try {
      const device = await prisma.device.findUnique({
        where: { id: deviceId },
        include: {
          account: true,
          user: true
        }
      });
      return device;
    } catch (error: any) {
      logger.error('deviceService.getDeviceById failed', { error: error?.message || String(error), deviceId });
      return null;
    }
  }
};

export type DeviceService = typeof deviceService;


