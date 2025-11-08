import { pinSharedStore, deviceSharedStore } from './deviceSharedStore';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '$lib/server/logger';
import { userInfoByUserId } from '$lib/server/security/auth-utils';
import type { UserInfo } from '../types/user';
import { publisher } from '$lib/server/messaging/core/publisher';
import { MessageFactory } from '$lib/server/messaging/interfaces/message';
import { generateId } from 'lucia';
import { getEnhancedPrisma } from '$lib/server/prisma';
import { logAudit } from '../audit-logger';
import { AuditActionType } from '$lib/constants/system';
import { sendDeviceRegistrationMessage, createClaimOptions, type ClaimDeviceOptions } from './deviceRegistrationUtils';
// Mock database for device records (in a real app, this would be in Prisma)
const deviceRecords: Record<string, any> = {};

export class DefaultDeviceManager {

    // In your class
    private prisma: ReturnType<typeof getEnhancedPrisma>;

    // In constructor
    constructor() {
        this.prisma = getEnhancedPrisma({
            id: 'system',  // or get from the actual user context
            systemRole: 'ADMIN'  // or get from the actual user context
        });
    }

    private createClaimOptions(
        userInfo: UserInfo | {userId: string, accountId: string, preclaimId?: string},
        accountId?: string
    ): ClaimDeviceOptions {
        return createClaimOptions(userInfo, accountId);
    }

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
     */
    async claimDevice(
        pin: string, 
        userInfo: UserInfo | {userId: string, accountId: string, preclaimId?: string},
        accountId?: string,
        senderConnectionId?: string,
        senderConnectionProtocol?: string
    ): Promise<any> {
        
        const { userId: actualUserId, accountId: actualAccountId, preclaimId } = 
            this.createClaimOptions(userInfo, accountId);
        const isPreclaim = !!preclaimId;
        
        logger.info(`Attempting to claim device with PIN ${pin} for account ${actualAccountId}`);

        // Get device from PIN store
        const deviceMeta = await pinSharedStore.getSingle(pin);

        if (!deviceMeta || !deviceMeta.id) {
            logger.warn(`No device found with PIN ${pin}`);
            return null;
        }

        logger.info(`Found device with PIN ${pin}`, { deviceId: deviceMeta.id });

        // Verify the account exists
        const account = await this.prisma.account.findUnique({
            where: { id: actualAccountId },
            select: { id: true }
        });

        if (!account) {
            throw new Error(`Account ${actualAccountId} not found`);
        }

        // Prepare base device data
        // Use MAC address for device name if available, fallback to device type or ID
        const macAddress = deviceMeta.macAddress || deviceMeta.wifiMac || deviceMeta.lanMac;
        const deviceName = macAddress ? `device-${macAddress}` : (deviceMeta.name || `Device-${deviceMeta.id.substring(0, 8)}`);
        
        const baseDeviceData: any = {
            id: deviceMeta.id,
            name: deviceName,
            deviceType: deviceMeta.deviceType || 'UNKNOWN',
            status: 'ACTIVE',
            claimedAt: new Date(),
            claimedBy: actualUserId,
            // Store MAC address if available
            ...(deviceMeta.macAddress && { macAddress: deviceMeta.macAddress }),
            ...(deviceMeta.wifiMac && { wifiMac: deviceMeta.wifiMac }),
            ...(deviceMeta.lanMac && { lanMac: deviceMeta.lanMac }),
            ...(deviceMeta.metadata || {})
        };

        // Upsert device record
        const existingDevice = await this.prisma.device.findUnique({
            where: { id: deviceMeta.id }
        });

        let device;
        if (existingDevice) {
            device = await this.prisma.device.update({
                where: { id: deviceMeta.id },
                data: {
                    ...baseDeviceData,
                    account: { connect: { id: actualAccountId } },
                    user: { connect: { id: actualUserId } }
                },
                include: { account: true, user: true }
            });
        } else {
            device = await this.prisma.device.create({
                data: {
                    ...baseDeviceData,
                    account: { connect: { id: actualAccountId } },
                    user: { connect: { id: actualUserId } }
                },
                include: { account: true, user: true }
            });
        }

        logger.info(`Device ${device.id} successfully claimed by user ${actualUserId}`);

        // Generate API key
        const apiKey = generateId(32);
        const now = new Date();

        const updatedDevice = await this.prisma.device.update({
            where: { id: device.id },
            data: {
                apiKey,
                apiKeyCreatedAt: now,
                apiKeyRotatedAt: now,
                status: 'ACTIVE',
                connected: true,
                connectedAt: now,
                lastUsedAt: now,
                updatedAt: now
            },
            select: {
                id: true,
                name: true,
                deviceType: true,
                status: true,
                apiKey: true,
                claimedBy: true,
                accountId: true,
                account: { select: { id: true, name: true } },
                user: { select: { id: true, name: true, email: true } }
            }
        });

        // Remove PIN from store
        await pinSharedStore.remove(pin);

        // Send registration message to device via Pushpin
        // IMPORTANT: Always send to device, regardless of UI connection status
        // The device is connected to Pushpin, not dependent on UI SSE connection
        if (!isPreclaim) {
            await sendDeviceRegistrationMessage(device.id, {
                id: updatedDevice.id,
                apiKey: updatedDevice.apiKey!,
                accountId: actualAccountId,
                claimedBy: actualUserId,
                name: updatedDevice.name,
                deviceType: updatedDevice.deviceType,
                status: updatedDevice.status,
                ...(deviceMeta.metadata || {})
            });
        }

        return updatedDevice;
    }

    /**
     * Add a new device with system information
     * @param pin The PIN used for device registration
     * @param deviceId The unique device ID
     * @param systemInfo Device system information
     * @returns Device information including API key
     */
    async addDevice(data: any, prisma: any): Promise<{ any: any }> {

        const { pin, id, senderId, senderConnectionId, senderConnectionProtocol } = data;

        logger.debug(`Device claimed by user connection ID: ${pin}, ${id}, ${senderId},${senderConnectionId}, ${senderConnectionProtocol}`);

        const deviceMeta = await pinSharedStore.getSingle(pin);

        // logger.info(`Found device with PIN ${pin}, deviceId: ${deviceMeta.id}`);

        const senderInfo = await userInfoByUserId(senderId);

        logger.debug(`User info retrieved: ${JSON.stringify(senderInfo)}`);

        try {
            if (!deviceMeta) {
                throw new Error(`No device found with PIN ${pin}`);
            }

            // Check deviceId matches
            if (deviceMeta.id !== id) {
                throw new Error(`Device ID ${id} does not match PIN ${pin}`);
            }

            // Generate API key and create device record
            const apiKeyValue = generateId(32);
            // Use MAC address for device name, fallback to device type or ID
            const macAddress = data.macAddress || data.wifiMac || data.lanMac;
            const deviceName = macAddress ? `device-${macAddress}` : (data.deviceType || `Device-${id.slice(0, 6)}`);
            const deviceType = data.deviceType || 'unknown';

            // Check if user has a current account to include in the device record
            let accountConnection = null;
            if (senderInfo?.currentAccount?.account?.id) {
                logger.debug(`Adding account ${senderInfo.currentAccount.account.id} to device record`);
                accountConnection = {
                    connect: { id: senderInfo.currentAccount.account.id }
                };
            } else {
                logger.debug(`No current account found for user ${senderId}`);
            }

            // Create device record with system info
            const deviceRecord = {
                id: id,
                name: deviceName,
                deviceType: deviceType,
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
                },
                ...(accountConnection ? { account: accountConnection } : {})
            };

            // Save device record in database with user relationship
            logger.debug(`Upserting device with record: ${JSON.stringify(deviceRecord)}`);
            const device = await prisma.device.upsert({
                where: { id },
                update: deviceRecord,
                create: deviceRecord,
            });

            // Remove from PIN store after successful save
            await pinSharedStore.removeMember(pin, deviceMeta);

            // Create success message
            // Create a minimal InMessage with required properties
            const successMessage: InMessage = {
                type: 'device',
                scope: `connection:${senderConnectionId}`,
                protocol: 'websocket',
                connectionId: senderConnectionId,
                userInfo: senderInfo,
                payload: {
                    action: 'claimed',
                    success: true,
                    deviceId: device.id,
                    deviceName: device.name,
                    message: 'Device claimed successfully',
                    code: '200',
                    requestId: `req-${Math.random().toString(36).substring(2, 15)}`,
                    timestamp: new Date().toISOString()
                }
            };

            // Create the routing message with sudo explicitly set to true
            const successResponse = MessageFactory.toRoutingMessage(successMessage, {
                sudo: true,
                systemGenerated: true,
                senderId: 'system',
                senderConnectionId: senderConnectionId,
                senderConnectionProtocol: 'sse'
            });

            // Debug log to check if sudo property is set correctly
            logger.debug(`[DeviceManager] Success response sudo property: ${successResponse.sudo}, type: ${typeof successResponse.sudo}`);

            logger.debug(`Published success response for device claim: ${device.id} for user ${senderId}`);

            try {
                await publisher.publish(successResponse);
                logger.debug(`Successfully published device claim success message`);
            } catch (pubError) {
                logger.error(`Failed to publish success message: ${pubError}`);
                // Don't fail the operation if publishing the success message fails
            }

            return device;

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            logger.error(`Failed to register device ${id}:`, error);


            if (!senderInfo) {
                logger.error(`Failed to find user info for sender: ${senderId}`);
                throw new Error('User information not found');
            }

            const message = {
                id: uuidv4(),
                scope: `connection:${senderConnectionId}`,
                senderId: senderId || 'system',
                senderConnectionId,
                senderConnectionProtocol,
                timestamp: new Date().toISOString(),
                userInfo: senderInfo
            };

            const errorResponse = MessageFactory.toRoutingMessage({
                ...message,
                type: 'device',
                payload: {
                    action: 'error',
                    success: false,
                    error: 'Device Registration Failed',
                    details: errorMessage,
                    code: "500",
                    requestId: `req-${Math.random().toString(36).substring(2, 15)}`,
                    timestamp: new Date().toISOString()
                }
            } as any);

            logger.debug(`Published error response to messaging system: ${senderConnectionId} [${senderConnectionProtocol}]`);

            await publisher.publish(errorResponse);


            // Always throw the error to be handled by the API endpoint
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
// DeviceManager.registerDevice('123456', { id: uuidv4(), deviceType: 'CAMERA' });
// DeviceManager.registerDevice('654321', { id: uuidv4(), deviceType: 'SENSOR' });
// DeviceManager.registerDevice('111111', { id: uuidv4(), deviceType: 'CONTROLLER' });
