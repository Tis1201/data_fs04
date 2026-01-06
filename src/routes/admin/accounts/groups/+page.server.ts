import { error, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { restrictModule, type AuthenticatedLoadEvent, type ModuleAuthenticatedEvent } from '$lib/server/security/guards';
import { logger } from '$lib/server/logger';
import { logAudit } from '$lib/server/audit-logger';
import { AuditActionType } from '$lib/constants/system';
import { getUserModulePermissions } from '$lib/server/security/modulePermissions';

export const load = restrictModule(
    async ({ url, locals }: AuthenticatedLoadEvent) => {
        try {
            // Get query parameters for filtering, sorting, and pagination
            const search = url.searchParams.get('search') || '';
            const page = parseInt(url.searchParams.get('page') || '1');
            const perPage = parseInt(url.searchParams.get('per_page') || '10');
            const sortField = url.searchParams.get('sort_field') || 'createdAt';
            const sortOrder = url.searchParams.get('sort_order') || 'desc';
            const statuses = url.searchParams.get('statuses')?.split(',').filter(Boolean) || [];
            const accountId = url.searchParams.get('accountId') || '';

            // Calculate pagination values
            const skip = (page - 1) * perPage;
            const take = perPage;

            // Build the where clause for filtering
            const where: any = {};
            
            // Add search filter if provided
            if (search) {
                where.OR = [
                    { name: { contains: search, mode: 'insensitive' } },
                    { id: { contains: search, mode: 'insensitive' } },
                    { description: { contains: search, mode: 'insensitive' } }
                ];
            }
            
            // Note: Group model doesn't have a status field in the schema
            
            // Add account filter if provided
            if (accountId) {
                where.accountId = accountId;
            }

            // Query groups with filtering, sorting, and pagination
            const [groups, totalGroups] = await Promise.all([
                locals.prisma.group.findMany({
                    where,
                    orderBy: {
                        [sortField]: sortOrder
                    },
                    skip,
                    take,
                    select: {
                        id: true,
                        name: true,

                        description: true,
                        createdAt: true,
                        updatedAt: true,
                        accountId: true,
                        account: {
                            select: {
                                id: true,
                                name: true
                            }
                        },
                        _count: {
                            select: {
                                members: true
                            }
                        }
                    }
                }),
                locals.prisma.group.count({ where })
            ]);

            // Calculate pagination metadata
            const totalPages = Math.ceil(totalGroups / perPage);

            // Note: Group model doesn't have a status field in the schema
                
            // Get all accounts for filtering
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

            // Get module permissions for frontend
            let modulePermissions = (locals as any).modulePermissions || {};
            const currentAccountId = (locals as any).currentAccount?.account?.id;
            if (Object.keys(modulePermissions).length === 0 && currentAccountId && locals.user?.id) {
                try {
                    modulePermissions = await getUserModulePermissions(locals.user.id, currentAccountId);
                } catch (e) { /* ignore */ }
            }

            // Return the data
            return {
                groups,
                accounts,
                meta: {
                    totalItems: totalGroups,
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
                user: locals.user
            };
        } catch (err) {
            logger.error('Error loading groups:', { error: err });
            throw error(500, 'Failed to load groups');
        }
    },
    'GROUPS',
    { action: 'VIEW' }
);

export const actions: Actions = {
    deleteGroup: restrictModule(
        async ({ request, locals, auth, getClientAddress }: ModuleAuthenticatedEvent) => {
            const formData = await request.formData();
            const id = formData.get('id')?.toString();

            if (!id) {
                return fail(400, { error: 'Group ID is required' });
            }

            try {
                // Check if group exists first
                const existingGroup = await locals.prisma.group.findUnique({
                    where: { id },
                    select: {
                        id: true,
                        name: true,
                        _count: {
                            select: {
                                members: true
                            }
                        }
                    }
                });

                if (!existingGroup) {
                    return fail(404, { error: 'Group not found' });
                }

                // Check if group has members that would prevent deletion
                const hasMembers = existingGroup._count.members > 0;

                if (hasMembers) {
                    const errorMsg = `Cannot delete group with existing members: ${existingGroup._count.members} members. Please remove all members first.`;
                    logger.warn(`Deletion blocked for group ${id}: ${errorMsg}`);
                    
                    return fail(400, { error: errorMsg });
                }

                // Delete the group
                const deletedGroup = await locals.prisma.group.delete({
                    where: { id }
                });

                logger.info(`Group successfully deleted: ${deletedGroup.id} (${deletedGroup.name})`);

                await logAudit({
                    actionType: AuditActionType.DELETE,
                    tableName: 'Group',
                    recordId: id,
                    oldData: deletedGroup,
                    newData: null,
                    userId: auth?.user?.id ?? '',
                    ipAddress: getClientAddress(),
                    prisma: locals.prisma
                });

                return { success: true };
            } catch (err) {
                const errorMsg = err instanceof Error ? err.message : 'Unknown error';
                logger.error(`Error deleting group ${id}:`, { 
                    message: errorMsg, 
                    groupId: id
                });
                
                // Provide more specific error messages based on the error type
                if (errorMsg.includes('Foreign key constraint')) {
                    return fail(400, { error: 'Cannot delete group - it is still referenced by other records. Please remove all related data first.' });
                } else if (errorMsg.includes('Record to delete does not exist')) {
                    return fail(404, { error: 'Group not found or already deleted.' });
                } else {
                    return fail(500, { error: `Failed to delete group: ${errorMsg}` });
                }
            }
        },
        'GROUPS',
        { action: 'DELETE' }
    ),
};
