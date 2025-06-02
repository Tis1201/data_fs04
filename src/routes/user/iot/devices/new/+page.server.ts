import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { superValidate, message } from 'sveltekit-superforms/server';
import { zod } from 'sveltekit-superforms/adapters';
import { z } from 'zod';
import { logger } from '$lib/server/logger';
import { validateAndGetUserId } from '$lib/server/security/auth-utils';
import { restrict } from '$lib/server/security/guards';
import { SystemRole } from '$lib/types/roles';


// Define the PIN code schema
const pinSchema = z.object({
    pin: z.string()
        .min(6, { message: "PIN code must be 6 digits" })
        .max(6, { message: "PIN code must be 6 digits" })
        .regex(/^\d+$/, { message: "PIN code must contain only digits" })
});

export const load = restrict(
    async ({ locals }) => {
        // Initialize the PIN claim form
        const pinForm = await superValidate(zod(pinSchema));

        return {
            pinForm
        };
    },
    [SystemRole.USER] // Restrict to authenticated users
) satisfies PageServerLoad;

export const actions: Actions = {
    // Action for claiming a device with PIN using Superforms
    claimDevice: restrict(
        async ({ request, locals }) => {
        // Validate the form data against the schema
        const form = await superValidate(request, zod(pinSchema));

        // If validation fails, return the form with errors
        if (!form.valid) {
            return fail(400, { form });
        }

        const pin = form.data.pin;

        // Get the authenticated user and current account
        const auth = await locals.auth.validate();
        const userInfo = auth?.user;
        const currentAccount = auth?.currentAccount?.account;

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
        
        if (!currentAccount) {
            logger.warn(`User ${userInfo.id} has no current account selected when claiming device`);
            return fail(400, {
                form,
                success: false,
                message: {
                    type: 'error',
                    text: 'Account Required',
                    details: 'You must select an account before claiming a device',
                    code: 'ACCOUNT_REQUIRED',
                    timestamp: new Date().toISOString()
                }
            });
        }
        
        logger.info(`Using current account: ${currentAccount.name} (${currentAccount.id}) for device claim`);

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

        // Attempt to claim the device with account association
        const device = await deviceManager.claimDevice(
            pin, 
            userInfo, 
            locals.connectionId || 'unknown', 
            locals.connectionProtocol || 'http', 
            currentAccount.id, // Pass the account ID for association
            locals.prisma // Pass the Prisma instance from locals for database operations
        );

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

        logger.info(`Device claimed successfully: ${device.id} by user ${userInfo.id}`);

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
    },
    [SystemRole.USER] // Restrict to authenticated users
    )
};
