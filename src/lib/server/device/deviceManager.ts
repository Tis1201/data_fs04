import { pinSharedStore, deviceSharedStore } from './deviceSharedStore';
import type { DeviceMeta } from './deviceMeta';
import { logger } from '$lib/server/logger';
import { v4 as uuidv4 } from 'uuid';
// Import the WebSocket manager for broadcasting messages
import { WebSocketManager } from '$lib/server/websocket/WebSocketManager';
import type { UserInfo } from '../types/user';
import { publisher } from '$lib/server/messaging/core/publisher';
import { MessageFactory } from '../messaging/interfaces/message';

// Mock database for device records (in a real app, this would be in Prisma)
const deviceRecords: Record<string, any> = {};

export class DefaultDeviceManager {
    /**
     * Register a new device with a PIN code
     */
    registerDevice(pin: string, device: DeviceMeta, ttlSeconds: number = 3600): void {

        if (!device.id) {
            device.id = uuidv4();
        }

        logger.info(`Registering device with PIN ${pin}`, { deviceId: device.id });
        pinSharedStore.addMember(pin, device);

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
    async claimDevice(pin: string, userInfo: UserInfo): Promise<any> {
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

        // Remove from PIN store to prevent reuse
        await pinSharedStore.removeMember(pin, deviceMeta);

        // Create and send routing message using deviceMeta connectionId
        const message = {
            type: 'device',
            scope: `connection:${deviceMeta.connectionId}`,
            protocol: 'sse',
            connectionId: deviceMeta.connectionId || '',
            userInfo: userInfo,
            payload: {
                action: 'registered',
                userId: userInfo.id,
                claimedAt: new Date().toISOString()
            }
        };

        const routingMessage = MessageFactory.toRoutingMessage(message, {
            systemGenerated: true,
            echoToSender: false
        });
        
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
