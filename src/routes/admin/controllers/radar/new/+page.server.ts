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

            // Get all devices first to see if any exist
            const deviceCount = await locals.prisma.device.count();
            logger.info(`Total devices in database: ${deviceCount}`);

            // Get all devices and their controllers (including deleted ones for debugging)
            const allDevices = await locals.prisma.device.findMany({
                include: {
                    controllers: {
                        where: {
                            type: 'radar'
                            // Don't filter by isDeleted here - get all radar controllers
                        }
                    },
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

            logger.info(`Found ${allDevices.length} devices total`);
            logger.info(`Devices with all controllers:`, allDevices.map(d => ({ 
                name: d.name, 
                totalControllers: d.controllers.length,
                activeControllers: d.controllers.filter(c => !c.isDeleted).length,
                deletedControllers: d.controllers.filter(c => c.isDeleted).length
            })));

            // Filter out devices that have active (non-deleted) radar controllers
            const devices = allDevices.filter(device => {
                const activeRadarControllers = device.controllers.filter(c => !c.isDeleted);
                return activeRadarControllers.length === 0;
            });
            
            logger.info(`Available devices after filtering: ${devices.length}`);
            logger.info(`Available device names:`, devices.map(d => d.name));

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
    forceCreate: restrict(
        async ({ request, locals }) => {
            const form = await superValidate(request, zod(radarSensorSchema));
            
            if (!form.valid) {
                logger.warn('Invalid form data for force create', form.errors);
                return fail(400, { form });
            }

            try {
                // First, check if there's an existing controller+sensor that's causing the constraint issue
                const existingController = await locals.prisma.controller.findFirst({
                    where: {
                        deviceId: form.data.deviceId,
                        type: 'radar'
                    },
                    include: {
                        sensors: true
                    }
                });

                if (existingController) {
                    // Log what we found before attempting cleanup
                    logger.warn(`Force create: Found existing controller ${existingController.id} for device ${form.data.deviceId}`);
                    
                    // Try to remove the old one in a transaction along with sensors
                    await locals.prisma.$transaction(async (tx) => {
                        // Delete all sensors attached to this controller
                        for (const sensor of existingController.sensors) {
                            await tx.sensor.delete({
                                where: { id: sensor.id }
                            });
                            logger.info(`Force delete: Removed sensor ${sensor.id}`);
                        }
                        
                        // Delete the controller
                        await tx.controller.delete({
                            where: { id: existingController.id }
                        });
                        logger.info(`Force delete: Removed controller ${existingController.id}`);
                    });

                    logger.info(`Successfully cleaned up old controller and sensors`);
                }

                // Now proceed with creation as normal
                const controllerSerial = `${form.data.serialNumber}-CTRL`;
                
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

                logger.info(`Force Create: Created new radar controller ${result.controller.id} and sensor ${result.sensor.id}`);

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
                        text: 'Radar Sensor forcefully created successfully',
                        details: `Radar Sensor '${result.sensor.name}' has been registered after cleaning up old data.`
                    }
                };
            } catch (err) {
                logger.error(`Error in force create: ${err}`);
                return fail(500, {
                    form,
                    error: 'Failed to force create radar sensor. Please try again or contact support.'
                });
            }
        },
        ['ADMIN']
    ),
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

                    // Check if already has a radar controller
                    // The schema enforces @@unique([deviceId, type]) on Controller.
                    // If a controller exists, we cannot create another one for this device.
                    const existingController = await locals.prisma.controller.findFirst({
                        where: {
                            deviceId: form.data.deviceId,
                            type: 'radar'
                        }
                    });

                    if (existingController) {
                        return fail(400, {
                            form,
                            error: 'This device already has a radar controller configured. Only one radar controller is allowed per device.'
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
        [SystemRole.ADMIN]
    )
};
