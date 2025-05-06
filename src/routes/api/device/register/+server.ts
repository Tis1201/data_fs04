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
import { sseManager } from '$lib/server/sse';
import { logger } from '$lib/server/logger';
import { checkPinFormat } from '$lib/server/device/devicePinChecker';
import type { DeviceMeta } from '$lib/server/device/deviceMeta';
import { v4 as uuidv4 } from 'uuid';
import type { ConnectionMeta } from '$lib/server/messaging/interfaces/connection';
import { SSEConnection } from '$lib/server/messaging/connections/sse_connection';
import { DeviceManager } from '$lib/server/device/deviceManager';
import { ConnectionManager } from '$lib/server/messaging/core/connectionManager';

////Device
//Device will then disconnect which cases the subscription to disappear
//Device will call device/registered to information that user has been successful reigstered including os, model, and other device information
//RoutingMessage will be sent to scope: "user:userId" to inform of device e.g. all connection belonging to user will receive this message
//Device will then connect to device/listen with the API Key

export const GET: RequestHandler = async ({ params, locals, request }) => {

    const pin = request.headers.get('X-Device-PIN');

    if (!pin) {
        logger.warn('No PIN provided');
        return json({ error: 'No PIN provided' }, { status: 400 });
    }

    if (!checkPinFormat(pin)) {
        logger.warn('Invalid PIN format');
        return json({ error: 'Invalid PIN format' }, { status: 400 });
    }

    logger.debug(`PIN: ${pin}`);

    //TODO: Verify Factory JWT Token

    const stream = new ReadableStream({
        start(controller) {
            logger.debug('SSE connection established');

            const deviceId = uuidv4();
            // const deviceMeta: DeviceMeta = {
            //     id: deviceId,
            //     connectionId: sseManager.getConnectionId(),
            // }
            const connectionMeta: ConnectionMeta = {
                userInfo: {
                    id: 'admin-1',
                    email: 'admin@admin.com',
                    name: 'Admin User',
                    systemRole: 'ADMIN',
                    source: 'session'
                },
                nodeId: 'node-1',
                protocol: 'sse',
                connectedAt: Date.now(),
            };

            const connection = new SSEConnection(connectionMeta, controller);
            ConnectionManager.registerConnection(connection);

            logger.debug(`SSE connection established: ${connectionMeta.id}`);

            const deviceMeta: DeviceMeta = {
                id: deviceId,
                connectionId: connectionMeta.id,
            };

            DeviceManager.registerDevice(pin, deviceMeta);

        },

        cancel() {
            logger.debug('SSE connection closed');
        }

    });

    // Return the SSE response
    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive'
        }
    });
}

