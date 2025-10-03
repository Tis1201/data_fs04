import { verifyFactoryJWT } from '$lib/server/device/deviceJWTChecker';
import { checkPinFormat } from '$lib/server/device/devicePinChecker';
import { DeviceManager } from '$lib/server/device/deviceManager';
import { logger } from '$lib/server/logger';
import type { RequestHandler } from './$types';
import type { DeviceMeta } from '$lib/server/device/deviceMeta';
import { v4 as uuidv4 } from 'uuid';
import {
    createErrorResponse,
    ResponseCategory,
    ResponseStatus,
    toResponse
} from '$lib/shared/response_format';

/**
 * Pushpin device registration endpoint for Pushpin proxy.
 */
export const GET: RequestHandler = async ({ locals, request }) => {

    return new Response(JSON.stringify({
        status: ResponseStatus.SUCCESS,
        data: {
            status: 'UNCLAIMED'
        }
    })+"\n", {
        headers: {
            'Content-Type': 'text/event-stream',  // Changed from application/json
            'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
            'Surrogate-Control': 'no-store',
            'X-Accel-Buffering': 'no',  // Disable nginx buffering
            // GRIP headers for Pushpin streaming
            'Grip-Hold': 'stream',
            'Grip-Channel': `registration:123456`,
            'Grip-Keep-Alive': ':\n\n',
            'Grip-Timeout': '60'
        }
    });

    // try {

        /*
        await verifyFactoryJWT(locals, request);

        logger.info(`Factory JWT verified successfully`);

        const pin = request.headers.get('X-Device-PIN');
        const mac = request.headers.get('X-Device-MAC');

        if (!pin) {
            throw toResponse(createErrorResponse({
                error: 'ValidationError',
                message: 'No PIN provided',
                status: ResponseStatus.BAD_REQUEST,
                category: ResponseCategory.DEVICE
            }));
        }

        if (!checkPinFormat(pin)) {
            throw toResponse(createErrorResponse({
                error: 'ValidationError',
                message: 'Invalid PIN format',
                status: ResponseStatus.BAD_REQUEST,
                category: ResponseCategory.DEVICE
            }));
        }

        // Create device identity for this registration
        const deviceId = uuidv4();
        const connectionId = `pushpin-${Date.now()}`;

        const deviceMeta: DeviceMeta = {
            id: deviceId,
            connectionId,
            macAddress: mac || undefined,
            wifiMac: mac || undefined
        };

        // Register the device with the provided PIN
        await DeviceManager.registerDevice(pin, deviceMeta);

        return new Response(JSON.stringify({
            status: ResponseStatus.SUCCESS,
            data: {
                deviceId,
                pin,
                status: 'UNCLAIMED'
            }
        }), {
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0',
                'Surrogate-Control': 'no-store',
                // GRIP headers for Pushpin streaming
                'Grip-Hold': 'stream',
                'Grip-Channel': `registration:${deviceId}`,
                'Grip-Keep-Alive': ':\n\n',
                'Grip-Timeout': '60'
            }
        });
    } catch (error: any) {
        if (error instanceof Response) {
            return error;
        }

        logger.error(`Error in pushpin register: ${error}`);
        return new Response(JSON.stringify({
            status: ResponseStatus.ERROR,
            error: 'InternalServerError',
            message: 'An error occurred during registration'
        }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json'
            }
        });
    }
    */
};