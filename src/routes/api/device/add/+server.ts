import { json } from '@sveltejs/kit';
import { logger } from '$lib/server/logger';
import {
    ResponseStatus,
    ResponseCategory,
    createErrorResponse,
    toResponse
} from '$lib/shared/response_format';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }: any) => {
    // Use locals.prisma per convention
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
    // Use original MAC format for device storage: prefer explicit macAddress, else networkMac, else wifiMac
    const macAddress: string | undefined = data?.macAddress ?? networkMac ?? wifiMac;
    // Ensure wifiMac is filled if missing but we have a MAC
    const resolvedWifiMac: string | undefined = wifiMac ?? macAddress;

    // Validate required fields
    if (!pin || !id) {
        throw toResponse(createErrorResponse({
            error: 'ValidationError',
            message: 'PIN and device ID are required',
            status: ResponseStatus.BAD_REQUEST,
            category: ResponseCategory.DEVICE
        }));
    }

    // Determine the user ID to use for the device (handle both field names)
    const userId = senderId || SenderID;

    if (!userId) {
        throw toResponse(createErrorResponse({
            error: 'ValidationError',
            message: 'User ID is required',
            status: ResponseStatus.UNAUTHORIZED,
            category: ResponseCategory.DEVICE
        }));
    }

    // Get the user to check account membership
    const user = await locals.prisma.user.findUnique({
        where: { id: userId }
    });

    if (!user) {
        throw toResponse(createErrorResponse({
            error: 'NotFound',
            message: 'User not found',
            status: ResponseStatus.NOT_FOUND,
            category: ResponseCategory.DEVICE
        }));
    }

    // const accountId = user.memberships[0]?.accountId;

    // Save the device to the database
    const device = await locals.prisma.device.update({
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
