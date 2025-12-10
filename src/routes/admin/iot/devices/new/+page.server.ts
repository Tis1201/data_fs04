import { fail, error } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { superValidate, message } from 'sveltekit-superforms/server';
import { deviceSchema } from '$lib/schemas/device';
import { zod } from 'sveltekit-superforms/adapters';
import { restrict, type AuthenticatedLoadEvent, type AuthenticatedEvent } from '$lib/server/security/guards';
import { SystemRole } from '../../../users/schema';
import { logger } from '$lib/server/logger';
import { validateAndGetUserId, validateAuth } from '$lib/server/security/auth-utils';
import { z } from 'zod';
import type { UserInfo } from '$lib/server/types/user';
import { logAudit } from '$lib/server/audit-logger';
import { AuditActionType } from '$lib/constants/system';

// Define the PIN code schema
const pinSchema = z.object({
    pin: z.string()
        .min(6, { message: "PIN code must be 6 digits" })
        .max(6, { message: "PIN code must be 6 digits" })
        .regex(/^\d+$/, { message: "PIN code must contain only digits" })
});

export const load = restrict(
    async ({ locals }: AuthenticatedLoadEvent) => {
        // Initialize the device registration form with the schema and defaults
        const deviceForm = await superValidate(zod(deviceSchema), {
            defaults: {
                name: '',
                deviceType: 'OTHER',
                description: '',
                status: 'ACTIVE'
            }
        });

        // Initialize the PIN claim form
        const pinForm = await superValidate(zod(pinSchema));

        return {
            deviceForm,
            pinForm
        };
    },
    [SystemRole.ADMIN] // Only allow admin role to access this route
) satisfies PageServerLoad;

export const actions: Actions = {
    // Action for claiming a device with PIN using Superforms
    claimDevice: restrict(async ({ request, locals, auth }: AuthenticatedEvent) => {
        // Validate the form data against the schema
        const form = await superValidate(request, zod(pinSchema));

        // If validation fails, return the form with errors
        if (!form.valid) {
            return fail(400, { form });
        }

        const pin = form.data.pin;

        // Get the authenticated user
        if (!auth?.user) {
            return fail(401, { message: 'Unauthorized' });
        }

        const userInfo: UserInfo = {
            id: auth.user.id,
            email: auth.user.email,
            name: auth.user.name,
            systemRole: auth.user.systemRole,
            source: 'session'
        };

        console.log(`userInfo: ${JSON.stringify(userInfo)}`)

        if (!userInfo) {
            // Return a properly formatted error message for the form handler
            return fail(401, {
                form,
                success: false,
                message: {
                    type: 'error',
                    text: 'Authentication Required',
                    details: 'You must be logged in to claim a device',
                    code: 'AUTH_REQUIRED',
                    timestamp: new Date().toISOString()
                }
            });
        }

        logger.info(`User ${userInfo.id} attempting to claim device with PIN: ${pin}`);

        // Get the device manager from locals
        const deviceManager = locals.deviceManager;

        if (!deviceManager) {
            logger.error('Device manager not available in locals');
            return fail(500, {
                form,
                success: false,
                message: {
                    type: 'error',
                    text: 'System Error',
                    details: 'Device manager not available. Please try again later.',
                    code: 'SYSTEM_ERROR',
                    timestamp: new Date().toISOString()
                }
            });
        }

        // Attempt to claim the device
        const device = await deviceManager.claimDevice(pin, userInfo);

        if (!device) {
            const errorMessage = 'The PIN you entered doesn\'t match any available device. Please verify the 6-digit PIN and try again.';
            logger.warn(`No device found with PIN ${pin}. Returning error: ${errorMessage}`);

            // Return a properly formatted error message for the form handler
            return fail(400, {
                form,
                success: false,
                message: {
                    type: 'error',
                    text: 'Verification Failed',
                    details: errorMessage,
                    code: 'INVALID_PIN',
                    requestId: `req-${Math.random().toString(36).substring(2, 15)}`,
                    timestamp: new Date().toISOString()
                }
            });
        }

        logger.info(`Device registered, next step wait for device to connect: ${device.id} by user ${userInfo.id}`);

        // Return success response with the form and additional data
        return {
            form,
            success: true,
            message: {
                type: 'success',
                text: 'Device claimed successfully!',
                timestamp: new Date().toISOString()
            },
            device: {
                id: device.id,
                name: device.name,
                deviceType: device.deviceType,
                status: device.status
            }
        };

    }, [SystemRole.ADMIN]),

    // Action for registering device details after claiming
    registerDevice: restrict(async ({ request, locals, getClientAddress }: AuthenticatedEvent) => {
        // Validate the form data against the schema
        const form = await superValidate(request, zod(deviceSchema));

        // If validation fails, return the form with errors
        if (!form.valid) {
            return fail(400, { form });
        }

        try {
            // Get authenticated user
            const userId = await validateAndGetUserId(locals);
            if (!userId) {
                // Return a message through Superforms
                return fail(401, message(form, 'You must be logged in to register a device', { status: 401 }));
            }

            const { name, deviceType, description, hardwareId, model, manufacturer } = form.data;

            // Check if device exists
            const existingDevice = await locals.prisma.device.findUnique({
                where: { id: hardwareId }
            });

            if (!existingDevice) {
                // Business validation error - device not found
                return fail(404, message(form, 'Device not found. Please claim a device first.', { status: 404 }));
            }

            try {
                // Update the device with additional information
                const device = await locals.prisma.device.update({
                    where: { id: hardwareId },
                    data: {
                        name,
                        deviceType,
                        description,
                        model,
                        manufacturer,
                        updatedAt: new Date()
                    }
                });

                logger.info(`Device updated successfully: ${device.id} by user ${userId}`);

                const ipAddress = locals.requestContext?.ip ?? getClientAddress();

                await logAudit({
                    actionType: AuditActionType.UPDATE,
                    tableName: 'Device',
                    recordId: device.id,
                    oldData: existingDevice,
                    newData: device,
                    userId,
                    ipAddress,
                    prisma: locals.prisma
                });

                // Return success with the updated device
                const successForm = message(form, 'Device registered successfully!');

                return {
                    form: successForm,
                    success: true,
                    device: {
                        id: device.id,
                        name: device.name,
                        deviceType: device.deviceType,
                        status: device.status
                    }
                };
            } catch (dbError) {
                // Handle database-specific errors
                logger.error(`Database error registering device:`, { dbError });
                // Return a business validation error through Superforms
                return fail(500, message(form, 'Failed to update device information. Please try again.', { status: 500 }));
            }
        } catch (err) {
            logger.error('Error registering device:', { err });
            return fail(500, message(form, 'Failed to register device. Please try again.', { status: 500 }));
        }
    }, [SystemRole.ADMIN])
};
