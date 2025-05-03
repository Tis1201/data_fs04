import { fail, error } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { superValidate, message } from 'sveltekit-superforms/server';
import { deviceSchema } from '$lib/schemas/device';
import { zod } from 'sveltekit-superforms/adapters';
import { restrict } from '$lib/server/security/guards';
import { SystemRole } from '../../../users/schema';
import { logger } from '$lib/server/logger';
import { validateAndGetUserId } from '$lib/server/security/auth-utils';

export const load = restrict(
    async ({ locals }) => {
        // Initialize the form with the schema and defaults
        const form = await superValidate(zod(deviceSchema), {
            defaults: {
                name: '',
                deviceType: 'OTHER',
                description: ''
            }
        });
        
        return { 
            form
        };
    },
    [SystemRole.ADMIN] // Only allow admin role to access this route
) satisfies PageServerLoad;

export const actions: Actions = {
    // Action for claiming a device with PIN
    claimDevice: async ({ request, locals }) => {
        try {
            const data = await request.formData();
            const pin = data.get('pin')?.toString();
            
            if (!pin || pin.length < 6) {
                return fail(400, { 
                    success: false, 
                    message: 'Invalid PIN code. Please enter a valid 6-digit PIN.'
                });
            }
            
            // Get the authenticated user
            const userId = await validateAndGetUserId(locals);
            if (!userId) {
                return fail(401, { success: false, message: 'You must be logged in to claim a device' });
            }
            
            logger.info(`User ${userId} attempting to claim device with PIN: ${pin}`);
            
            // Get the device manager from locals
            const deviceManager = locals.deviceManager;
            if (!deviceManager) {
                logger.error('Device manager not available in locals');
                return fail(500, { success: false, message: 'Device manager not available' });
            }
            
            // Attempt to claim the device
            const device = await deviceManager.claimDevice(pin, userId);
            
            if (!device) {
                const errorMessage = 'The PIN you entered doesn\'t match any available device. Please verify the 6-digit PIN and try again.';
                logger.warn(`No device found with PIN ${pin}. Returning error: ${errorMessage}`);
                
                // Return a structured error response with fail() to ensure proper status code
                return fail(400, {
                    success: false,
                    message: {
                        type: 'error' as const,
                        text: 'Verification Failed',
                        details: errorMessage,
                        code: 'INVALID_PIN',
                        requestId: `req-${Math.random().toString(36).substring(2, 15)}`,
                        timestamp: new Date().toISOString()
                    }
                });
            }
            
            logger.info(`Device claimed successfully: ${device.id} by user ${userId}`);
            
            // Broadcast a message to all connected clients that the device has been claimed
            if (locals.wss) {
                const message = {
                    type: 'device:claimed',
                    data: {
                        deviceId: device.id,
                        name: device.name,
                        deviceType: device.deviceType,
                        claimedBy: userId,
                        claimedAt: device.claimedAt
                    }
                };
                
                // Broadcast to all connected clients
                locals.wss.broadcast(JSON.stringify(message));
                logger.info('Broadcast device claimed message to all clients');
            } else {
                logger.warn('WebSocket server not available, could not broadcast device claimed message');
            }
            
            // Return success response
            return { 
                success: true,
                device: {
                    id: device.id,
                    name: device.name,
                    deviceType: device.deviceType,
                    status: device.status
                },
                message: 'Device claimed successfully'
            };
        } catch (err) {
            logger.error('Error claiming device:', err);
            return fail(500, { success: false, message: 'Failed to claim device' });
        }
    },
    
    // Action for registering device details after claiming
    registerDevice: async ({ request, locals }) => {
        const form = await superValidate(request, zod(deviceSchema));
        
        if (!form.valid) {
            return fail(400, { form });
        }
        
        try {
            // Get authenticated user
            const userId = await validateAndGetUserId(locals);
            if (!userId) {
                return fail(401, { form, success: false, message: 'You must be logged in to register a device' });
            }
            
            const { name, deviceType, description, hardwareId, model, manufacturer } = form.data;
            
            // Check if device exists
            const existingDevice = await locals.prisma.device.findUnique({
                where: { id: hardwareId }
            });
            
            if (!existingDevice) {
                return fail(404, message(form, 'Device not found. Please claim a device first.', { status: 'error' }));
            }
            
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
            
            // Return success with the updated device
            const successForm = message(form, 'Device registered successfully!', { status: 'success' });
            
            return {
                ...successForm,
                success: true,
                device: {
                    id: device.id,
                    name: device.name,
                    deviceType: device.deviceType,
                    status: device.status
                }
            };
        } catch (err) {
            logger.error('Error registering device:', err);
            return fail(500, message(form, 'Failed to register device', { status: 'error' }));
        }
    }
};
