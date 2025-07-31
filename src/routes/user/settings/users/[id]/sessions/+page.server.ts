import type { PageServerLoad } from './$types';
import type { Actions } from './$types';
import { error, fail } from '@sveltejs/kit';
import { restrict } from '$lib/server/security/guards';
import { logger } from '$lib/server/logger';
import { SystemRole } from '$lib/types/roles';
import prisma from '$lib/server/prisma'; // Raw Prisma client
import { logAudit } from '$lib/server/audit-logger';
import { AuditActionType } from '$lib/constants/system';

export const load: PageServerLoad = restrict(
    async ({ params, url, locals, cookies }) => {
        const userId = params.id;
        
        // Get current account ID from cookie
        const currentAccountId = cookies.get('current_account_id');
        if (!currentAccountId) {
            throw error(400, 'No account selected');
        }

        // Get current user's auth info
        const auth = await locals.auth.validate();
        if (!auth?.user) {
            throw error(401, 'Unauthorized');
        }

        // First verify the target user exists and is in the current account using RAW Prisma
        const targetUserMembership = await prisma.accountMembership.findFirst({
            where: {
                accountId: currentAccountId,
                userId: userId
            },
            include: {
                user: {
                    select: {
                        id: true,
                        email: true,
                        name: true,
                        systemRole: true,
                        status: true
                    }
                }
            }
        });

        if (!targetUserMembership) {
            throw error(404, 'User not found in current account');
        }

        // Check if current user has permission to view sessions using RAW Prisma
        const currentUserMembership = await prisma.accountMembership.findFirst({
            where: {
                accountId: currentAccountId,
                userId: auth.user.id
            }
        });

        if (!currentUserMembership || !['ADMIN', 'OWNER'].includes(currentUserMembership.role)) {
            throw error(403, 'Insufficient permissions to view user sessions');
        }

        // Parse pagination and sorting from URL
        const searchParams = new URL(url).searchParams;
        const page = parseInt(searchParams.get('page') || '1');
        const perPage = parseInt(searchParams.get('per_page') || '10');
        const sortField = searchParams.get('sort_field') || 'createdAt';
        const sortOrder = (searchParams.get('sort_order') || 'desc') as 'asc' | 'desc';
        const skip = (page - 1) * perPage;

        // Fetch sessions using RAW Prisma client to bypass access policies
        const [sessions, totalSessions] = await Promise.all([
            prisma.session.findMany({
                where: { userId },
                include: {
                    user: {
                        select: {
                            id: true,
                            email: true,
                            name: true,
                            status: true,
                            systemRole: true
                        }
                    }
                },
                orderBy: { [sortField]: sortOrder },
                skip,
                take: perPage
            }),
            prisma.session.count({
                where: { userId }
            })
        ]);

        const totalPages = Math.ceil(totalSessions / perPage);

        // Create meta object for pagination
        const meta = {
            page,
            per_page: perPage,
            total_records: totalSessions,
            total_pages: totalPages,
            sort_field: sortField,
            sort_order: sortOrder
        };
        
        return {
            user: targetUserMembership.user,
            sessions,
            meta,
            currentAccount: {
                id: currentAccountId,
                userRole: currentUserMembership.role
            }
        };
    },
    [SystemRole.USER] // Allow authenticated users (permissions checked inside)
);

export const actions: Actions = {
    revokeSession: restrict(
        async ({ request, params, locals, cookies }) => {
            const userId = params.id;
            const formData = await request.formData();
            const sessionId = formData.get('id')?.toString();
            
            if (!sessionId) {
                return { success: false, error: 'Session ID is required' };
            }

            // Get current account ID from cookie
            const currentAccountId = cookies.get('current_account_id');
            if (!currentAccountId) {
                return fail(400, { message: 'No account selected' });
            }

            // Get current user's auth info
            const auth = await locals.auth.validate();
            if (!auth?.user) {
                return fail(401, { message: 'Unauthorized' });
            }

            // Check if current user has admin permissions in this account using RAW Prisma
            const currentUserMembership = await prisma.accountMembership.findFirst({
                where: {
                    accountId: currentAccountId,
                    userId: auth.user.id
                }
            });

            if (!currentUserMembership || !['ADMIN', 'OWNER'].includes(currentUserMembership.role)) {
                return fail(403, { message: 'Insufficient permissions' });
            }
            
            try {
                // Verify the session belongs to the user using RAW Prisma
                const session = await prisma.session.findUnique({
                    where: { id: sessionId }
                });
                
                if (!session) {
                    return { success: false, error: 'Session not found' };
                }
                
                if (session.userId !== userId) {
                    return { success: false, error: 'Session does not belong to this user' };
                }
                
                // Delete the session using RAW Prisma
                await prisma.session.delete({
                    where: { id: sessionId }
                });
                
                logger.info('Session revoked successfully', { sessionId, revokedBy: auth.user.id });

                await logAudit({
                    actionType: AuditActionType.DELETE,
                    tableName: 'Session',
                    recordId: sessionId,
                    oldData: session,
                    newData: null,
                    userId: auth.user.id,
                    ipAddress: locals.ipAddress,
                    prisma: prisma
                })

                return { success: true, message: 'Session revoked successfully' };
            } catch (err) {
                logger.error('Error revoking session:', err as any);
                return fail(500, { error: 'Failed to revoke session' });
            }
        },
        [SystemRole.USER] // Allow authenticated users (permissions checked inside)
    ),

    // Add delete action that RecordDeleteDialog expects
    delete: restrict(
        async ({ request, params, locals, cookies }) => {
            // Just call the same logic as revokeSession
            const userId = params.id;
            const formData = await request.formData();
            const sessionId = formData.get('id')?.toString();
            
            if (!sessionId) {
                return fail(400, { message: 'Session ID is required' });
            }

            // Get current account ID from cookie
            const currentAccountId = cookies.get('current_account_id');
            if (!currentAccountId) {
                return fail(400, { message: 'No account selected' });
            }

            // Get current user's auth info
            const auth = await locals.auth.validate();
            if (!auth?.user) {
                return fail(401, { message: 'Unauthorized' });
            }

            // Check if current user has admin permissions in this account using RAW Prisma
            const currentUserMembership = await prisma.accountMembership.findFirst({
                where: {
                    accountId: currentAccountId,
                    userId: auth.user.id
                }
            });

            if (!currentUserMembership || !['ADMIN', 'OWNER'].includes(currentUserMembership.role)) {
                return fail(403, { message: 'Insufficient permissions' });
            }
            
            try {
                // Verify the session belongs to the user using RAW Prisma
                const session = await prisma.session.findUnique({
                    where: { id: sessionId }
                });
                
                if (!session) {
                    return fail(404, { message: 'Session not found' });
                }
                
                if (session.userId !== userId) {
                    return fail(400, { message: 'Session does not belong to this user' });
                }
                
                // Delete the session using RAW Prisma
                await prisma.session.delete({
                    where: { id: sessionId }
                });
                
                logger.info('Session revoked successfully', { sessionId, revokedBy: auth.user.id });

                await logAudit({
                    actionType: AuditActionType.DELETE,
                    tableName: 'Session',
                    recordId: sessionId,
                    oldData: session,
                    newData: null,
                    userId: auth.user.id,
                    ipAddress: locals.ipAddress,
                    prisma: prisma
                })

                return {
                    type: 'success',
                    message: 'Session revoked successfully'
                };
            } catch (err) {
                logger.error('Error revoking session:', err as any);
                return fail(500, { message: 'Failed to revoke session' });
            }
        },
        [SystemRole.USER] // Allow authenticated users (permissions checked inside)
    )
}; 
