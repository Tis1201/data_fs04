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
                id: deviceMeta.id,
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

        logger.info(`Found device with PIN ${pin}, deviceId: ${deviceMeta.id}`);

        // Check deviceId matches
        if (deviceMeta.id !== id) {
            throw new Error(`Device ID ${id} does not match PIN ${pin}`);
        }

        try {

            

                // Generate API key and create device record
                const apiKeyValue = generateId(32);
                const deviceName = data.deviceType || `Device-${id.slice(0, 6)}`;
                const deviceType = data.deviceType || 'unknown';
                // Create device record with system info
                const deviceRecord = {
                    id: id,
                    name: data.deviceType || 'dummy',
                    deviceType: data.deviceType || 'dummy',
                    model: data.model,
                    manufacturer: data.manufacturer,
                    osVersion: data.osVersion,
                    firmwareVersion: data.firmwareVersion,
                    hardwareId: data.hardwareId,
                    wifiMac: data.wifiMac,
                    lanMac: data.lanMac,
                    ipAddress: data.ipAddress,
                    apiKey: apiKeyValue,
                    apiKeyCreatedAt: new Date(),
                    apiKeyRotatedAt: new Date(),
                    status: 'ACTIVE',
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    claimedAt: new Date(),
                    claimedBy: senderId,
                    description: `Device registered on ${new Date().toISOString()}`,
                    // pin: pin,
                    user: {
                        connect: { id: senderId }
                    }
                };

                // Save device record in database with user relationship
                const device = await prisma.device.upsert({
                    where: { id },
                    update: deviceRecord,
                    create: deviceRecord,
                });

                // Remove from PIN store after successful save
                await pinSharedStore.removeMember(pin, deviceMeta);


                return {
                    id: device.id,
                    apiKey: device.apiKey,
                    name: device.name,
                    type: device.type,
                    createdAt: device.createdAt
                }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            // logger.error(`Failed to register device ${id}:`, error);
            throw new Error(`Device registration failed: ${errorMessage}`);
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
