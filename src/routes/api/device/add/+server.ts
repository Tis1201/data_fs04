import { json } from '@sveltejs/kit';
import { generateId } from 'lucia';
import { logger } from '$lib/server/logger';
import { getEnhancedPrisma } from '$lib/server/prisma';
import { SystemUser } from '$lib/server/messaging/interfaces/message';

import { restrict_device } from '$lib/server/security/guards';
import type { DeviceAuthEvent, DeviceAuthResult } from '$lib/server/security/guards';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }: any) => {

    const prisma = getEnhancedPrisma({ id: '', systemRole: 'ADMIN' });
        
    const data = await request.json();

    logger.debug(`Entry to api/device/add Data: ${JSON.stringify(data)}`);

    // Check if this is a device registration (no auth required)
    const isRegistration = data.pin && data.id && !request.headers.get('x-api-key');

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
        id,
        senderConnectionId,
        senderId,
        // Handle Go device service field names
        SenderID,
        SenderConnectionID
    } = data;

    // Extract MAC from nested network info if present
    const networkMac: string | undefined = data?.networkInfo?.mac;
    // Normalize MAC fields: prefer explicit macAddress, else networkMac, else wifiMac
    const macAddress: string | undefined = data?.macAddress ?? networkMac ?? wifiMac;
    // Ensure wifiMac is filled if missing but we have a MAC
    const resolvedWifiMac: string | undefined = wifiMac ?? macAddress;

    // Validate required fields
    if (!pin || !id) {
        return json({
            success: false,
            error: 'PIN and device ID are required',
            message: 'Missing required fields'
        }, { status: 400 });
    }

    // Determine the user ID to use for the device (handle both field names)
    const userId = senderId || SenderID;

    if (!userId) {
        return json({
            success: false,
            error: 'User ID is required',
            message: 'User authentication failed'
        }, { status: 401 });
    }

    // Get the user to check account membership
    const user = await prisma.user.findUnique({
        where: { id: userId }
    });

    if (!user) {
        return json({
            success: false,
            error: 'User not found',
            message: 'User authentication failed'
        }, { status: 404 });
    }

    // const accountId = user.memberships[0]?.accountId;

    // Save the device to the database
    const device = await prisma.device.update({
        where: { id },
        data: {
            deviceType,
            model,
            manufacturer,
            osVersion,
            firmwareVersion,
            hardwareId,
            macAddress,
            wifiMac: resolvedWifiMac,
            lanMac,
            ipAddress,
            publicIpAddress,
            additionalInfo,
            // updatedAt
        }
    });

    logger.debug(`Device registered successfully: ${device.id}`);

    // Prepare the success response
    const responseData = {
        success: true,
        requestId: id // Use the device ID as the request ID for tracking
    };

    // // If we have a sender connection ID, send a message back to the device
    // if (senderConnectionId) {
    //     try {
    //         // Create a success message to send back to the device
    //         const successMessage = {
    //             type: isRegistration ? 'device.registered' : 'device.updated',
    //             ...responseData
    //         };

    //         // Send the message back to the device using the connection manager
    //         await connectionManager.sendToConnection(senderConnectionId, successMessage);
    //         logger.debug(`Sent device ${isRegistration ? 'registration' : 'update'} success message to connection ${senderConnectionId}`);
    //     } catch (error) {
    //         logger.error(`Failed to send success message: ${error.message}`);
    //         // Don't fail the operation if we can't send the message
    //     }
    // }

    // Return success response
    return json(responseData);

};
