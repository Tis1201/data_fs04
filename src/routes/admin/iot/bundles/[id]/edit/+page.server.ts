import { error, fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from '../components/edit/$types';
import { superValidate } from 'sveltekit-superforms/server';
import { zod } from 'sveltekit-superforms/adapters';
import { logger } from '$lib/server/logger';
import { restrict } from '$lib/server/security/guards';
import { SystemRole } from '$lib/types/roles';
import { bundleSchema } from '../../new/bundle';

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
                    },
                    account: {
                        select: {
                            id: true,
                            name: true
                        }
                    }
                }
            });

            if (!bundle) {
                throw error(404, "Bundle not found");
            }

            // Get all accounts for the dropdown
            const accounts = await locals.prisma.account.findMany({
                select: {
                    id: true,
                    name: true
                },
                orderBy: {
                    name: 'asc'
                }
            });

            // Prepare form data from the bundle
            const form = await superValidate(
                {
                    id: bundle.id,
                    name: bundle.name,
                    description: bundle.description || "",
                    accountId: bundle.accountId || "",
                    os: bundle.os,
                    version: bundle.version || "",
                    waveSize: bundle.waveSize || 0,
                    scheduledAt: bundle.scheduledAt ? new Date(bundle.scheduledAt) : undefined,
                    updateStrategy: bundle.updateStrategy,
                    reboot: bundle.reboot || false,
                    forceUpdate: bundle.forceUpdate || false,
                    notifyUser: bundle.notifyUser || false,
                    notificationTitle: bundle.notificationTitle || "",
                    notificationMessage: bundle.notificationMessage || "",
                },
                zod(bundleSchema)
            );

            return {
                form,
                bundle,
                accounts
            };
        } catch (e) {
            logger.error(`Error loading bundle for edit: ${JSON.stringify(e)}`);
            throw error(500, 'Failed to load bundle');
        }
    },
    [SystemRole.ADMIN] // Only allow admin role to access this route
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
                return await locals.prisma.$transaction(async (tx) => {
                    // First check if bundle exists
                    const existingBundle = await tx.bundle.findUnique({
                        where: { id }
                    });

                    if (!existingBundle) {
                        return fail(404, {
                            form,
                            error: 'Bundle not found'
                        });
                    }

                    // Prepare update data
                    const updateData = {
                        name: form.data.name,
                        description: form.data.description || null,
                        accountId: form.data.accountId || null,
                        os: form.data.os,
                        version: form.data.version || null,
                        waveSize: form.data.waveSize || null,
                        scheduledAt: form.data.scheduledAt || null,
                        updateStrategy: form.data.updateStrategy,
                        reboot: form.data.reboot,
                        forceUpdate: form.data.forceUpdate,
                        notifyUser: form.data.notifyUser,
                        notificationTitle: form.data.notificationTitle || null,
                        notificationMessage: form.data.notificationMessage || null,
                    };

                    // Update bundle
                    await tx.bundle.update({
                        where: { id },
                        data: updateData
                    });

                    // Redirect back to the bundle detail page after successful update
                    throw redirect(303, `/admin/iot/bundles/${id}`);
                });
            } catch (e) {
                if (e instanceof Response) {
                    throw e; // This is the redirect
                }
                
                logger.error(`Error updating bundle: ${JSON.stringify(e)}`);
                return fail(500, {
                    form,
                    error: 'Failed to update bundle'
                });
            }
        },
        [SystemRole.ADMIN] // Only allow admin role to access this action
    ),
    
    cancel: restrict(
        async ({ params }) => {
            // Redirect back to the bundle detail page
            throw redirect(303, `/admin/iot/bundles/${params.id}`);
        },
        [SystemRole.ADMIN]
    )
};
