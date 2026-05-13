import { type PrismaClient } from '@prisma/client';
import { registerRpcClient } from '../index';
import { handleGetPin } from './claim/handle_get_pin';
import { handleClaimConfirm } from './claim/handle_claim_confirm';
import { handleDataReady } from './handle_data_ready';

/********************************************************************************************
 * Register device-side RPC handlers for factory and claimed topics.
 ********************************************************************************************/
export function registerDeviceHandlers(prisma: PrismaClient): void {
    // Register handlers for claimed devices (device/ topic)
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
            'device.claim.confirm': async (params, args) => handleClaimConfirm(params, args),
            'device.dataReady': async (params, args) => handleDataReady(params, args)
        },
        prisma
    );

    // Register handlers for factory devices (factory/ topic)
    registerRpcClient(
        'FactoryDevice',
        'factory/',
        {
            ping: async (params, args) => ({ message: `pong: ${params?.message || ''}` }),
            'get.pin': async (params, args) => handleGetPin({ ...args, params }),
        },
        prisma
    );
}
