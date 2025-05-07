import { json } from '@sveltejs/kit';
import { DeviceManager } from '$lib/server/device/deviceManager';
import { logger } from '$lib/server/logger';
import { generateId } from 'lucia';
import type { RequestHandler } from './$types';
import { MessageDispatcher } from '$lib/server/messaging/core/dispatcher';
import type { UserInfo } from '$lib/server/types/user';
import { userInfoByUserId } from '$lib/server/security/auth-utils';

export const POST: RequestHandler = async ({ request, locals }) => {

    const apiKey = request.headers.get('x-api-key');

    if (!apiKey) {
        return json({
            success: false,
            error: 'API key is required',
            message: 'Missing API key'
        }, { status: 401 });
    }

    const prisma = locals.prisma;

    //Find device by apiKey
    const device = await prisma.device.findFirst({
        where: { apiKey },
        include: {
            user: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                    systemRole: true
                }
            }
        }
    });


    if (!device || device.status !== 'ACTIVE') {
        return json({
            success: false,
            error: 'Device not found or not active',
            message: 'Device not found or not active'
        }, { status: 404 });
    }

    logger.debug('Device message received');

    const data = await request.json();

    logger.debug(`Data: ${JSON.stringify(data)}`);

    const userInfo:UserInfo | null = await userInfoByUserId(device.user.id);

    if (!userInfo) {
        return json({
            success: false,
            error: 'User not found',
            message: 'User not found'
        }, { status: 404 });
    }

    data.payload.deviceId = device.id;
    data.userInfo = userInfo;

    MessageDispatcher.dispatch(data);
    
    return json({
        success: true,
        message: 'Device message received successfully'
    });

}