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
        try {
            const form = await superValidate(zod(radarSensorSchema), {
                id: 'radar-sensor-form',
                defaults: {
                    status: 'INACTIVE'
                }
            });

            const accounts = await locals.prisma.account.findMany({
                where: { isSystem: false },
                select: {
                    id: true,
                    name: true
                },
                orderBy: {
                    name: 'asc'
                }
            });

            // Find devices that don't have a Controller with a Radar Sensor
            const devices = await locals.prisma.device.findMany({
                where: {
                    controllers: {
                        none: {
                            sensors: {
                                some: {
                                    type: 'radar'
                                }
                            }
                        }
                    }
                },
                select: {
                    id: true,
                    name: true,
                    hardwareId: true,
                    status: true,
                    connected: true,
                    accountId: true,
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

            return {
                form,
                accounts,
                devices
            };
        } catch (err) {
            logger.error(`Error loading radar sensor form: ${err}`);
            throw error(500, 'Failed to load radar sensor form');
        }
    },
    [SystemRole.ADMIN]
) satisfies PageServerLoad;

export const actions: Actions = {
    create: restrict(
        async ({ request, locals }) => {
            const form = await superValidate(request, zod(radarSensorSchema));

            if (!form.valid) {
                return fail(400, { form });
            }

            try {
                // 1. Validate Account
                const account = await locals.prisma.account.findUnique({
                    where: { id: form.data.accountId }
                });

                if (!account) {
                    return fail(400, {
                        form,
                        error: 'The selected account does not exist'
                    });
                }

                // 2. Validate Serial Number Uniqueness (Sensor level)
                const existingSensor = await locals.prisma.sensor.findUnique({
                    where: { serialNumber: form.data.serialNumber }
                });

                if (existingSensor) {
                    return fail(400, {
                        form,
                        error: 'A sensor with this serial number already exists'
                    });
                }

                // 3. Validate Device (if selected)
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

                    // Check if already has a radar sensor
                    const hasRadar = device.controllers.some(c => c.sensors.some(s => s.type === 'radar'));
                    if (hasRadar) {
                        return fail(400, {
                            form,
                            error: 'The selected device is already linked to another radar sensor'
                        });
                    }
                }

                // 4. Create Controller and Sensor in Transaction
                // We create a Controller to wrap this Sensor.
                // Controller Serial matches Sensor Serial for simplicity in 1:1 mapping cases, 
                // or we append suffix. Let's use suffix to avoid collision if tables merged later or shared index.
                const controllerSerial = `${form.data.serialNumber}-CTRL`;

                // Check if controller serial exists (unlikely but possible)
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
                    // Create Controller
                    const controller = await tx.controller.create({
                        data: {
                            name: `${form.data.name} Controller`,
                            serialNumber: controllerSerial,
                            status: form.data.status,
                            accountId: form.data.accountId,
                            deviceId: form.data.deviceId || null,
                            createdBy: locals.user.id,
                            type: 'radar'
                        }
                    });

                    // Create Sensor
                    const sensor = await tx.sensor.create({
                        data: {
                            name: form.data.name,
                            serialNumber: form.data.serialNumber,
                            type: 'radar',
                            description: form.data.description,
                            location: form.data.location,
                            firmware: form.data.firmware,
                            status: form.data.status,
                            accountId: form.data.accountId,
                            controllerId: controller.id,
                            createdBy: locals.user.id,
                            config: {} // Empty config initially
                        }
                    });

                    return { controller, sensor };
                });

                logger.info(`Radar Controller & Sensor created: ${result.controller.id} -> ${result.sensor.id}`);

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
                    message: {
                        type: 'success' as const,
                        text: 'Radar Sensor registered successfully',
                        details: `Radar Sensor '${result.sensor.name}' has been registered.`
                    }
                };
            } catch (err) {
                logger.error(`Error creating radar sensor: ${err}`);
                return fail(500, {
                    form,
                    error: 'Failed to register radar sensor. Please try again.'
                });
            }
        },
        [SystemRole.ADMIN]
    )
};
