import { json } from '@sveltejs/kit';
import { DeviceManager } from '$lib/server/device/deviceManager';
import { logger } from '$lib/server/logger';
import { generateId } from 'lucia';
import type { RequestHandler } from './$types';

/**
 * API endpoint for adding a new device
 * This endpoint is used by devices to register themselves with the system
 * 
 * Sample request data:
 * {
 *   "deviceType": "dummy",
 *   "model": "arm64",
 *   "manufacturer": "Dummy Devices Inc.",
 *   "osVersion": "Darwin 24.4.0",
 *   "firmwareVersion": "1.0.0",
 *   "hardwareId": "53:4d:37:df:7c:f1",
 *   "wifiMac": "53:4d:37:df:7c:f1",
 *   "lanMac": "53:4d:37:df:7c:f1",
 *   "ipAddress": "192.168.0.125",
 *   "publicIpAddress": "180.129.48.239",
 *   "additionalInfo": {
 *     "cpuCores": 8,
 *     "totalMemory": 25769803776,
 *     "diskUsage": 76.3
 *   }
 * }
 */
export const POST: RequestHandler = async ({ request, locals }) => {
    try {
        const data = await request.json();

        // Extract device information from the request
        const {
            deviceType,
            model,
            manufacturer,
            osVersion,
            firmwareVersion,
            hardwareId,
            wifiMac,
            lanMac,
            ipAddress,
            publicIpAddress,
            additionalInfo,
            pin,
            id
        } = data;

        // Validate required fields
        if (!pin || !id) {
            return json({
                success: false,
                error: 'PIN and device ID are required',
                message: 'Missing required fields'
            }, { status: 400 });
        }

        // Print the data
        logger.debug(`Data: ${JSON.stringify(data)}`);

        const device: any = await DeviceManager.addDevice(data, locals.prisma);

        logger.debug(`Device registered successfully: ${device.id}`);
``
        return json({
            success: true,
            deviceId: device.id,
            deviceApiKey: device.apiKey,
            message: 'Device registered successfully'
        });
    } catch (error:any) {
        logger.error(`Device registration failed: ${error}`);
        
        return json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error occurred',
            message: 'Device registration failed'
        }, { status: error.status || 500 });
    }
};
