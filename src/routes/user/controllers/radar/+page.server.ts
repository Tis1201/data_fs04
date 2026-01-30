import { error } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { restrictModule, type AuthenticatedLoadEvent, type ModuleAuthenticatedEvent } from '$lib/server/security/guards';
import { logger } from '$lib/server/logger';
import { getUserModulePermissions } from '$lib/server/security/modulePermissions';

export const load = restrictModule(
    async ({ url, locals, cookies, depends }: AuthenticatedLoadEvent) => {
        depends('app:userControllersRadar');
        // Get current account ID from cookie or locals
        const currentAccountId = cookies.get('current_account_id') || (locals as { currentAccount?: { account?: { id: string } } }).currentAccount?.account?.id;
        if (!currentAccountId) {
            throw error(403, 'User account not found');
        }
        
        // Get user for permission check
        const user = (locals as any).user;

        try {
            const search = url.searchParams.get('search') || '';
            const page = parseInt(url.searchParams.get('page') || '1');
            const perPage = parseInt(url.searchParams.get('per_page') || '10');
            const sortField = url.searchParams.get('sort_field') || 'createdAt';
            const sortOrder = (url.searchParams.get('sort_order') || 'desc') as 'asc' | 'desc';
            const statuses = url.searchParams.get('statuses')?.split(',').filter(Boolean) || [];
            const locations = url.searchParams.get('locations')?.split(',').filter(Boolean) || [];

            const skip = (page - 1) * perPage;
            const take = perPage;

            const where: {
                type: string;
                accountId: string;
                OR?: Array<{ [key: string]: { contains: string; mode: 'insensitive' } }>;
                status?: { in: string[] };
                location?: { in: string[] };
                controller?: { isDeleted: boolean };
            } = {
                type: 'radar',
                accountId: currentAccountId // Account-scoped
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

            if (locations.length > 0) {
                where.location = { in: locations };
            }

            const baseWhere = {
                type: 'radar' as const,
                accountId: currentAccountId,
                controller: { isDeleted: false }
            };

            const [sensors, totalSensors, locationRows] = await Promise.all([
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
                locals.prisma.sensor.count({
                    where: { ...where, controller: { isDeleted: false } }
                }),
                locals.prisma.sensor.findMany({
                    where: baseWhere,
                    select: { location: true },
                    distinct: ['location']
                })
            ]);

            const totalPages = Math.ceil(totalSensors / perPage);

            const availableLocations = (locationRows as { location: string | null }[])
                .map((r) => r.location)
                .filter((loc): loc is string => loc != null && loc.trim() !== '')
                .sort((a, b) => a.localeCompare(b));

            // Fetch module permissions for the current user in this account
            const modulePermissions = user?.id 
                ? await getUserModulePermissions(user.id, currentAccountId)
                : {};

            return {
                radarSensors: sensors,
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
                availableLocations,
                modulePermissions,
                user: user ? { id: user.id, systemRole: user.systemRole } : null
            };
        } catch (err) {
            logger.error(`Error loading radar sensors: ${err}`);
            throw error(500, 'Failed to load radar sensors');
        }
    },
    'USER_CONTROLLERS_RADAR',
    { action: 'VIEW' }
) satisfies PageServerLoad;

/**
 * Delete sensor action - requires DELETE permission on USER_CONTROLLERS_RADAR.
 */
export const actions: Actions = {
    delete: restrictModule(
        async ({ request, locals }: ModuleAuthenticatedEvent) => {
            const currentAccountId = (locals as { currentAccount?: { account?: { id: string } } }).currentAccount?.account?.id;
            if (!currentAccountId) {
                return { type: 'error', message: 'User account not found' };
            }
            const formData = await request.formData();
            const id = formData.get('id') as string | null;
            if (!id) {
                return { type: 'error', message: 'Sensor id is required' };
            }
            try {
                const sensor = await locals.prisma.sensor.findFirst({
                    where: { id, accountId: currentAccountId, type: 'radar' }
                });
                if (!sensor) {
                    return { type: 'error', message: 'Sensor not found or access denied' };
                }
                await locals.prisma.sensor.delete({ where: { id } });
                return { type: 'success' };
            } catch (err) {
                logger.error(`Error deleting radar sensor ${id}:`, err);
                return { type: 'error', message: err instanceof Error ? err.message : 'Failed to delete sensor' };
            }
        },
        'USER_CONTROLLERS_RADAR',
        { action: 'DELETE' }
    )
};


