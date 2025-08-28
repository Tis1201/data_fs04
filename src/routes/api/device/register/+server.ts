//SSE Connection passing in Factory JWT Token and Generated PIN
//Verify JWT Token and PIN format and strength
//Create a UUID for the device
//Store a PIN to Device UUID mapping using DeviceManager (transient)
//Create a subscription for the device 
//Create subscription:device:uuid to subscriber:connection:uuid   
//If SSE disconnected, remove this subscription and PIN_UUID mappings
//Wait for User to Claim Device
//When User claims device, update DeviceManager with User ID
//Send message to subscription:device:uuid to subscriber:user:userId to notify device that is claimed
//Message contains userInfo, api_key, and the device_id
//On Received, Device will store this information in a secure location

import { json } from '@sveltejs/kit';
import type { RequestHandler } from '../../$types';
import { logger } from '$lib/server/logger';
import { checkPinFormat } from '$lib/server/device/devicePinChecker';
import type { DeviceMeta } from '$lib/server/device/deviceMeta';
import { v4 as uuidv4 } from 'uuid';
import type { ConnectionMeta } from '$lib/server/messaging/interfaces/connection';
import { DeviceManager } from '$lib/server/device/deviceManager';
import { createSSEHandler } from '$lib/server/sse/device/sseHandler';
import { 
    ResponseStatus,
    ResponseCategory,
    createErrorResponse,
    toResponse
} from '$lib/shared/response_format';
import { verifyFactoryJWT } from '$lib/server/device/deviceJWTChecker';

////Device
//Device will then disconnect which cases the subscription to disappear
//Device will call device/registered to information that user has been successful reigstered including os, model, and other device information
//RoutingMessage will be sent to scope: "user:userId" to inform of device e.g. all connection belonging to user will receive this message
//Device will then connect to device/listen with the API Key

/**
 * Device registration endpoint using SSE for real-time communication
 * Handles PIN validation and device registration
 */
export const GET = createSSEHandler({
    /**
     * Authenticate the device registration request
     */
    authenticate: async (locals, request) => {
        // Verify Factory JWT (signature, audience, typ, scope)
        await verifyFactoryJWT(locals, request);


        //We will need to check if the device is already registered, if yes, return error, need to unclaim first
        //We will also check if device has a preclaim (non-expired) against it
        //If yes, we will have to short cut the pin registration process

        // Validate the PIN
        const pin = request.headers.get('X-Device-PIN');

        const mac = request.headers.get('X-Device-MAC');

        logger.debug(`X-Device-MAC: ${mac}`);
        
        if (!pin) {
            logger.warn('No PIN provided');
            throw toResponse(createErrorResponse({
                error: 'ValidationError',
                message: 'No PIN provided',
                status: ResponseStatus.BAD_REQUEST,
                category: ResponseCategory.DEVICE
            }));
        }
        
        if (!checkPinFormat(pin)) {
            logger.warn('Invalid PIN format');
            throw toResponse(createErrorResponse({
                error: 'ValidationError',
                message: 'Invalid PIN format',
                status: ResponseStatus.BAD_REQUEST,
                category: ResponseCategory.DEVICE
            }));
        }
        
        logger.debug(`PIN: ${pin}`);
        
        //TODO: Verify Factory JWT Token
        
        // Generate a new device ID
        const deviceId = uuidv4();
        
        // Create a temporary device object
        const device = { id: deviceId };
        
        // Create connection metadata
        const connectionMeta: Omit<ConnectionMeta, 'id' | 'connectedAt'> = {
            userInfo: {
                id: 'admin-device',
                email: 'admin@admin.com',
                name: 'Admin User',
                systemRole: 'ADMIN',
                source: 'session'
            },
            nodeId: 'device-register',
            protocol: 'sse',
            deviceId: deviceId
        };
        
        // Store the PIN in locals so it can be accessed in onConnect
        locals.pin = pin;
        
        // Return the required data
        return { 
            connectionMeta, 
            device
        };
    },
    
    /**
     * Handle connection established event
     */
    onConnect: async ({ connectionId, device, locals }) => {
        logger.debug(`Device registration SSE connection established: ${connectionId}`);
        
        // Create device metadata with the connection ID
        const deviceMeta: DeviceMeta = {
            id: device.id,
            connectionId: connectionId,
        };
        
        // Register the device with the PIN
        const pin = locals.pin as string;
        DeviceManager.registerDevice(pin, deviceMeta);
        
        logger.info(`Device ${device.id} registered with PIN ${pin}`);
    },
    
    /**
     * Handle connection closed event
     */
    onDisconnect: async ({ connectionId, device, locals }) => {
        logger.debug(`Device registration SSE connection closed: ${connectionId}`);
        // Additional cleanup if needed
    },
    
    // Don't update device status in database for registration connections
    updateDeviceStatus: false
});

