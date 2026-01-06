import { error, fail, redirect } from '@sveltejs/kit';
import { superValidate } from 'sveltekit-superforms/server';
import { zod } from 'sveltekit-superforms/adapters';
import { logger } from '$lib/server/logger';
import { restrictModule, type ModuleAuthenticatedEvent } from '$lib/server/security/guards';
import { trackingAreaSchema } from '../tracking-area-schema';
import type { PageServerLoad, Actions } from './$types';
import { getUserModulePermissions } from '$lib/server/security/modulePermissions';

export const load: PageServerLoad = restrictModule(
    async ({ locals, params }) => {
        if (!locals.user) {
            throw redirect(302, '/auth/login');
        }

        const controllerId = params.id;
        if (!controllerId) {
            throw error(400, 'Controller ID is required');
        }

        try {
            // Get controller with sensor
            const controller = await locals.prisma.controller.findUnique({
                where: { id: controllerId },
                include: {
                    sensors: true,
                    device: true,
                    account: true
                }
            });

            if (!controller) {
                throw error(404, 'Controller not found');
            }

            // Initialize tracking area form
            const trackingAreaForm = await superValidate(zod(trackingAreaSchema));

            // Set default values
            trackingAreaForm.data.startX = -4.0;
            trackingAreaForm.data.startY = 0.0;
            trackingAreaForm.data.endX = 4.0;
            trackingAreaForm.data.endY = 4.0;

            // Get module permissions for frontend
            let modulePermissions = (locals as any).modulePermissions || {};
            const currentAccountId = (locals as any).currentAccount?.account?.id;
            if (Object.keys(modulePermissions).length === 0 && currentAccountId && locals.user?.id) {
                try {
                    modulePermissions = await getUserModulePermissions(locals.user.id, currentAccountId);
                } catch (e) { /* ignore */ }
            }

            return {
                controller,
                trackingAreaForm,
                modulePermissions,
                user: locals.user
            };
        } catch (err) {
            logger.error(`Error loading configure page: ${err}`);
            throw error(500, 'Failed to load controller configuration');
        }
    },
    'ADMIN_CONTROLLERS_RADAR',
    { action: 'EDIT' }
);

export const actions: Actions = {
    createTrackingArea: restrictModule(
        async ({ request, locals, params }: ModuleAuthenticatedEvent) => {
            const controllerId = params.id;
            if (!controllerId) {
                return fail(400, { error: 'Controller ID is required' });
            }

            const form = await superValidate(request, zod(trackingAreaSchema));
            
            if (!form.valid) {
                logger.warn('Invalid tracking area form data', form.errors);
                return fail(400, { form });
            }

            try {
                // Get the sensor for this controller
                const sensor = await locals.prisma.sensor.findFirst({
                    where: { 
                        controllerId: controllerId,
                        type: 'radar'
                    }
                });

                if (!sensor) {
                    return fail(404, {
                        form,
                        error: 'Radar sensor not found for this controller'
                    });
                }

                // Update sensor config with tracking area
                const config = {
                    trackingArea: {
                        name: form.data.name,
                        startX: form.data.startX,
                        startY: form.data.startY,
                        endX: form.data.endX,
                        endY: form.data.endY,
                        description: form.data.description
                    },
                    zones: [],
                    dwellBuckets: []
                };

                await locals.prisma.sensor.update({
                    where: { id: sensor.id },
                    data: { config }
                });

                logger.info(`Tracking area created for sensor: ${sensor.id}`);

                return {
                    form,
                    success: true,
                    message: {
                        type: 'success' as const,
                        text: 'Tracking area created successfully',
                        details: `Tracking area '${form.data.name}' has been configured for the radar sensor.`
                    }
                };
            } catch (err) {
                logger.error(`Error creating tracking area: ${err}`);
                return fail(500, {
                    form,
                    error: 'Failed to create tracking area. Please try again.'
                });
            }
        },
        'ADMIN_CONTROLLERS_RADAR',
        { action: 'EDIT' }
    )
};
