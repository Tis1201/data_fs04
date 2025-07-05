import { json } from '@sveltejs/kit';
import { DeviceManager } from '$lib/server/device/deviceManager';
import { logger } from '$lib/server/logger';
import { generateId } from 'lucia';
import type { RequestHandler } from './$types';
import { MessageDispatcher } from '$lib/server/messaging/core/dispatcher';
import type { UserInfo } from '$lib/server/types/user';
import { userInfoByUserId } from '$lib/server/security/auth-utils';
import { restrict_device } from '$lib/server/security/guards';

export const POST: RequestHandler = async ({ request, locals }) => {
    const result = await restrict_device({ locals, request });
    
    if ('error' in result) {
        return json({
            success: false,
            error: result.error,
            message: result.error
        }, { status: result.response.status });
    }
    
    const { device } = result;
    
    if (device.status !== 'ACTIVE') {
        return json({
            success: false,
            error: 'Device not active',
            message: 'Device not active'
        }, { status: 404 });
    }

    logger.debug('Device message received');

    const data = await request.json();

    logger.debug(`-->: ${JSON.stringify(data)}`);

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