import { error, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { restrict, type AuthenticatedLoadEvent } from '$lib/server/security/guards';
import { SystemRole } from '$lib/types/roles';
import { logger } from '$lib/server/logger';
import { logAudit } from '$lib/server/audit-logger';
import { AuditActionType } from '$lib/constants/system';
import type { Prisma } from '@prisma/client';

export const load = restrict(
    async ({ url, locals }: AuthenticatedLoadEvent) => {
        try {
            const search = url.searchParams.get('search') || '';
            const page = parseInt(url.searchParams.get('page') || '1');
            const perPage = parseInt(url.searchParams.get('per_page') || '10');
            const sortField = url.searchParams.get('sort_field') || 'createdAt';
            const sortOrder = url.searchParams.get('sort_order') || 'desc';
            const statuses = url.searchParams.get('statuses')?.split(',').filter(Boolean) || [];
            const accountId = url.searchParams.get('accountId') || '';

            const skip = (page - 1) * perPage;
            const take = perPage;

            // Query controllers instead of sensors to show all controllers, even those without sensors
            const where: {
                type: string;
                isDeleted: boolean;
                OR?: Array<{ [key: string]: { contains: string; mode: 'insensitive' } }>;
                status?: { in: string[] };
                accountId?: string;
            } = {
                type: 'radar',
                isDeleted: false
            };

            if (search) {
                where.OR = [
                    { name: { contains: search, mode: 'insensitive' } },
                    { serialNumber: { contains: search, mode: 'insensitive' } },
                    { id: { contains: search, mode: 'insensitive' } },
                    { description: { contains: search, mode: 'insensitive' } },
                    { sensors: { some: { location: { contains: search, mode: 'insensitive' } } } }
                ];
            }

            if (statuses.length > 0) {
                where.status = { in: statuses };
            }

            if (accountId) {
                where.accountId = accountId;
            }

            // First, get controllers
            const [controllers, totalControllers] = await Promise.all([
                locals.prisma.controller.findMany({
                    where,
                    orderBy: {
                        [sortField]: sortOrder
                    },
                    skip,
                    take,
                    include: {
                        sensors: {
                            where: {
                                type: 'radar'
                            },
                            take: 1, // Get first sensor for display
                            orderBy: {
                                createdAt: 'desc'
                            }
                        },
                        account: {
                            select: {
                                id: true,
                                name: true
                            }
                        },
                        device: {
                            select: {
                                id: true,
                                name: true
                            }
                        }
                    }
                }),
                locals.prisma.controller.count({ where })
            ]);

            // Transform controllers to sensor-like format for compatibility with existing UI
            const sensors = controllers.map(controller => {
                const sensor = controller.sensors[0]; // Get first sensor if exists
                return {
                    id: sensor?.id || controller.id, // Use sensor ID if exists, otherwise controller ID
                    name: sensor?.name || controller.name,
                    serialNumber: sensor?.serialNumber || controller.serialNumber,
                    status: sensor?.status || controller.status,
                    description: sensor?.description || controller.description,
                    location: sensor?.location || null,
                    firmware: sensor?.firmware || null,
                    createdAt: sensor?.createdAt || controller.createdAt,
                    updatedAt: sensor?.updatedAt || controller.updatedAt,
                    accountId: controller.accountId,
                    account: controller.account,
                    controller: {
                        id: controller.id,
                        name: controller.name,
                        device: controller.device
                    },
                    config: sensor?.config || null
                };
            });

            const totalSensors = totalControllers;

            const totalPages = Math.ceil(totalSensors / perPage);

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

            return {
                radarSensors: sensors, // Keeping prop name for now
                accounts,
                meta: {
                    totalItems: totalSensors,
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
            logger.error(`Error loading radar sensors: ${err}`);
            throw error(500, 'Failed to load radar sensors');
        }
    },
    [SystemRole.ADMIN]
);

export const actions: Actions = {
    deleteRadarSensor: restrict(
        async ({ request, locals }: AuthenticatedLoadEvent) => {
            const formData = await request.formData();
            const id = formData.get('id')?.toString(); // sensor id

            if (!id) {
                return fail(400, { error: 'Sensor ID is required' });
            }

            try {
                // Load sensor with controller (non-deleted controller)
                const sensor = await locals.prisma.sensor.findFirst({
                    where: {
                        id,
                        type: 'radar',
                        controller: {
                            isDeleted: false
                        }
                    },
                    include: {
                        controller: true
                    }
                });

                if (!sensor || !sensor.controller) {
                    return fail(404, { error: 'Sensor or controller not found' });
                }

                // Hard delete both sensor and controller in a transaction
                const result = await locals.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
                    // First delete the sensor
                    const deletedSensor = await tx.sensor.delete({
                        where: { id: sensor.id }
                    });

                    // Then hard delete the controller to free the serialNumber constraint
                    const deletedController = await tx.controller.delete({
                        where: { id: sensor.controllerId }
                    });

                    return { controller: deletedController, sensor: deletedSensor };
                });

                logger.info(
                    `Radar Sensor deleted: ${result.sensor.id} (${result.sensor.name}), controller deleted: ${result.controller.id}`
                );

                await logAudit({
                    actionType: AuditActionType.DELETE,
                    tableName: 'Sensor',
                    recordId: id,
                    oldData: sensor,
                    newData: null,
                    userId: locals.user?.id ?? 'unknown',
                    ipAddress: locals.requestContext?.ip ?? 'unknown',
                    prisma: locals.prisma
                });

                await logAudit({
                    actionType: AuditActionType.DELETE,
                    tableName: 'Controller',
                    recordId: result.controller.id,
                    oldData: sensor.controller,
                    newData: null,
                    userId: locals.user?.id ?? 'unknown',
                    ipAddress: locals.requestContext?.ip ?? 'unknown',
                    prisma: locals.prisma
                });

                return { success: true };
            } catch (err) {
                const errorMsg = err instanceof Error ? err.message : 'Unknown error';
                logger.error(`Error deleting radar sensor ${id}: ${errorMsg}`);

                if (errorMsg.includes('Foreign key constraint')) {
                    return fail(400, { error: 'Cannot delete sensor - it is still referenced by other records.' });
                } else if (errorMsg.includes('Record to delete does not exist')) {
                    return fail(404, { error: 'Sensor not found or already deleted.' });
                } else {
                    return fail(500, { error: `Failed to delete sensor: ${errorMsg}` });
                }
            }
        },
        [SystemRole.ADMIN]
    ),
};
