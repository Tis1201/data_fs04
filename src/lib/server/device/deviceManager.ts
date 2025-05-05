import { pinSharedStore, deviceSharedStore } from './deviceSharedStore';
import type { DeviceMeta } from './deviceMeta';
import { logger } from '$lib/server/logger';
import { v4 as uuidv4 } from 'uuid';
// Import the WebSocket manager for broadcasting messages
import { WebSocketManager } from '$lib/server/websocket/WebSocketManager';
import type { UserInfo } from '../types/user';
import { publisher } from '$lib/server/messaging/core/publisher';
import { MessageFactory } from '$lib/server/messaging/interfaces/message';
import * as crypto from 'crypto';
import { generateId } from 'lucia';
import type { PrismaClient } from '@prisma/client';

// Mock database for device records (in a real app, this would be in Prisma)
const deviceRecords: Record<string, any> = {};

export class DefaultDeviceManager {
    /**
     * Register a new device with a PIN code
     */
    async registerDevice(pin: string, device: DeviceMeta, ttlSeconds: number = 3600): void {

        if (!device.id) {
            device.id = uuidv4();
        }

        const existingDevice = await pinSharedStore.getSingle(pin);

        if (existingDevice) {
            throw new Error(`PIN ${pin} is already in use by another device`);
        }

        logger.info(`Registering device with PIN ${pin}`, { deviceId: device.id });
        await pinSharedStore.addMember(pin, device);



        // Store device in our mock database
        // deviceRecords[device.id] = {
        //     id: device.id,
        //     name: `Device-${device.id.substring(0, 8)}`,
        //     deviceType: device.deviceType || 'OTHER',
        //     status: 'PENDING',
        //     createdAt: new Date(),
        //     updatedAt: new Date()
        // };
    }

    /**
     * Claim a device using its PIN code
     * @param pin The PIN code displayed on the device
     * @param userId The ID of the user claiming the device
     * @returns The claimed device or null if not found
     */
    async claimDevice(pin: string, userInfo: UserInfo, senderConnectionId: string, senderConnectionProtocol: string): Promise<any> {

        logger.info(`Attempting to claim device with PIN ${pin}`, { userId: userInfo.id });

        // Get device from PIN store
        const deviceMeta = await pinSharedStore.getSingle(pin);

        if (!deviceMeta || !deviceMeta.id) {
            logger.warn(`No device found with PIN ${pin}`);
            return null;
        }

        logger.info(`Found device with PIN ${pin}`, { deviceId: deviceMeta.id });

        // Update device metadata with claim info
        deviceMeta.claimedAt = new Date();
        deviceMeta.claimedById = userInfo.id;

        // Store in device shared store
        await deviceSharedStore.addMember(deviceMeta.id, deviceMeta);


        // Create and send routing message using deviceMeta connectionId
        // Log the connection information for debugging
        logger.info(`[DeviceHandler] Client connection info - ID: ${senderConnectionId}, Protocol: ${senderConnectionProtocol}`);

        // Create the message with all required properties in one step
        const routingMessage = {
            id: uuidv4(),
            type: 'device',
            scope: `connection:${deviceMeta.connectionId}`,
            protocol: 'sse',  // This is the protocol for the device connection
            connectionId: deviceMeta.connectionId || '',  // Ensure connectionId is always a string
            userInfo: userInfo,
            payload: {
                action: 'registered',
                userId: userInfo.id,
                claimedAt: new Date().toISOString()
            },
            // System message properties
            systemGenerated: true,
            echoToSender: false,
            // Explicit sender information for the client that initiated the claim
            senderId: userInfo.id,
            senderConnectionId: senderConnectionId,
            senderConnectionProtocol: senderConnectionProtocol
        };

        // Publish the routing message
        await publisher.publish(routingMessage);
        logger.info(`Device registration message sent to device ${deviceMeta.id}`);

        // Update device record in our mock database
        if (deviceRecords[deviceMeta.id]) {
            deviceRecords[deviceMeta.id] = {
                ...deviceRecords[deviceMeta.id],
                status: 'ACTIVE',
                claimedAt: new Date(),
                claimedBy: userInfo.id,
                updatedAt: new Date()
            };
        } else {
            // Create a new record if it doesn't exist
            deviceRecords[deviceMeta.id] = {
                id: deviceMeta.id,
                name: `Device-${deviceMeta.id.substring(0, 8)}`,
                deviceType: deviceMeta.deviceType || 'OTHER',
                model: deviceMeta.model,
                status: 'ACTIVE',
                claimedAt: new Date(),
                claimedBy: userInfo.id,
                createdAt: new Date(),
                updatedAt: new Date()
            };
        }



        // Return the device record
        return deviceRecords[deviceMeta.id];
    }

    /**
     * Add a new device with system information
     * @param pin The PIN used for device registration
     * @param deviceId The unique device ID
     * @param systemInfo Device system information
     * @returns Device information including API key
     */
    async addDevice(data: any, prisma: any): Promise<{
        id: string;
        apiKey: string;
        name: string;
        type: string;
        createdAt: Date;
    }> {

        const { pin, id, senderId,senderConnectionId, senderConnectionProtocol } = data;

        logger.debug(`Device claimed by user connection ID: ${pin}, ${id}, ${senderId},${senderConnectionId}, ${senderConnectionProtocol}`);

        const deviceMeta = await pinSharedStore.getSingle(pin);

        if (!deviceMeta) {
            throw new Error(`No device found with PIN ${pin}`);
        }

        // Check deviceId matches
        if (deviceMeta.id !== id) {
            throw new Error(`Device ID ${id} does not match PIN ${pin}`);
        }
        

        // Remove from PIN store to prevent reuse
        // await pinSharedStore.removeMember(pin, deviceMeta);


        // // Generate a secure API key
        // const apiKeyValue = generateId(32);
        // const deviceName = systemInfo.deviceName || `Device-${deviceId.slice(0, 6)}`;
        // const deviceType = systemInfo.deviceType || 'unknown';

        try {
            // try {
            //     // Create API key in the database
            //     const apiKey = await prisma.apiKey.create({
            //         data: {
            //             key: apiKeyValue,
            //             name: `Device: ${deviceName}`,
            //             description: `API key for ${deviceType} device (${deviceId})`,
            //             userId: userId,
            //             active: true,
            //             expiresAt: null, // Or set an expiration if needed
            //         }
            //     });

            //     // Create device record
            //     const deviceRecord = {
            //         id: deviceId,
            //         name: deviceName,
            //         type: deviceType,
            //         apiKeyId: apiKey.id,
            //         systemInfo,
            //         createdAt: new Date(),
            //         claimedAt: deviceMeta.claimedAt || new Date(),
            //         claimedById: deviceMeta.claimedById || userId,
            //         pin: pin
            //     };

            //     // Store device record in database
            //     const device = await prisma.device.upsert({
            //         where: { id: deviceId },
            //         update: deviceRecord,
            //         create: deviceRecord,
            //     });

            //     // Remove PIN from store after successful device info submission
            //     await pinSharedStore.removeMember(pin, deviceMeta);

            //     logger.info(`Device registered: ${deviceId}`, { 
            //         type: deviceRecord.type,
            //         claimed: !!deviceMeta.claimedAt,
            //         apiKeyId: apiKey.id
            //     });

            // return {
            //     id: device.id,
            //     apiKey: apiKey.key,
            //     name: device.name,
            //     type: device.type,
            //     createdAt: device.createdAt
            // };

            return {
                id: '',
                apiKey: '',
                name: '',
                type: '',
                createdAt: new Date()
            }
        } catch (error: { message: any; }) {
            // logger.error(`Failed to register device ${deviceId}:`, error);
            throw new Error(`Device registration failed: ${error.message}`);
        }
    }


    /**
     * Get a device by its ID
     */
    getDeviceById(deviceId: string): any {
        return deviceRecords[deviceId] || null;
    }

    /**
     * Get all devices claimed by a user
     */
    getDevicesByUser(userId: string): any[] {
        return Object.values(deviceRecords).filter(device =>
            device.claimedBy === userId
        );
    }
}

// Create and export the device manager instance
export const DeviceManager = new DefaultDeviceManager();

// For testing, register some mock devices
DeviceManager.registerDevice('123456', { id: uuidv4(), deviceType: 'CAMERA' });
DeviceManager.registerDevice('654321', { id: uuidv4(), deviceType: 'SENSOR' });
DeviceManager.registerDevice('111111', { id: uuidv4(), deviceType: 'CONTROLLER' });
