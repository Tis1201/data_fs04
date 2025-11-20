import type { PrismaClient } from '@prisma/client';
import { registerRpcClient } from '../index';
import { handleClaimDevice } from './handle_claim_device';
import { handleScreenshotDevice } from './handle_screenshot_device';

/********************************************************************************************
 * Register web-side MQTT RPC handlers for user topics (user/<subject>/...).
 ********************************************************************************************/
export function registerWebHandlers(prisma: PrismaClient): void {
    registerRpcClient(
        'User',
        'user/',
        {
            'device.claim': handleClaimDevice,
            'device.screenshot': handleScreenshotDevice
        },
        prisma
    );
}
