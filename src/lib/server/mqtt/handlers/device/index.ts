import { type PrismaClient } from '@prisma/client';
import { registerRpcClient } from '../index';
import { handleGetPin } from './handle_get_pin';
import { handleClaimConfirm } from './handle_claim_confirm';

/********************************************************************************************
 * Register device-side RPC handlers for factory and claimed topics.
 ********************************************************************************************/
export function registerDeviceHandlers(prisma: PrismaClient): void {
    registerRpcClient(
        'Device',
        'device/',
        {
            ping: async (params, args) => ({ message: `pong: ${params?.message || ''}` }),
            echo: async (params, args) => params || {},
            add: async (params, args) => {
                const a = Number(params?.a) || 0;
                const b = Number(params?.b) || 0;
                return { sum: a + b };
            },
            'get.pin': async (params, args) => handleGetPin({ ...args, params }),
            'device.claim.confirm': async (params, args) => handleClaimConfirm(params, args)
        },
        prisma
    );
}
