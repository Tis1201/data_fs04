import { logger } from '$lib/server/logger';
import type { RpcHandlerArgs } from '../index';
import { resolveDeviceClaimContextFromTicket } from '../../core/claims';

interface DeviceClaimConfirmParams {
    ticket?: string;
    result?: Record<string, unknown>;
}

export async function handleClaimConfirm(
    params: DeviceClaimConfirmParams,
    { topic, sub, prisma }: RpcHandlerArgs
): Promise<{ status: string }> {
    const { ticket } = params;

    if (!ticket) {
        throw new Error('Missing ticket');
    }

    const ctx = await resolveDeviceClaimContextFromTicket({ prisma, ticket, topic });

    console.log(ctx);

    logger.info(
        `[DeviceClaimConfirm] Received claim confirmation from ${sub ?? 'unknown'} on topic ${topic} for user ${ctx.user.id} account ${ctx.account?.id ?? 'n/a'} and factoryDevice ${ctx.factoryDevice.id} with claims ${JSON.stringify(
            ctx.ticket
        )}`
    );

    // For now we just acknowledge receipt. Full claim logic (creating device, API key, etc.)
    // will be implemented separately using the verified ticket and device identity.
    return { status: 'received' };
}
