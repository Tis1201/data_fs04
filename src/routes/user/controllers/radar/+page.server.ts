import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { restrictModule, type AuthenticatedLoadEvent } from '$lib/server/security/guards';
import { logger } from '$lib/server/logger';
import { getUserModulePermissions } from '$lib/server/security/modulePermissions';

export const load = restrictModule(
    async ({ url, locals, cookies }: AuthenticatedLoadEvent) => {
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

            const skip = (page - 1) * perPage;
            const take = perPage;

            const where: {
                type: string;
                accountId: string;
                OR?: Array<{ [key: string]: { contains: string; mode: 'insensitive' } }>;
                status?: { in: string[] };
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


