import { error, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { restrict } from '$lib/server/security/guards';
import { SystemRole } from '$lib/types/roles';
import { logger } from '$lib/server/logger';
import { logAudit } from '$lib/server/audit-logger';
import { AuditActionType } from '$lib/constants/system';

export const load = restrict(
    async ({ url, locals }) => {
        try {
            const search = url.searchParams.get('search') || '';
            const page = parseInt(url.searchParams.get('page') || '1');
            const perPage = parseInt(url.searchParams.get('per_page') || '10');
            const sortField = url.searchParams.get('sort_field') || 'createdAt';
            const sortOrder = url.searchParams.get('sort_order') || 'desc';
            const statuses = url.searchParams.get('statuses')?.split(',').filter(Boolean) || [];

            // Get the user's current account ID for scoping
            const accountId = locals.currentAccount?.account?.id;

            if (!accountId) {
                throw error(403, 'No account selected');
            }

            const skip = (page - 1) * perPage;
            const take = perPage;

            // Query controllers directly (not sensors) to show all radar controllers
            // including auto-created ones that may not have sensors yet
            const where: any = {
                type: 'radar',
                isDeleted: false,
                accountId // Only show controllers belonging to user's account
            };

            if (search) {
                where.OR = [
                    { name: { contains: search, mode: 'insensitive' } },
                    { serialNumber: { contains: search, mode: 'insensitive' } },
                    { id: { contains: search, mode: 'insensitive' } }
                ];
            }

            if (statuses.length > 0) {
                where.status = { in: statuses };
            }

            const [controllers, totalControllers] = await Promise.all([
                locals.prisma.controller.findMany({
                    where,
                    orderBy: {
                        [sortField]: sortOrder
                    },
                    skip,
                    take,
                    select: {
                        id: true,
                        name: true,
                        serialNumber: true,
                        status: true,
                        createdAt: true,
                        updatedAt: true,
                        accountId: true,
                        device: {
                            select: {
                                id: true,
                                name: true
                            }
                        },
                        sensors: {
                            where: { type: 'radar' },
                            select: {
                                id: true,
                                name: true,
                                serialNumber: true,
                                location: true,
                                config: true
                            }
                        }
                    }
                }),
                locals.prisma.controller.count({ where })
            ]);

            // Transform data to match existing table format
            const radarSensors = controllers.map(controller => {
                const sensor = controller.sensors[0]; // Get first radar sensor if exists
                return {
                    id: sensor?.id || controller.id, // Use sensor ID if exists, else controller ID
                    name: sensor?.name || controller.name,
                    serialNumber: sensor?.serialNumber || controller.serialNumber,
                    status: controller.status,
                    location: sensor?.location || null,
                    createdAt: controller.createdAt,
                    updatedAt: controller.updatedAt,
                    accountId: controller.accountId,
                    controller: {
                        id: controller.id,
                        name: controller.name,
                        device: controller.device
                    },
                    config: sensor?.config || null,
                    // Flag to indicate if sensor exists (for UI)
                    hasSensor: !!sensor
                };
            });

            const totalPages = Math.ceil(totalControllers / perPage);

            return {
                radarSensors,
                meta: {
                    totalItems: totalControllers,
                    itemsPerPage: perPage,
                    totalPages,
                    currentPage: page
                },
                filters: {},
                sort: {
                    field: sortField,
                    order: sortOrder
                }
            };
        } catch (err) {
            logger.error(`Error loading radar controllers: ${err}`);
            throw error(500, 'Failed to load radar controllers');
        }
    },
    [SystemRole.USER]
);

export const actions: Actions = {
    deleteRadarSensor: restrict(
        async ({ request, locals }) => {
            const formData = await request.formData();
            const id = formData.get('id')?.toString();

            if (!id) {
                return fail(400, { error: 'Controller ID is required' });
            }

            // Get user's account ID for ownership check
            const accountId = locals.currentAccount?.account?.id;
            if (!accountId) {
                return fail(403, { error: 'No account selected' });
            }

            try {
                // First try to find as a sensor
                const existingSensor = await locals.prisma.sensor.findUnique({
                    where: { id },
                    select: {
                        id: true,
                        name: true,
                        serialNumber: true,
                        accountId: true,
                        controllerId: true
                    }
                });

                if (existingSensor) {
                    // Ownership check: ensure sensor belongs to user's account
                    if (existingSensor.accountId !== accountId) {
                        return fail(403, { error: 'You do not have permission to delete this sensor' });
                    }

                    const deletedSensor = await locals.prisma.sensor.delete({
                        where: { id }
                    });

                    logger.info(`Radar Sensor successfully deleted: ${deletedSensor.id} (${deletedSensor.name})`);

                    await logAudit({
                        actionType: AuditActionType.DELETE,
                        tableName: 'Sensor',
                        recordId: id,
                        oldData: deletedSensor,
                        newData: null,
                        userId: locals.user.id,
                        ipAddress: locals.ipAddress,
                        prisma: locals.prisma
                    });

                    return { success: true };
                }

                // If not a sensor, try as a controller (for auto-created controllers without sensors)
                const existingController = await locals.prisma.controller.findUnique({
                    where: { id },
                    select: {
                        id: true,
                        name: true,
                        serialNumber: true,
                        accountId: true
                    }
                });

                if (!existingController) {
                    return fail(404, { error: 'Controller not found' });
                }

                // Ownership check
                if (existingController.accountId !== accountId) {
                    return fail(403, { error: 'You do not have permission to delete this controller' });
                }

                // Soft delete the controller
                const deletedController = await locals.prisma.controller.update({
                    where: { id },
                    data: { isDeleted: true }
                });

                logger.info(`Radar Controller successfully deleted: ${deletedController.id} (${deletedController.name})`);

                await logAudit({
                    actionType: AuditActionType.DELETE,
                    tableName: 'Controller',
                    recordId: id,
                    oldData: existingController,
                    newData: { ...existingController, isDeleted: true },
                    userId: locals.user.id,
                    ipAddress: locals.ipAddress,
                    prisma: locals.prisma
                });

                return { success: true };
            } catch (err) {
                const errorMsg = err instanceof Error ? err.message : 'Unknown error';
                logger.error(`Error deleting radar controller ${id}: ${errorMsg}`);

                if (errorMsg.includes('Foreign key constraint')) {
                    return fail(400, { error: 'Cannot delete controller - it is still referenced by other records.' });
                } else if (errorMsg.includes('Record to delete does not exist')) {
                    return fail(404, { error: 'Controller not found or already deleted.' });
                } else {
                    return fail(500, { error: `Failed to delete controller: ${errorMsg}` });
                }
            }
        },
        [SystemRole.USER]
    ),
};
