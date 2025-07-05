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
        senderId
    } = data;

    // Validate required fields
    if (!pin || !id) {
        return json({
            success: false,
            error: 'PIN and device ID are required',
            message: 'Missing required fields'
        }, { status: 400 });
    }

    // Determine the user ID to use for the device
    const userId = senderId

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

    const accountId = user.memberships[0]?.accountId;

    // Save the device to the database
    const device = await prisma.device.upsert({
        where: { id },
        update: {
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
            status: 'ACTIVE',
            claimedAt: new Date(),
            claimedBy: userId,
            user: {
                connect: { id: userId }
            },
            ...(accountId && {
                account: {
                    connect: { id: accountId }
                }
            })
        },
        create: {
            id,
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
            status: 'ACTIVE',
            claimedAt: new Date(),
            claimedBy: userId,
            user: {
                connect: { id: userId }
            },
            ...(accountId && {
                account: {
                    connect: { id: accountId }
                }
            })
        }
    });

    logger.debug(`Device registered successfully: ${device.id}`);

    // For new registrations, generate an API key and send it back
    let apiKey = device.apiKey;
    if (isRegistration) {
        apiKey = generateId(40);
        const apiKeyCreatedAt = new Date();

        // Update the device with the new API key
        await prisma.device.update({
            where: { id: device.id },
            data: { apiKey }
        });
    }

    // Prepare the success response
    const responseData = {
        success: true,
        deviceId: device.id,
        deviceName: device.name || `Device ${device.id.substring(0, 8)}`,
        message: isRegistration ? 'Device registered successfully' : 'Device updated successfully',
        timestamp: new Date().toISOString(),
        requestId: id // Use the device ID as the request ID for tracking
    };

    // If this is a registration, include the API key in the response
    if (isRegistration) {
        responseData.apiKey = apiKey;
    }

    // If we have a sender connection ID, send a message back to the device
    if (senderConnectionId) {
        try {
            // Create a success message to send back to the device
            const successMessage = {
                type: isRegistration ? 'device.registered' : 'device.updated',
                ...responseData
            };

            // Send the message back to the device using the connection manager
            await connectionManager.sendToConnection(senderConnectionId, successMessage);
            logger.debug(`Sent device ${isRegistration ? 'registration' : 'update'} success message to connection ${senderConnectionId}`);
        } catch (error) {
            logger.error(`Failed to send success message: ${error.message}`);
            // Don't fail the operation if we can't send the message
        }
    }

    // Return success response
    return json(responseData);

};
