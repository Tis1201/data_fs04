import { error, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { superValidate } from 'sveltekit-superforms/server';
import { zod } from 'sveltekit-superforms/adapters';
import { restrict } from '$lib/server/security/guards';
import { SystemRole } from '$lib/types/roles';
import { logger } from '$lib/server/logger';
import { radarSensorSchema } from './radar-sensor';
import { logAudit } from '$lib/server/audit-logger';
import { AuditActionType } from '$lib/constants/system';

export const load = restrict(
    async ({ locals }) => {
        const accountId = locals.currentAccount?.account?.id;

        if (!accountId) {
            throw error(403, 'No account selected');
        }

        try {
            const form = await superValidate(zod(radarSensorSchema));

            // Get devices belonging to user's account
            const devices = await locals.prisma.device.findMany({
                where: {
                    accountId
                },
                include: {
                    account: {
                        select: {
                            id: true,
                            name: true
                        }
                    }
                },
                orderBy: {
                    name: 'asc'
                }
            });

            logger.info(`Found ${devices.length} devices for user account ${accountId}`);

            return {
                form,
                devices,
                accountId
            };
        } catch (err) {
            logger.error(`Error loading radar sensor form: ${err}`);
            throw error(500, 'Failed to load radar sensor form');
        }
    },
    [SystemRole.USER]
) satisfies PageServerLoad;

export const actions: Actions = {
    create: restrict(
        async ({ request, locals }) => {
            const accountId = locals.currentAccount?.account?.id;

            if (!accountId) {
                return fail(403, { error: 'No account selected' });
            }

            const form = await superValidate(request, zod(radarSensorSchema));

            logger.info(`[CreateController] Form validated: valid=${form.valid}`);
            logger.info(`[CreateController] Form data: ${JSON.stringify(form.data)}`);
            if (!form.valid) {
                logger.warn(`[CreateController] Validation errors: ${JSON.stringify(form.errors)}`);
            }

            if (!form.valid) {
                return fail(400, { form });
            }

            try {
                // 1. Validate Serial Number Uniqueness (Sensor level)
                const existingSensor = await locals.prisma.sensor.findUnique({
                    where: { serialNumber: form.data.serialNumber }
                });

                if (existingSensor) {
                    return fail(400, {
                        form,
                        error: 'A sensor with this serial number already exists'
                    });
                }

                // 2. Validate Device (if selected) - must belong to user's account
                if (form.data.deviceId) {
                    const device = await locals.prisma.device.findUnique({
                        where: { id: form.data.deviceId },
                        include: {
                            controllers: {
                                include: {
                                    sensors: true
                                }
                            }
                        }
                    });

                    if (!device) {
                        return fail(400, {
                            form,
                            error: 'The selected device does not exist'
                        });
                    }

                    // Ownership check
                    if (device.accountId !== accountId) {
                        return fail(403, {
                            form,
                            error: 'You do not have permission to use this device'
                        });
                    }

                    // Check if already has an active (non-deleted) radar controller
                    const existingActiveController = await locals.prisma.controller.findFirst({
                        where: {
                            deviceId: form.data.deviceId,
                            type: 'radar',
                            isDeleted: false
                        }
                    });

                    if (existingActiveController) {
                        return fail(400, {
                            form,
                            error: 'This device already has an active radar controller configured. Only one active radar controller is allowed per device.'
                        });
                    }
                }

                // 3. Create Controller and Sensor in Transaction
                const controllerSerial = `${form.data.serialNumber}-CTRL`;

                // Check if controller serial exists
                const existingController = await locals.prisma.controller.findUnique({
                    where: { serialNumber: controllerSerial }
                });
                if (existingController) {
                    return fail(400, {
                        form,
                        error: 'Controller generation failed (Duplicate Serial). Please contact support.'
                    });
                }

                const result = await locals.prisma.$transaction(async (tx) => {
                    // Create Controller - auto-assign to user's account
                    const controller = await tx.controller.create({
                        data: {
                            name: `${form.data.name} Controller`,
                            serialNumber: controllerSerial,
                            status: form.data.status,
                            accountId: accountId, // Auto-assign to user's account
                            deviceId: form.data.deviceId || null,
                            createdBy: locals.user.id,
                            type: 'radar'
                        }
                    });

                    // Create Sensor - auto-assign to user's account
                    const sensor = await tx.sensor.create({
                        data: {
                            name: form.data.name,
                            serialNumber: form.data.serialNumber,
                            type: 'radar',
                            description: form.data.description,
                            location: form.data.location,
                            firmware: form.data.firmware,
                            status: form.data.status,
                            accountId: accountId, // Auto-assign to user's account
                            controllerId: controller.id,
                            createdBy: locals.user.id,
                            config: {} // Empty config initially
                        }
                    });

                    return { controller, sensor };
                });

                logger.info(`User Radar Controller & Sensor created: ${result.controller.id} -> ${result.sensor.id}`);

                await logAudit({
                    actionType: AuditActionType.INSERT,
                    tableName: 'Sensor',
                    recordId: result.sensor.id,
                    oldData: null,
                    newData: result.sensor,
                    userId: locals.user.id,
                    ipAddress: locals.ipAddress,
                    prisma: locals.prisma
                });

                return {
                    form,
                    success: true,
                    controllerId: result.controller.id,
                    message: {
                        type: 'success' as const,
                        text: 'Radar Controller created successfully',
                        details: `Controller '${result.controller.name}' has been created. Proceeding to sensor configuration.`
                    }
                };
            } catch (err: any) {
                logger.error(`Error creating radar sensor: ${err}`);

                // Handle specific Prisma constraint errors
                if (err.code === 'P2002') {
                    const target = err.meta?.target;
                    if (target?.includes('deviceId') && target?.includes('type')) {
                        return fail(400, {
                            form,
                            error: 'This device already has a radar sensor. Each device can only have one radar sensor.'
                        });
                    } else if (target?.includes('serialNumber')) {
                        return fail(400, {
                            form,
                            error: 'A sensor with this serial number already exists. Please use a unique serial number.'
                        });
                    }
                }

                return fail(500, {
                    form,
                    error: 'Failed to register radar sensor. Please try again.'
                });
            }
        },
        [SystemRole.USER]
    )
};
