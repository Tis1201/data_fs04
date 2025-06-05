import { fail, error } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { superValidate, message } from 'sveltekit-superforms/server';
import { zod } from 'sveltekit-superforms/adapters';
import { restrict } from '$lib/server/security/guards';
import { SystemRole } from '$lib/types/roles';
import { logger } from '$lib/server/logger';
import { bundleSchema } from './bundle';
import { handleFormError } from '$lib/server/errors/errorHandlers';
import { FormValidationError } from '$lib/server/errors/FormValidationError';
import { createSuccessResponse } from '$lib/types/api';

export const load = restrict(
    async ({ locals, auth }: any) => { // Use auth from enhanced event
        try {
            // Create a form based on the schema with defaults
            const form = await superValidate(zod(bundleSchema), {
                id: 'bundle-form',
                defaults: {
                    name: '',
                    description: '',
                    os: 'ANDROID',
                    reboot: false,
                    version: '1.0.0',
                    waveSize: 500,
                    scheduledAt: null,
                    scheduledAtTimezone: 'UTC',
                    scheduledAtStartIfMissed: false
                }
            });
            
            // Get the authenticated user from the enhanced event
            const userInfo = auth.user; // Auth is guaranteed by the restrict guard
            
            // Get the admin user's account
            const adminUser = await locals.prisma.user.findUnique({
                where: { id: userInfo.id },
                select: {
                    accountMemberships: {
                        select: {
                            accountId: true
                        }
                    }
                }
            });
            
            // Default to the first account the admin belongs to
            const defaultAccountId = adminUser?.accountMemberships?.[0]?.accountId;
            
            return {
                form,
                defaultAccountId
            };
        } catch (err) {
            logger.error(`Error loading bundle form: ${JSON.stringify(err)}`);
            throw error(500, 'Failed to load bundle form');
        }
    },
    [SystemRole.ADMIN] // Only allow admin role to access this route
) satisfies PageServerLoad;

export const actions: Actions = {
    create: restrict(
        async ({ request, locals, auth }: any) => {
            // Validate the form data
            const form = await superValidate(request, zod(bundleSchema));
            
            if (!form.valid) {
                return fail(400, { form });
            }
            
            try {
                // Get authenticated user from the enhanced event provided by restrict guard
                const userInfo = auth.user; // Auth is guaranteed by the restrict guard
                
                // If accountId is not provided, get the admin user's account
                let accountId = form.data.accountId;
                if (!accountId) {
                    const adminUser = await locals.prisma.user.findUnique({
                        where: {
                            id: userInfo.id
                        },
                        select: {
                            accountMemberships: {
                                select: {
                                    accountId: true
                                },
                                take: 1
                            }
                        }
                    });
                    
                    // accountId = adminUser?.accountMemberships?.[0]?.accountId;
                    
                    // if (!accountId) {
                    //     throw new FormValidationError(
                    //         'No account available for this user',
                    //         'NO_ACCOUNT_AVAILABLE',
                    //         400
                    //     );
                    // }
                }
                
                // Combine date and time if both are provided
                let scheduledDateTime = null;
                if (form.data.scheduledAt && form.data.scheduledTime) {
                    const datePart = form.data.scheduledAt;
                    const timePart = form.data.scheduledTime;
                    scheduledDateTime = new Date(`${datePart}T${timePart}:00`);
                } else if (form.data.scheduledAt) {
                    // If only date is provided, use midnight
                    scheduledDateTime = new Date(`${form.data.scheduledAt}T00:00:00`);
                }

                try {
                    // Create the bundle
                    const bundle = await locals.prisma.bundle.create({
                        data: {
                            name: form.data.name,
                            description: form.data.description || '',
                            os: form.data.os || 'ANDROID',
                            reboot: form.data.reboot || false,
                            status: 'DRAFT', // Always start as draft
                            version: form.data.version || '1.0.0',
                            waveSize: form.data.waveSize || 500,
                            scheduledAt: scheduledDateTime,
                            scheduledAtTimezone: form.data.scheduledAtTimezone || 'UTC',
                            scheduledAtStartIfMissed: form.data.scheduledAtStartIfMissed || false,
                            accountId: accountId,
                            createdBy: userInfo.id,
                            updatedBy: userInfo.id
                        }
                    });
                    
                    logger.info(`Bundle created: ${bundle.id}`);
                    
                    // Return success message with bundle details
                    return message(
                        form,
                        createSuccessResponse('Bundle created successfully!', {
                            details: `Bundle '${bundle.name}' has been created.`,
                            data: {
                                id: bundle.id,
                                name: bundle.name,
                                os: bundle.os,
                                version: bundle.version
                            }
                        })
                    );
                } catch (err) {
                    // Use the handleFormError utility to simplify error handling
                    return handleFormError({
                        error: err,
                        form,
                        prisma: locals.prisma,
                        defaultMessage: 'Failed to create bundle. Please try again later.',
                        action: 'bundle creation'
                    });
                }
            } catch (err) {
                logger.error(`Error creating bundle: ${JSON.stringify(err)}`);
                throw err;
            }
        },
        [SystemRole.ADMIN]
    )
};
