import { error, fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { superValidate } from 'sveltekit-superforms/server';
import { zod } from 'sveltekit-superforms/adapters';
// TODO: Re-enable ACL (restrictModule for USER_CONTROLLERS_RADAR) later.
import { restrict, type AuthenticatedLoadEvent, type AuthenticatedEvent } from '$lib/server/security/guards';
import { SystemRole } from '$lib/types/roles';
import { logger } from '$lib/server/logger';
import { radarSensorSchema } from '../../../../admin/controllers/radar/new/radar-sensor';
import { deviceHasActiveRadarSensor } from '$lib/server/device/radarRegistrationGuards';
import type { Prisma } from '@prisma/client';

export const load = restrict(
    async ({ locals, cookies }: AuthenticatedLoadEvent) => {
        // Get current account ID - user can only create for own account
        const currentAccountId = cookies.get('current_account_id') || (locals as { currentAccount?: { account?: { id: string } } }).currentAccount?.account?.id;
        if (!currentAccountId) {
            throw error(403, 'User account not found');
        }

        try {
            const form = await superValidate(zod(radarSensorSchema), {
                id: 'radar-sensor-form'
            });

            // Get devices from user's account only
            const devices = await locals.prisma.device.findMany({
                where: {
                    accountId: currentAccountId // Account-scoped
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

            logger.info(`Found ${devices.length} devices for account ${currentAccountId}`);

            return {
                form,
                devices,
                currentAccountId // Pre-fill accountId
            };
        } catch (err) {
            logger.error(`Error loading radar sensor form: ${err}`);
            throw error(500, 'Failed to load radar sensor form');
        }
    },
    [SystemRole.USER, SystemRole.ADMIN]
) satisfies PageServerLoad;

export const actions: Actions = {
    create: restrict(
        async ({ request, locals, cookies }: AuthenticatedEvent) => {
            const form = await superValidate(request, zod(radarSensorSchema));

            if (!form.valid) {
                return fail(400, { form });
            }

            // Get current account ID - user can only create for own account
            const currentAccountId = cookies.get('current_account_id') || (locals as { currentAccount?: { account?: { id: string } } }).currentAccount?.account?.id;
            if (!currentAccountId) {
                return fail(403, { form, error: 'User account not found' });
            }

            // Force accountId to current account (security)
            form.data.accountId = currentAccountId;

            if (!form.data.deviceId) {
                return fail(400, { form, error: 'Device is required to create a radar controller' });
            }

            try {
                // Validate device belongs to user's account
                const device = await locals.prisma.device.findUnique({
                    where: { id: form.data.deviceId },
                    include: {
                        account: true,
                        controllers: {
                            where: {
                                type: 'radar',
                                isDeleted: false
                            },
                            include: { sensors: { where: { type: 'radar' } } }
                        }
                    }
                });

                if (!device) {
                    return fail(400, {
                        form,
                        error: 'The selected device does not exist'
                    });
                }

                // Security check: device must belong to user's account
                if (device.accountId !== currentAccountId) {
                    return fail(403, {
                        form,
                        error: 'You can only create controllers for devices in your account'
                    });
                }

                if (deviceHasActiveRadarSensor(device.controllers)) {
                    return fail(400, {
                        form,
                        error: 'This device already has a radar sensor. Only one sensor per device is allowed.'
                    });
                }

                // Clean up any soft-deleted sensors with same serial
                await locals.prisma.sensor.deleteMany({
                    where: {
                        serialNumber: form.data.serialNumber,
                        controller: { isDeleted: true }
                    }
                });

                // Check for existing sensor with same serial
                const existingSensor = await locals.prisma.sensor.findFirst({
                    where: { serialNumber: form.data.serialNumber },
                    include: { controller: true }
                });

                if (existingSensor) {
                    return fail(400, {
                        form,
                        error: 'A sensor with this serial number already exists'
                    });
                }

                const deviceId = form.data.deviceId as string;

                if (device.controllers.length > 0) {
                    const orphanController = device.controllers[0];
                    await locals.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
                        await tx.controller.update({
                            where: { id: orphanController.id },
                            data: {
                                name: `${form.data.name} Controller`,
                                status: form.data.status,
                                createdBy: locals.user?.id ?? 'unknown',
                                updatedAt: new Date()
                            }
                        });
                        await tx.sensor.create({
                            data: {
                                name: form.data.name,
                                serialNumber: form.data.serialNumber,
                                type: 'radar',
                                description: form.data.description,
                                location: form.data.location,
                                firmware: form.data.firmware,
                                status: form.data.status,
                                accountId: currentAccountId,
                                controllerId: orphanController.id,
                                createdBy: locals.user?.id ?? 'unknown',
                                config: {}
                            }
                        });
                    });
                    logger.info(`Re-attached radar sensor via /new to controller ${orphanController.id} for device ${deviceId}`);
                    throw redirect(303, `/user/controllers/radar/${orphanController.id}`);
                }

                const controllerSerial = `${form.data.serialNumber}-CTRL`;

                // Clean up soft-deleted controllers with same serial
                const softDeletedControllers = await locals.prisma.controller.findMany({
                    where: {
                        serialNumber: controllerSerial,
                        isDeleted: true
                    },
                    include: { sensors: true }
                });

                if (softDeletedControllers.length > 0) {
                    for (const ctrl of softDeletedControllers) {
                        for (const s of ctrl.sensors) {
                            await locals.prisma.sensor.delete({ where: { id: s.id } });
                        }
                        await locals.prisma.controller.delete({ where: { id: ctrl.id } });
                    }
                }

                // Check for existing active controller with same serial
                const existingController = await locals.prisma.controller.findFirst({
                    where: { 
                        serialNumber: controllerSerial,
                        isDeleted: false
                    }
                });
                if (existingController) {
                    return fail(400, {
                        form,
                        error: 'Controller generation failed (Duplicate Serial). Please contact support.'
                    });
                }

                // Create Controller and Sensor in Transaction
                const result = await locals.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
                    const controller = await tx.controller.create({
                        data: {
                            name: `${form.data.name} Controller`,
                            serialNumber: controllerSerial,
                            status: form.data.status,
                            accountId: currentAccountId, // Use current account
                            deviceId,
                            createdBy: locals.user?.id ?? 'unknown',
                            type: 'radar'
                        }
                    });

                    const sensor = await tx.sensor.create({
                        data: {
                            name: form.data.name,
                            serialNumber: form.data.serialNumber,
                            type: 'radar',
                            description: form.data.description,
                            location: form.data.location,
                            firmware: form.data.firmware,
                            status: form.data.status,
                            accountId: currentAccountId, // Use current account
                            controllerId: controller.id,
                            createdBy: locals.user?.id ?? 'unknown',
                            config: {}
                        }
                    });

                    return { controller, sensor };
                });

                logger.info(`User created Radar Controller & Sensor: ${result.controller.id} -> ${result.sensor.id}`);

                throw redirect(303, `/user/controllers/radar/${result.controller.id}`);
            } catch (err: unknown) {
                if (err && typeof err === 'object' && 'status' in err && err.status === 303) {
                    throw err; // Re-throw redirect
                }
                logger.error(`Error creating radar sensor: ${err}`);

                if (err && typeof err === 'object' && 'code' in err) {
                    if (err.code === 'P2002') {
                        return fail(400, {
                            form,
                            error: 'A controller or sensor with this serial number already exists. Please use a unique serial number.'
                        });
                    }
                }

                return fail(500, {
                    form,
                    error: 'Failed to create radar sensor. Please try again or contact support.'
                });
            }
        },
        [SystemRole.USER, SystemRole.ADMIN]
    )
};

