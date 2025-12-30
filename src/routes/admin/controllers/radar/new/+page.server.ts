import { error, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { superValidate } from 'sveltekit-superforms/server';
import { zod } from 'sveltekit-superforms/adapters';
import { restrictModule, type AuthenticatedLoadEvent, type ModuleAuthenticatedEvent } from '$lib/server/security/guards';
import { logger } from '$lib/server/logger';
import { radarSensorSchema } from './radar-sensor';
import { logAudit } from '$lib/server/audit-logger';
import { AuditActionType } from '$lib/constants/system';
import type { Prisma } from '@prisma/client';

export const load = restrictModule(
    async ({ locals }: AuthenticatedLoadEvent) => {
        try {
            const form = await superValidate(zod(radarSensorSchema), {
                id: 'radar-sensor-form'
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

            // Get all devices for easier testing - don't filter by controllers
            const devices = await locals.prisma.device.findMany({
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

            logger.info(`Found ${devices.length} devices available for selection`);

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
    'ADMIN_CONTROLLERS_RADAR',
    { action: 'CREATE' }
) satisfies PageServerLoad;

export const actions: Actions = {
    forceCreate: restrictModule(
        async ({ request, locals }: ModuleAuthenticatedEvent) => {
            const form = await superValidate(request, zod(radarSensorSchema));
            
            if (!form.valid) {
                logger.warn('Invalid form data for force create', form.errors);
                return fail(400, { form });
            }

            if (!form.data.deviceId) {
                return fail(400, { form, error: 'Device is required to create a radar controller' });
            }
            const deviceId = form.data.deviceId as string;

            try {
                // First, check if there's an existing ACTIVE controller+sensor that's causing the constraint issue
                // Only check for non-deleted controllers
                const existingActiveController = await locals.prisma.controller.findFirst({
                    where: {
                        deviceId,
                        type: 'radar',
                        isDeleted: false // Only check for active controllers
                    },
                    include: {
                        sensors: true
                    }
                });

                if (existingActiveController && 'sensors' in existingActiveController) {
                    // Log what we found before attempting cleanup
                    logger.warn(`Force create: Found existing active controller ${existingActiveController.id} for device ${form.data.deviceId}`);
                    
                    // Try to remove the old one in a transaction along with sensors
                    await locals.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
                        // Delete all sensors attached to this controller
                        for (const sensor of existingActiveController.sensors ?? []) {
                            await tx.sensor.delete({
                                where: { id: sensor.id }
                            });
                            logger.info(`Force delete: Removed sensor ${sensor.id}`);
                        }
                        
                        // Hard delete the controller to free the serialNumber constraint
                        await tx.controller.delete({
                            where: { id: existingActiveController.id }
                        });
                        logger.info(`Force delete: Hard deleted controller ${existingActiveController.id}`);
                    });

                    logger.info(`Successfully cleaned up old controller and sensors`);
                }

                // Now proceed with creation as normal
                const controllerSerial = `${form.data.serialNumber}-CTRL`;
                
                // Also clean up any soft-deleted controllers with the same serial
                const softDeletedControllersWithSerial = await locals.prisma.controller.findMany({
                    where: {
                        serialNumber: controllerSerial,
                        isDeleted: true
                    },
                    include: { sensors: true }
                });

                if (softDeletedControllersWithSerial.length > 0) {
                    logger.info(`Force create: Cleaning up ${softDeletedControllersWithSerial.length} soft-deleted controller(s) with serial ${controllerSerial}`);
                    for (const ctrl of softDeletedControllersWithSerial) {
                        // Delete sensors first
                        for (const s of ctrl.sensors) {
                            await locals.prisma.sensor.delete({ where: { id: s.id } });
                            logger.info(`Force delete: Removed orphan sensor ${s.id}`);
                        }
                        // Hard delete the soft-deleted controller
                        await locals.prisma.controller.delete({ where: { id: ctrl.id } });
                        logger.info(`Force delete: Hard deleted soft-deleted controller ${ctrl.id}`);
                    }
                }
                
                const result = await locals.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
                    // Create Controller
                    const controller = await tx.controller.create({
                        data: {
                            name: `${form.data.name} Controller`,
                            serialNumber: controllerSerial,
                            status: form.data.status,
                            accountId: form.data.accountId,
                            deviceId,
                            createdBy: locals.user?.id ?? 'unknown',
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
                            createdBy: locals.user?.id ?? 'unknown',
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
                    userId: locals.user?.id ?? 'unknown',
                    ipAddress: locals.requestContext?.ip ?? 'unknown',
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
        'ADMIN_CONTROLLERS_RADAR',
        { action: 'CREATE' }
    ),
    create: restrictModule(
        async ({ request, locals }: ModuleAuthenticatedEvent) => {
            const form = await superValidate(request, zod(radarSensorSchema));

            if (!form.valid) {
                return fail(400, { form });
            }

            if (!form.data.deviceId) {
                return fail(400, { form, error: 'Device is required to create a radar controller' });
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
                // First, clean up any sensors whose controllers have been soft-deleted to free the serial.
                await locals.prisma.sensor.deleteMany({
                    where: {
                        serialNumber: form.data.serialNumber,
                        controller: { isDeleted: true }
                    }
                });

                const existingSensor = await locals.prisma.sensor.findFirst({
                    where: { serialNumber: form.data.serialNumber },
                    include: {
                        controller: true
                    }
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

                    // Check if already has an active (non-deleted) radar controller
                    // The schema enforces @@unique([deviceId, type, isDeleted]) on Controller.
                    // Only block if there's an active controller, allow if only soft-deleted ones exist.
                    const existingActiveController = await locals.prisma.controller.findFirst({
                        where: {
                            deviceId: form.data.deviceId,
                            type: 'radar',
                            isDeleted: false // Only check for active controllers
                        }
                    });

                    if (existingActiveController) {
                        return fail(400, {
                            form,
                            error: 'This device already has an active radar controller configured. Only one active radar controller is allowed per device.'
                        });
                    }
                }

                // 4. Create Controller and Sensor in Transaction
                // We create a Controller to wrap this Sensor.
                // Controller Serial matches Sensor Serial for simplicity in 1:1 mapping cases, 
                // or we append suffix. Let's use suffix to avoid collision if tables merged later or shared index.
                const controllerSerial = `${form.data.serialNumber}-CTRL`;

                const deviceId = form.data.deviceId as string;

                // Clean up soft-deleted controllers with the same serial to free the unique constraint
                const softDeletedControllersWithSerial = await locals.prisma.controller.findMany({
                    where: {
                        serialNumber: controllerSerial,
                        isDeleted: true
                    },
                    include: { sensors: true }
                });

                if (softDeletedControllersWithSerial.length > 0) {
                    logger.info(`Cleaning up ${softDeletedControllersWithSerial.length} soft-deleted controller(s) with serial ${controllerSerial}`);
                    for (const ctrl of softDeletedControllersWithSerial) {
                        // Delete sensors first
                        for (const s of ctrl.sensors) {
                            await locals.prisma.sensor.delete({ where: { id: s.id } });
                            logger.info(`Deleted orphan sensor ${s.id} from soft-deleted controller ${ctrl.id}`);
                        }
                        // Hard delete the soft-deleted controller to free the serial
                        await locals.prisma.controller.delete({ where: { id: ctrl.id } });
                        logger.info(`Hard deleted soft-deleted controller ${ctrl.id} to free serial ${controllerSerial}`);
                    }
                }

                // Check if controller serial exists for active controllers (unlikely but possible)
                const existingControllerWithSerial = await locals.prisma.controller.findFirst({
                    where: { 
                        serialNumber: controllerSerial,
                        isDeleted: false // Only check active controllers
                    }
                });
                if (existingControllerWithSerial) {
                    return fail(400, {
                        form,
                        error: 'Controller generation failed (Duplicate Serial). Please contact support.'
                    });
                }

                const result = await locals.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
                    // Create Controller
                    const controller = await tx.controller.create({
                        data: {
                            name: `${form.data.name} Controller`,
                            serialNumber: controllerSerial,
                            status: form.data.status,
                            accountId: form.data.accountId,
                            deviceId,
                            createdBy: locals.user?.id ?? 'unknown',
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
                            createdBy: locals.user?.id ?? 'unknown',
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
                    userId: locals.user?.id ?? 'unknown',
                    ipAddress: locals.requestContext?.ip ?? 'unknown',
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
            } catch (err: unknown) {
                logger.error(`Error creating radar sensor: ${err}`);

                // Handle specific Prisma constraint errors
                if (err && typeof err === 'object' && 'code' in err) {
                    const prismaError = err as { code: string; meta?: { target?: string[] } };
                    if (prismaError.code === 'P2002') {
                        const target = prismaError.meta?.target;
                        if (target && Array.isArray(target)) {
                            if (target.includes('deviceId') && target.includes('type')) {
                        return fail(400, {
                            form,
                                    error: 'This device already has a radar controller configured. Only one active radar controller is allowed per device. Use "Force Create" option if you want to replace it.'
                        });
                            } else if (target.includes('serialNumber')) {
                        return fail(400, {
                            form,
                            error: 'A sensor with this serial number already exists. Please use a unique serial number.'
                        });
                    }
                }
                    }
                }

                // Log full error for debugging
                const errorMessage = err instanceof Error ? err.message : String(err);
                logger.error(`Full error details: ${JSON.stringify(err)}`);

                return fail(500, {
                    form,
                    error: `Failed to create radar controller: ${errorMessage}. Please check the logs for more details.`
                });
            }
        },
        'ADMIN_CONTROLLERS_RADAR',
        { action: 'CREATE' }
    )
};
