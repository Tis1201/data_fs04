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
                    scheduledAtStartIfMissed: false,
                    activePeriodDays: 1
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
                
                
                // Process scheduled datetime - convert from user's timezone to UTC
                let scheduledDateTime = null;
                if (form.data.scheduledAt && form.data.scheduledTime) {
                    try {
                        const datePart = form.data.scheduledAt;  // "2025-11-21"
                        const timePart = form.data.scheduledTime; // "08:07"
                        const timezone = form.data.scheduledAtTimezone || 'UTC';
                        
                        // Parse the components
                        const [year, month, day] = datePart.split('-').map(Number);
                        const [hours, minutes] = timePart.split(':').map(Number);
                        
                        // User wants: "2025-11-21 08:07" in their timezone (e.g., America/Los_Angeles)
                        // We need to find the corresponding UTC time
                        
                        // Create a formatter for the target timezone
                        const formatter = new Intl.DateTimeFormat('en-US', {
                            timeZone: timezone,
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                            hour12: false
                        });
                        
                        // Start with a probe: what if we assume it's UTC?
                        const probeUTC = new Date(Date.UTC(year, month - 1, day, hours, minutes, 0));
                        
                        // Format the probe in the target timezone
                        const parts = formatter.formatToParts(probeUTC);
                        const tzYear = parseInt(parts.find(p => p.type === 'year')?.value || '0');
                        const tzMonth = parseInt(parts.find(p => p.type === 'month')?.value || '0');
                        const tzDay = parseInt(parts.find(p => p.type === 'day')?.value || '0');
                        const tzHour = parseInt(parts.find(p => p.type === 'hour')?.value || '0');
                        const tzMinute = parseInt(parts.find(p => p.type === 'minute')?.value || '0');
                        
                        // Calculate the offset: difference between what we got and what we wanted
                        const gotTime = Date.UTC(tzYear, tzMonth - 1, tzDay, tzHour, tzMinute, 0);
                        const wantedTime = Date.UTC(year, month - 1, day, hours, minutes, 0);
                        const offset = wantedTime - gotTime;
                        
                        // Apply the offset to get the correct UTC time
                        scheduledDateTime = new Date(probeUTC.getTime() + offset);
                        
                        logger.info(`Scheduled datetime: User entered ${datePart} ${timePart} ${timezone}, storing as ${scheduledDateTime.toISOString()}`);
                    } catch (error) {
                        logger.error(`Error parsing scheduled datetime with timezone: ${error}`);
                        scheduledDateTime = null;
                    }
                } else if (form.data.scheduledAt) {
                    // Only date provided, use midnight in user's timezone
                    try {
                        const datePart = form.data.scheduledAt;
                        const timezone = form.data.scheduledAtTimezone || 'UTC';
                        const [year, month, day] = datePart.split('-').map(Number);
                        
                        const formatter = new Intl.DateTimeFormat('en-US', {
                            timeZone: timezone,
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                            hour12: false
                        });
                        
                        const probeUTC = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
                        const parts = formatter.formatToParts(probeUTC);
                        const tzYear = parseInt(parts.find(p => p.type === 'year')?.value || '0');
                        const tzMonth = parseInt(parts.find(p => p.type === 'month')?.value || '0');
                        const tzDay = parseInt(parts.find(p => p.type === 'day')?.value || '0');
                        const tzHour = parseInt(parts.find(p => p.type === 'hour')?.value || '0');
                        const tzMinute = parseInt(parts.find(p => p.type === 'minute')?.value || '0');
                        
                        const gotTime = Date.UTC(tzYear, tzMonth - 1, tzDay, tzHour, tzMinute, 0);
                        const wantedTime = Date.UTC(year, month - 1, day, 0, 0, 0);
                        const offset = wantedTime - gotTime;
                        
                        scheduledDateTime = new Date(probeUTC.getTime() + offset);
                    } catch (error) {
                        logger.error(`Error parsing scheduled date: ${error}`);
                        scheduledDateTime = null;
                    }
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
                            activePeriodDays: Math.min(Math.max(form.data.activePeriodDays || 1, 1), 30), // Clamp between 1 and 30
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
