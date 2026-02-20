import { error, fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { superValidate, message } from 'sveltekit-superforms/server';
import { zod } from 'sveltekit-superforms/adapters';
import { logger } from '$lib/server/logger';
import { restrict } from '$lib/server/security/guards';
import type { AuthenticatedEvent, AuthenticatedLoadEvent } from '$lib/server/security/guards';
import { SystemRole } from '$lib/types/roles';
import { deviceEditSchema } from '../schema';
import { AuditActionType } from '$lib/constants/system';
import { logAudit } from '$lib/server/audit-logger';
import { createSuccessResponse } from '$lib/types/api';

export const load = restrict(
    async ({ params, locals, depends, cookies }: AuthenticatedLoadEvent) => {
        depends('app:device');
        
        try {
            const currentAccountId =
                (locals as any).currentAccount?.account?.id ?? cookies.get('current_account_id');

            const device = await locals.prisma.device.findUnique({
                where: { 
                    id: params.id,
                    ...(currentAccountId ? { accountId: currentAccountId } : {
                        OR: [
                            { createdBy: (locals as any).user?.id },
                            { accountId: (locals as any).currentAccount?.account?.id }
                        ]
                    })
                },
                select: {
                    id: true,
                    name: true,
                    description: true,
                    status: true,
                    deviceType: true,
                    model: true,
                    manufacturer: true,
                    osVersion: true,
                    firmwareVersion: true,
                    hardwareId: true,
                    wifiMac: true,
                    lanMac: true,
                    ipAddress: true,
                    createdAt: true,
                    updatedAt: true,
                    lastUsedAt: true,
                    createdBy: true,
                    user: {
                        select: {
                            name: true,
                            email: true
                        }
                    }
                }
            });

            if (!device) {
                throw error(404, "Device not found or you don't have access to it");
            }

            const form = await superValidate(
                {
                    id: device.id,
                    name: device.name,
                    description: device.description || "",
                    status: device.status,
                },
                zod(deviceEditSchema)
            );

            return {
                form,
                device
            };
        } catch (e) {
            logger.error('Error loading device for edit:', { error: e });
            throw error(500, 'Failed to load device');
        }
    },
    [SystemRole.USER] // Allow regular users to access this route
) satisfies PageServerLoad;

export const actions: Actions = {
    /**
     * Update device data
     */
    save: restrict(
        async ({ request, params, locals, cookies }: AuthenticatedEvent) => {
            const id = params.id;
            if (!id) {
                return fail(400, { error: 'Device ID is required' });
            }

            // Get current account ID
            const currentAccountId =
                (locals as any).currentAccount?.account?.id ??
                cookies.get('current_account_id');

            if (!currentAccountId) {
                return fail(403, { error: 'No account selected' });
            }

            const form = await superValidate(request, zod(deviceEditSchema));
            logger.debug(`Device update form data: ${JSON.stringify(form)}`);

            if (!form.valid) {
                return fail(400, { form });
            }

            try {
                // Debug logging to understand the access check
                logger.debug(`User access check - userId: ${locals.user?.id}, currentAccountId: ${currentAccountId}, userRole: ${locals.currentAccount?.role}`);
                logger.debug(`Current account details:`, { 
                    currentAccount: locals.currentAccount,
                    accountMemberships: locals.accountMemberships?.length || 0
                });
                
                // First check if device exists and user has access to it
                const existingDevice = await locals.prisma.device.findUnique({
                    where: { 
                        id,
                        OR: [
                            { createdBy: locals.user?.id },
                            { accountId: locals.currentAccount?.account.id }
                        ]
                    }
                });

                logger.debug(`Device lookup result: ${existingDevice ? 'found' : 'not found'}`);

                if (!existingDevice) {
                    // Try to find the device by ID first to see if it exists
                    const deviceById = await locals.prisma.device.findUnique({
                        where: { id }
                    });
                    
                    if (!deviceById) {
                        return fail(404, {
                            form,
                            error: 'Device not found'
                        });
                    }
                    
                    // Device exists but user doesn't have access
                    logger.warn(`User ${locals.user?.id} attempted to access device ${id} but lacks permission`);
                    return fail(403, {
                        form,
                        error: 'You don\'t have access to this device'
                    });
                }

                // Prepare update data - only name and description are editable by users
                const updateData = {
                    name: form.data.name,
                    description: form.data.description || null,
                    // Regular users can't change status
                };

                logger.debug(`Update data prepared:`, updateData);

                // Update the device (include accountId in where clause for defense-in-depth)
                logger.debug(`Attempting to update device ${id}...`);
                const device = await locals.prisma.device.update({
                    where: { id, accountId: currentAccountId },
                    data: updateData
                });
                logger.debug(`Device update successful:`, device);

                logger.debug(`Starting audit log...`);
                await logAudit({
                    actionType: AuditActionType.UPDATE,
                    tableName: 'Device',
                    recordId: id as string,
                    oldData: existingDevice,
                    newData: device,
                    userId: (locals as any).user.id,
                    ipAddress: (locals as any).ipAddress,
                    prisma: locals.prisma
                });
                logger.debug(`Audit log completed`);

                // Return success response
                logger.debug(`Device update completed successfully`);
                return message(
                    form,
                    createSuccessResponse('Device updated successfully!', {
                        details: `Device '${device.name}' has been updated.`,
                        data: {
                            id: device.id,
                            name: device.name
                        }
                    })
                );
            } catch (e) {
                const error = e as Error;
                logger.debug(`Caught error in device update: ${error.message}`, { stack: error.stack });
                logger.error(`Error updating device: ${error.message}`, { stack: error.stack });
                console.error('Device update error details:', error);
                return fail(500, {
                    form,
                    error: `Failed to update device: ${error.message}`
                });
            }
        },
        [SystemRole.USER]
    )
};
