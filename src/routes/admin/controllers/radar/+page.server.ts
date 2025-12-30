import { error, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { restrictModule, type AuthenticatedLoadEvent, type ModuleAuthenticatedEvent } from '$lib/server/security/guards';
import { logger } from '$lib/server/logger';
import { logAudit } from '$lib/server/audit-logger';
import { AuditActionType } from '$lib/constants/system';
import type { Prisma } from '@prisma/client';
import { getUserModulePermissions } from '$lib/server/security/modulePermissions';

export const load = restrictModule(
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

            const where: {
                type: string;
                OR?: Array<{ [key: string]: { contains: string; mode: 'insensitive' } }>;
                status?: { in: string[] };
                accountId?: string;
            } = {
                type: 'radar'
            };

            if (search) {
                where.OR = [
                    { name: { contains: search, mode: 'insensitive' } },
                    { serialNumber: { contains: search, mode: 'insensitive' } },
                    { id: { contains: search, mode: 'insensitive' } },
                    { description: { contains: search, mode: 'insensitive' } },
                    { location: { contains: search, mode: 'insensitive' } }
                ];
            }

            if (statuses.length > 0) {
                where.status = { in: statuses };
            }

            if (accountId) {
                where.accountId = accountId;
            }

            const [sensors, totalSensors] = await Promise.all([
                locals.prisma.sensor.findMany({
                    where: {
                        ...where,
                        controller: {
                            isDeleted: false // Only show sensors with non-deleted controllers
                        }
                    },
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
                        description: true,
                        location: true,
                        firmware: true,
                        createdAt: true,
                        updatedAt: true,
                        accountId: true,
                        account: {
                            select: {
                                id: true,
                                name: true
                            }
                        },
                        controller: {
                            select: {
                                id: true,
                                name: true,
                                device: {
                                    select: {
                                        id: true,
                                        name: true
                                    }
                                }
                            }
                        },
                        config: true
                    }
                }),
                locals.prisma.sensor.count({ where })
            ]);

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

            // Get module permissions for the current user
            // For ADMIN users, this returns empty but canCreate/canDelete will return true due to systemRole check
            let modulePermissions = (locals as any).modulePermissions || {};
            
            // If no cached permissions and we have account context, fetch them
            const currentAccountId = (locals as any).currentAccount?.account?.id;
            if (Object.keys(modulePermissions).length === 0 && currentAccountId && locals.user?.id) {
                try {
                    modulePermissions = await getUserModulePermissions(locals.user.id, currentAccountId);
                } catch (err) {
                    logger.warn('Failed to fetch module permissions', { error: err });
                }
            }

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
                },
                // Pass permissions to frontend for button visibility
                modulePermissions,
                user: locals.user
            };
        } catch (err) {
            logger.error(`Error loading radar sensors: ${err}`);
            throw error(500, 'Failed to load radar sensors');
        }
    },
    'ADMIN_CONTROLLERS_RADAR',
    { action: 'VIEW' }
);

export const actions: Actions = {
    deleteRadarSensor: restrictModule(
        async ({ request, locals }: ModuleAuthenticatedEvent) => {
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
        'ADMIN_CONTROLLERS_RADAR',
        { action: 'DELETE' }
    ),
};
