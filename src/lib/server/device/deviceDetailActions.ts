import { fail } from '@sveltejs/kit';
import { message } from 'sveltekit-superforms/server';
import type { PrismaClient } from '@prisma/client';
import { superValidate } from 'sveltekit-superforms/server';
import { zod } from 'sveltekit-superforms/adapters';
import type { z } from 'zod';
import { logger } from '$lib/server/logger';
import { publisher } from '$lib/server/messaging/core/publisher';
import { MessageFactory, SystemUser } from '$lib/server/messaging/interfaces/message';
import { AuditActionType } from '$lib/constants/system';
import { logAudit } from '$lib/server/audit-logger';
import { isDeviceOnline } from '$lib/server/device/devicePresence';
import { updateDeviceProfile as updateDeviceProfileUtil } from '$lib/server/device/deviceProfileUpdater';
import crypto from 'crypto';

export interface DeviceDetailActionContext {
    prisma: PrismaClient;
    userId: string;
    ipAddress: string;
    deviceId: string;
    /**
     * Whether to check device ownership for non-admin users
     */
    checkOwnership?: boolean;
    /**
     * Account ID for ownership check
     */
    accountId?: string;
}

/**
 * Create save action for device detail pages
 */
export function createSaveAction(deviceEditSchema: z.ZodType<any>) {
    return async (context: DeviceDetailActionContext, request: Request) => {
        const { prisma, userId, ipAddress, deviceId } = context;

        const form = await superValidate(request, zod(deviceEditSchema));
        logger.debug('Update device form data', { form });

        if (!form.valid) {
            return fail(400, { form });
        }

        try {
            // Start a transaction to ensure data consistency
            return await prisma.$transaction(async (tx) => {
                // First check if device exists
                const existingDevice = await tx.device.findUnique({
                    where: { id: deviceId }
                });

                if (!existingDevice) {
                    return fail(404, {
                        form,
                        error: 'Device not found'
                    });
                }

                // Prepare update data
                const formData = form.data as any;
                const updateData = {
                    name: formData.name,
                    description: formData.description || null,
                    status: formData.status,
                    deviceType: formData.deviceType || null,
                    model: formData.model || null,
                    manufacturer: formData.manufacturer || null,
                    osVersion: formData.osVersion || null,
                    firmwareVersion: formData.firmwareVersion || null,
                    hardwareId: formData.hardwareId || null,
                    macAddress: formData.macAddress || null,
                    wifiMac: formData.wifiMac || null,
                    lanMac: formData.lanMac || null,
                    ipAddress: formData.ipAddress || null,
                };

                // Update device
                const updatedDevice = await tx.device.update({
                    where: { id: deviceId },
                    data: updateData
                });

                await logAudit({
                    actionType: AuditActionType.UPDATE,
                    tableName: 'Device',
                    recordId: deviceId,
                    oldData: existingDevice,
                    newData: updatedDevice,
                    userId,
                    ipAddress,
                    prisma
                });

                return {
                    form,
                    success: true,
                    message: 'Device updated successfully'
                };
            });
        } catch (e) {
            logger.error('Error updating device', { error: e });
            return fail(500, {
                form,
                error: 'Failed to update device'
            });
        }
    };
}

/**
 * Create generateApiKey action for device detail pages
 */
export function createGenerateApiKeyAction(
    deviceEditSchema: z.ZodType<any>,
    apiKeySchema?: z.ZodType<any>
) {
    return async (context: DeviceDetailActionContext) => {
        const { prisma, userId, ipAddress, deviceId, checkOwnership, accountId } = context;

        logger.debug(`Generating new API key for device: ${deviceId}`);

        try {
            // Build device query with optional ownership check
            const deviceWhere: any = { id: deviceId };
            
            if (checkOwnership) {
                // For user routes, check ownership
                deviceWhere.OR = [
                    { createdBy: userId },
                    ...(accountId ? [{ accountId }] : [])
                ];
            }

            // Check if device exists (with ownership check if needed)
            const device = await prisma.device.findFirst({
                where: deviceWhere
            });

            if (!device) {
                return fail(404, {
                    error: checkOwnership 
                        ? 'Device not found or you don\'t have access to it'
                        : 'Device not found'
                });
            }

            // Check if device is online before allowing rotation
            const deviceOnline = await isDeviceOnline(deviceId);
            if (!deviceOnline) {
                return fail(400, {
                    error: 'Device must be online to rotate API key. Please ensure the device is connected.'
                });
            }

            // Generate new API key
            const apiKey = crypto.randomBytes(32).toString('hex');

            logger.info(`Generating new API key for device ${deviceId}`);

            // Update device with new API key in database
            const now = new Date();
            const updatedDevice = await prisma.device.update({
                where: { id: deviceId },
                data: {
                    apiKey,
                    apiKeyCreatedAt: device.apiKeyCreatedAt || now,
                    apiKeyRotatedAt: now,
                    updatedAt: now
                }
            });

            // Log audit
            await logAudit({
                actionType: AuditActionType.UPDATE,
                tableName: 'Device',
                recordId: deviceId,
                oldData: { apiKey: device.apiKey, apiKeyRotatedAt: device.apiKeyRotatedAt },
                newData: { apiKey: updatedDevice.apiKey, apiKeyRotatedAt: updatedDevice.apiKeyRotatedAt },
                userId,
                ipAddress,
                prisma
            });

            // Send new API key to device using SystemUser for proper authorization
            const updateMessage = MessageFactory.createSystemMessage(
                'device',
                `subscription:device:${deviceId}`,
                {
                    action: 'updateApiKey',
                    apiKey: apiKey,
                    requestId: `req-${Math.random().toString(36).substring(2, 15)}`,
                    timestamp: new Date().toISOString()
                },
                SystemUser,
                { echoToSender: false }
            );

            await publisher.publish(updateMessage);
            logger.info(`Sent new API key to device ${deviceId}`);

            // Create form for superForm response
            // Use apiKeySchema if provided, otherwise use deviceEditSchema with minimal fields
            let form;
            if (apiKeySchema) {
                form = await superValidate({ deviceId }, zod(apiKeySchema));
            } else {
                form = await superValidate({ 
                    id: deviceId, 
                    name: device.name || '', 
                    status: device.status || 'ACTIVE' 
                }, zod(deviceEditSchema));
            }
            
            return message(form, {
                success: true,
                message: 'API key rotated successfully and sent to device',
                apiKey
            });
        } catch (e) {
            logger.error('Error generating API key', { error: e });
            return fail(500, {
                error: 'Failed to generate API key'
            });
        }
    };
}

/**
 * Create updateDeviceProfile action for device detail pages
 */
export function createUpdateDeviceProfileAction() {
    return async (context: DeviceDetailActionContext, request: Request) => {
        const { prisma, userId, deviceId } = context;

        // Use shared utility to update profile
        return await updateDeviceProfileUtil(
            prisma,
            deviceId,
            await request.formData(),
            userId
        );
    };
}

