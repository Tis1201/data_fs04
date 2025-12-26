import { error } from '@sveltejs/kit';
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
            const sortOrder = (url.searchParams.get('sort_order') || 'desc') as 'asc' | 'desc';

            const relationshipTypes = url.searchParams.get('relationshipTypes')?.split(',').filter(Boolean) || [];
            const statusFilter = url.searchParams.get('status') || '';
            const parentAccountId = url.searchParams.get('parentAccountId') || '';
            const childAccountId = url.searchParams.get('childAccountId') || '';

            const skip = (page - 1) * perPage;
            const take = perPage;

            const where: any = {};

            if (search) {
                where.OR = [
                    { parentAccount: { name: { contains: search, mode: 'insensitive' } } },
                    { parentAccount: { slug: { contains: search, mode: 'insensitive' } } },
                    { childAccount: { name: { contains: search, mode: 'insensitive' } } },
                    { childAccount: { slug: { contains: search, mode: 'insensitive' } } }
                ];
            }

            if (relationshipTypes.length) {
                where.relationshipType = { in: relationshipTypes };
            }

            if (statusFilter) {
                where.status = statusFilter;
            }

            if (parentAccountId) {
                where.parentAccountId = parentAccountId;
            }

            if (childAccountId) {
                where.childAccountId = childAccountId;
            }

            const [assignments, totalAssignments, distinctParents, distinctChildren, activeCount, suspendedCount, accounts] =
                await Promise.all([
                    locals.prisma.accountAssignment.findMany({
                        where,
                        orderBy: { [sortField]: sortOrder },
                        skip,
                        take,
                        select: {
                            id: true,
                            relationshipType: true,
                            status: true,
                            validFrom: true,
                            validTo: true,
                            createdAt: true,
                            updatedAt: true,
                            parentAccountId: true,
                            childAccountId: true,
                            parentAccount: {
                                select: {
                                    id: true,
                                    name: true,
                                    slug: true
                                }
                            },
                            childAccount: {
                                select: {
                                    id: true,
                                    name: true,
                                    slug: true
                                }
                            }
                        }
                    }),
                    locals.prisma.accountAssignment.count({ where }),
                    locals.prisma.accountAssignment.findMany({
                        where,
                        distinct: ['parentAccountId'],
                        select: { parentAccountId: true }
                    }),
                    locals.prisma.accountAssignment.findMany({
                        where,
                        distinct: ['childAccountId'],
                        select: { childAccountId: true }
                    }),
                    locals.prisma.accountAssignment.count({ where: { ...where, status: 'ACTIVE' } }),
                    locals.prisma.accountAssignment.count({ where: { ...where, status: 'SUSPENDED' } }),
                    locals.prisma.account.findMany({
                        where: { isSystem: false },
                        select: { id: true, name: true, slug: true },
                        orderBy: { name: 'asc' }
                    })
                ]);

            const totalPages = Math.ceil(totalAssignments / perPage);

            return {
                assignments,
                accounts,
                meta: {
                    totalItems: totalAssignments,
                    itemsPerPage: perPage,
                    totalPages,
                    currentPage: page
                },
                filters: {},
                sort: {
                    field: sortField,
                    order: sortOrder
                },
                summary: {
                    parents: distinctParents.length,
                    children: distinctChildren.length,
                    activeLinks: activeCount,
                    suspendedLinks: suspendedCount
                }
            };
        } catch (err) {
            logger.error(`Error loading account hierarchy: ${err}`);
            throw error(500, 'Failed to load account hierarchy');
        }
    },
    [SystemRole.ADMIN]
);

export const actions = {
    suspendAssignment: restrict(
        async ({ request, locals }) => {
            try {
                const formData = await request.formData();
                const assignmentId = formData.get('assignmentId') as string;

                if (!assignmentId) {
                    throw error(400, 'Assignment ID is required');
                }

                // Get existing assignment for audit log
                const existingAssignment = await locals.prisma.accountAssignment.findUnique({
                    where: { id: assignmentId }
                });

                if (!existingAssignment) {
                    throw error(404, 'Assignment not found');
                }

                const updatedAssignment = await locals.prisma.accountAssignment.update({
                    where: { id: assignmentId },
                    data: { status: 'SUSPENDED' }
                });

                // Log audit for assignment update
                await logAudit({
                    actionType: AuditActionType.UPDATE,
                    tableName: 'AccountAssignment',
                    recordId: assignmentId,
                    oldData: existingAssignment,
                    newData: updatedAssignment,
                    userId: locals.auth.user.id,
                    ipAddress: (locals as any).ipAddress || 'unknown',
                    prisma: locals.prisma
                });

                logger.info(`Account assignment ${assignmentId} suspended by user ${locals.auth.user.id}`);
                return { success: true };
            } catch (err) {
                logger.error(`Error suspending assignment: ${err}`);
                throw error(500, 'Failed to suspend assignment');
            }
        },
        [SystemRole.ADMIN]
    ),

    activateAssignment: restrict(
        async ({ request, locals }) => {
            try {
                const formData = await request.formData();
                const assignmentId = formData.get('assignmentId') as string;

                if (!assignmentId) {
                    throw error(400, 'Assignment ID is required');
                }

                // Get existing assignment for audit log
                const existingAssignment = await locals.prisma.accountAssignment.findUnique({
                    where: { id: assignmentId }
                });

                if (!existingAssignment) {
                    throw error(404, 'Assignment not found');
                }

                const updatedAssignment = await locals.prisma.accountAssignment.update({
                    where: { id: assignmentId },
                    data: { status: 'ACTIVE' }
                });

                // Log audit for assignment update
                await logAudit({
                    actionType: AuditActionType.UPDATE,
                    tableName: 'AccountAssignment',
                    recordId: assignmentId,
                    oldData: existingAssignment,
                    newData: updatedAssignment,
                    userId: locals.auth.user.id,
                    ipAddress: (locals as any).ipAddress || 'unknown',
                    prisma: locals.prisma
                });

                logger.info(`Account assignment ${assignmentId} activated by user ${locals.auth.user.id}`);
                return { success: true };
            } catch (err) {
                logger.error(`Error activating assignment: ${err}`);
                throw error(500, 'Failed to activate assignment');
            }
        },
        [SystemRole.ADMIN]
    ),

    deleteAssignment: restrict(
        async ({ request, locals }) => {
            try {
                const formData = await request.formData();
                const assignmentId = formData.get('assignmentId') as string;

                if (!assignmentId) {
                    throw error(400, 'Assignment ID is required');
                }

                // Get existing assignment for audit log
                const existingAssignment = await locals.prisma.accountAssignment.findUnique({
                    where: { id: assignmentId }
                });

                if (!existingAssignment) {
                    throw error(404, 'Assignment not found');
                }

                await locals.prisma.accountAssignment.delete({
                    where: { id: assignmentId }
                });

                // Log audit for assignment deletion
                await logAudit({
                    actionType: AuditActionType.DELETE,
                    tableName: 'AccountAssignment',
                    recordId: assignmentId,
                    oldData: existingAssignment,
                    newData: null,
                    userId: locals.auth.user.id,
                    ipAddress: (locals as any).ipAddress || 'unknown',
                    prisma: locals.prisma
                });

                logger.info(`Account assignment ${assignmentId} deleted by user ${locals.auth.user.id}`);
                return { success: true };
            } catch (err) {
                logger.error(`Error deleting assignment: ${err}`);
                throw error(500, 'Failed to delete assignment');
            }
        },
        [SystemRole.ADMIN]
    ),

    createAssignment: restrict(
        async ({ request, locals }) => {
            try {
                const formData = await request.formData();
                const parentAccountId = formData.get('parentAccountId') as string;
                const childAccountId = formData.get('childAccountId') as string;
                const relationshipType = formData.get('relationshipType') as string;
                const validFrom = formData.get('validFrom') as string;
                const validTo = formData.get('validTo') as string;

                if (!parentAccountId || !childAccountId || !relationshipType) {
                    throw error(400, 'Parent account, child account, and relationship type are required');
                }

                if (parentAccountId === childAccountId) {
                    throw error(400, 'Parent and child accounts cannot be the same');
                }

                // Check if relationship already exists
                const existingAssignment = await locals.prisma.accountAssignment.findFirst({
                    where: {
                        parentAccountId,
                        childAccountId
                    }
                });

                if (existingAssignment) {
                    throw error(400, 'A relationship between these accounts already exists');
                }

                // Validate accounts exist
                const [parentAccount, childAccount] = await Promise.all([
                    locals.prisma.account.findUnique({ where: { id: parentAccountId } }),
                    locals.prisma.account.findUnique({ where: { id: childAccountId } })
                ]);

                if (!parentAccount || !childAccount) {
                    throw error(400, 'One or both accounts do not exist');
                }

                const assignment = await locals.prisma.accountAssignment.create({
                    data: {
                        parentAccountId,
                        childAccountId,
                        relationshipType,
                        status: 'ACTIVE',
                        validFrom: validFrom ? new Date(validFrom) : null,
                        validTo: validTo ? new Date(validTo) : null,
                        createdById: locals.auth.user.id
                    },
                    include: {
                        parentAccount: {
                            select: { id: true, name: true, slug: true }
                        },
                        childAccount: {
                            select: { id: true, name: true, slug: true }
                        }
                    }
                });

                // Log audit for assignment creation
                await logAudit({
                    actionType: AuditActionType.INSERT,
                    tableName: 'AccountAssignment',
                    recordId: assignment.id,
                    oldData: null,
                    newData: assignment,
                    userId: locals.auth.user.id,
                    ipAddress: (locals as any).ipAddress || 'unknown',
                    prisma: locals.prisma
                });

                logger.info(`Account assignment created: ${parentAccount.name} -> ${childAccount.name} (${relationshipType}) by user ${locals.auth.user.id}`);
                return { success: true, assignment };
            } catch (err) {
                logger.error(`Error creating assignment: ${err}`);
                if (err.status) throw err; // Re-throw known errors
                throw error(500, 'Failed to create assignment');
            }
        },
        [SystemRole.ADMIN]
    )
};
