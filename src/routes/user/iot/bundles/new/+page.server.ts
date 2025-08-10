import { fail, error, redirect } from '@sveltejs/kit';
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
import { logAudit } from '$lib/server/audit-logger';
import { AuditActionType } from '$lib/constants/system';

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

            const { currentAccount } = locals;
            
            return {
                form,
                accountId: currentAccount.id
            };
        } catch (err) {
            logger.error(`Error loading bundle form: ${JSON.stringify(err)}`);
            throw error(500, 'Failed to load bundle form');
        }
    },
    [SystemRole.USER] // Only allow admin role to access this route
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
                const { currentAccount } = locals;
                console.log({currentAccount});
                
                
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
                            forceUpdate: form.data.forceUpdate || false,
                            autoOpen: (form.data as any).autoOpen || false,
                            status: 'DRAFT', // Always start as draft
                            version: form.data.version || '1.0.0',
                            waveSize: form.data.waveSize || 500,
                            scheduledAt: scheduledDateTime,
                            scheduledAtTimezone: form.data.scheduledAtTimezone || 'UTC',
                            scheduledAtStartIfMissed: form.data.scheduledAtStartIfMissed || false,
                            accountId: currentAccount.accountId,
                            createdBy: userInfo.id,
                            updatedBy: userInfo.id
                        }
                    });
                    
                    logger.info(`Bundle created: ${bundle.id}`);

                    await logAudit({
                        actionType: AuditActionType.INSERT,
                        tableName: 'Bundle',
                        recordId: bundle.id,
                        oldData: null,
                        newData: bundle,
                        userId: locals.user.id,
                        ipAddress: locals.ipAddress,
                        prisma: locals.prisma
                    })
                    
                    // Redirect directly to the newly created bundle detail page
                    throw redirect(303, `/user/iot/bundles/${bundle.id}`);
                } catch (err) {
                    // Allow redirects to pass through
                    if (err instanceof Response || (err as any)?.status === 303) {
                        throw err;
                    }
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
        [SystemRole.USER]
    )
};
