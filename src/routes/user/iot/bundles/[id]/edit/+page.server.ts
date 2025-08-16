import { error, fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { superValidate } from 'sveltekit-superforms/server';
import { zod } from 'sveltekit-superforms/adapters';
import { logger } from '$lib/server/logger';
import { restrict } from '$lib/server/security/guards';
import { SystemRole } from '$lib/types/roles';
import { bundleSchema } from '../../new/bundle';
import { AuditActionType } from '$lib/constants/system';
import { logAudit } from '$lib/server/audit-logger';

export const load = restrict(
    async ({ params, locals }) => {
        try {
            const { id } = params;
            
            // Load existing bundle
            const bundle = await locals.prisma.bundle.findUnique({
                where: { id },
                include: {
                    apps: {
                        include: {
                            resource: true
                        },
                        orderBy: {
                            order: 'asc'
                        }
                    },
                    waves: {
                        orderBy: {
                            createdAt: 'desc'
                        }
                    }
                }
            });

            if (!bundle) {
                throw error(404, "Bundle not found");
            }

            // Disallow editing if not DRAFT
            if (bundle.status !== 'DRAFT') {
                throw error(403, 'Bundle is not editable after publish');
            }

            // Prepare form data from the bundle
            const form = await superValidate({
                id: bundle.id,
                name: bundle.name,
                description: bundle.description || "",
                accountId: bundle.accountId || "",
                os: bundle.os,
                version: bundle.version || "",
                waveSize: bundle.waveSize || 0,
                scheduledAt: bundle.scheduledAt ? bundle.scheduledAt.toISOString() : null,
                // Let client compute local HH:mm from scheduledAt to avoid timezone mismatch
                scheduledTime: null,
                reboot: bundle.reboot || false,
                forceUpdate: (bundle as any).forceUpdate || false,
                autoOpen: (bundle as any).autoOpen || false,
            }, zod(bundleSchema));

            return {
                form,
                bundle,
            };
        } catch (e) {
            logger.error(`Error loading bundle for edit: ${JSON.stringify(e)}`);
            throw error(500, 'Failed to load bundle');
        }
    },
    [SystemRole.USER]
) satisfies PageServerLoad;

export const actions: Actions = {
    /**
     * Update bundle data
     */
    save: restrict(
        async ({ request, params, locals }) => {
            const id = params.id;

            const form = await superValidate(request, zod(bundleSchema));
            logger.debug(`Update bundle form data: ${JSON.stringify(form)}`);

            if (!form.valid) {
                return fail(400, { form });
            }

            try {
                // Start a transaction to ensure data consistency
                await locals.prisma.$transaction(async (tx) => {
                    // First check if bundle exists and is DRAFT
                    const existingBundle = await tx.bundle.findUnique({ where: { id } });

                    if (!existingBundle) {
                        return fail(404, {
                            form,
                            error: 'Bundle not found'
                        });
                    }
                    if (existingBundle.status !== 'DRAFT') {
                        return fail(403, { form, error: 'Bundle is not editable after publish' });
                    }

                    // Prepare update data
                    // Combine scheduledAt (date) and scheduledTime (HH:mm) into a single Date if both provided
                    const combineDateTime = (dateVal: any, timeStr: any): Date | null => {
                        try {
                            if (!dateVal) return null;
                            const d = new Date(dateVal);
                            if (!timeStr || typeof timeStr !== 'string') return d;
                            const [hh, mm] = timeStr.split(':').map((v: string) => parseInt(v, 10));
                            if (!isNaN(hh)) d.setHours(hh);
                            if (!isNaN(mm)) d.setMinutes(mm);
                            d.setSeconds(0, 0);
                            return d;
                        } catch {
                            return dateVal ? new Date(dateVal) : null;
                        }
                    };

                    const updateData = {
                        name: form.data.name,
                        description: form.data.description || null,
                        os: form.data.os,
                        version: form.data.version || null,
                        waveSize: form.data.waveSize || null,
                        scheduledAt: combineDateTime(form.data.scheduledAt, (form.data as any).scheduledTime) || null,
                        reboot: form.data.reboot,
                        forceUpdate: form.data.forceUpdate,
                        autoOpen: (form.data as any).autoOpen ?? false,
                    };

                    // Update bundle
                    const bundle = await tx.bundle.update({
                        where: { id },
                        data: updateData
                    });

                    await logAudit({
                        actionType: AuditActionType.UPDATE,
                        tableName: 'Bundle',
                        recordId: id,
                        oldData: existingBundle,
                        newData: bundle,
                        userId: locals.user.id,
                        ipAddress: locals.ipAddress,
                        prisma: tx
                    });
                });

                // Redirect back to the bundle detail page after successful update
                throw redirect(303, `/user/iot/bundles/${id}`);
            } catch (e) {
                if (e instanceof Response || (e as any)?.status === 303) {
                    throw e; // This is the redirect
                }
                
                logger.error(`Error updating bundle: ${JSON.stringify(e)}`);
                return fail(500, {
                    form,
                    error: 'Failed to update bundle'
                });
            }
        },
        [SystemRole.USER]
    ),
    
    cancel: restrict(
        async ({ params }) => {
            // Redirect back to the bundle detail page
            throw redirect(303, `/user/iot/bundles/${params.id}`);
        },
        [SystemRole.USER]
    )
};
