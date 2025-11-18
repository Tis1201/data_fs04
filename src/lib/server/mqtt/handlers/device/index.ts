import { type PrismaClient } from '@prisma/client';
import { registerRpcClient } from '../index';
import { handleGetPin } from './handle_get_pin';

export function registerDeviceHandlers(prisma: PrismaClient): void {
    registerRpcClient(
        'Device',
        'device/',
        {
            ping: async (params) => ({ message: `pong: ${params?.message || ''}` }),
            echo: async (params) => params || {},
            add: async (params) => {
                const a = Number(params?.a) || 0;
                const b = Number(params?.b) || 0;
                return { sum: a + b };
            },
            'get.pin': handleGetPin
        },
        prisma
    );
}
