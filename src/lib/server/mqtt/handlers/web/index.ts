import type { PrismaClient } from '@prisma/client';
import { registerRpcClient } from '../index';
import { handleClaimDevice } from './handle_claim_device';

/**
 * Register web-side MQTT RPC handlers.
 *
 * Web clients use topics of the form:
 *   user:<id>/requests
 *   user:<id>/response
 *
 * We register an RPC client with an empty prefix so all subjects are
 * matched, and we rely on the JWT subject (sub) as the client identifier.
 */
export function registerWebHandlers(prisma: PrismaClient): void {
    registerRpcClient(
        'User',
        'user/',
        {
            'user.claim.device': handleClaimDevice
        },
        prisma
    );
}
