import type { PageServerLoad } from './$types';
import type { Actions } from './$types';
import { error, fail } from '@sveltejs/kit';
import { restrict, type AuthenticatedLoadEvent, type AuthenticatedEvent } from '$lib/server/security/guards';
import { fetchTableData } from '$lib/components/ui_components_sveltekit/table/utils/server';
import { logger } from '$lib/server/logger';
import { SystemRole } from '$lib/types/roles';
import { logAudit } from '$lib/server/audit-logger';
import { AuditActionType } from '$lib/constants/system';

// Define table options for Sessions
const table_options = {
    modelName: 'session',
    searchableFields: ['id', 'userAgent', 'ipAddress'],
    allowedFilters: [],
    defaultSortField: 'createdAt',
    defaultSortOrder: 'desc' as const,
    defaultPerPage: 10,
    baseWhere: { userId: '' } // Will be updated with actual userId in load function
};

/*******************************************************************************************
 * 
 *  Load Block
 * 
 *******************************************************************************************/
export const load = restrict(
    async ({ params, url, locals }: AuthenticatedLoadEvent) => {
        const userId = params.id;
        
        // Get user data
        const user = await locals.prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                email: true,
                systemRole: true
            }
        });

        if (!user) {
            throw error(404, 'User not found');
        }
        
        // Create table options with the current user ID
        const sessionTableOptions = {
            ...table_options,
            baseWhere: { userId }
        };

        // Use fetchTableData with the user-specific table options and include user data
        const result = await fetchTableData(locals, url, {
            modelName: 'session',
            searchableFields: ['id', 'userAgent', 'ipAddress'],
            allowedFilters: [],
            defaultSortField: 'createdAt',
            defaultSortOrder: 'desc' as const,
            defaultPerPage: 10,
            baseWhere: { userId }, // This will be properly merged with other where conditions
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
            }
        });

        // Debug log to verify the session data
        console.log('Sessions found:', result.records.length, 'for user:', userId);
        
        return {
            user,
            sessions: result.records,
            meta: result.meta
        };
    },
    [SystemRole.ADMIN] // Only allow admin role to access this route
) satisfies PageServerLoad;

export const actions: Actions = {
    revokeSession: restrict(
        async ({ request, params, locals, auth, getClientAddress }: AuthenticatedEvent) => {
            const userId = params.id;
            const formData = await request.formData();
            const sessionId = formData.get('id')?.toString();
            
            if (!sessionId) {
                return { success: false, error: 'Session ID is required' };
            }
            
            try {
                // Verify the session belongs to the user
                const session = await locals.prisma.session.findUnique({
                    where: { id: sessionId },
                    select: { userId: true }
                });
                
                if (!session) {
                    return { success: false, error: 'Session not found' };
                }
                
                if (session.userId !== userId) {
                    return { success: false, error: 'Session does not belong to this user' };
                }
                
                // Delete the session
                await locals.prisma.session.delete({
                    where: { id: sessionId }
                });
                
                logger.info('Session revoked successfully', { sessionId });

                const actorUserId = auth?.user?.id;
                if (!actorUserId) {
                    throw error(401, 'Unauthorized');
                }

                const ipAddress = locals.requestContext?.ip ?? getClientAddress();

                await logAudit({
                    actionType: AuditActionType.DELETE,
                    tableName: 'Session',
                    recordId: sessionId,
                    oldData: session,
                    newData: null,
                    userId: actorUserId,
                    ipAddress,
                    prisma: locals.prisma
                });

                return { success: true, message: 'Session revoked successfully' };
            } catch (err) {
                logger.error('Error revoking session:', { err });
                return fail(500, { error: 'Failed to revoke session' });
            }
        },
        [SystemRole.ADMIN] // Only allow admin role to revoke sessions
    ),

    // Add delete action that RecordDeleteDialog expects (same as revokeSession)
    delete: restrict(
        async ({ request, params, locals, auth, getClientAddress }: AuthenticatedEvent) => {
            const userId = params.id;
            const formData = await request.formData();
            const sessionId = formData.get('id')?.toString();
            
            if (!sessionId) {
                return fail(400, { error: 'Session ID is required' });
            }
            
            try {
                // Verify the session belongs to the user
                const session = await locals.prisma.session.findUnique({
                    where: { id: sessionId },
                    select: { userId: true }
                });
                
                if (!session) {
                    return fail(404, { error: 'Session not found' });
                }
                
                if (session.userId !== userId) {
                    return fail(403, { error: 'Session does not belong to this user' });
                }
                
                // Delete the session
                await locals.prisma.session.delete({
                    where: { id: sessionId }
                });
                
                logger.info('Session deleted successfully', { sessionId });

                const actorUserId = auth?.user?.id;
                if (!actorUserId) {
                    throw error(401, 'Unauthorized');
                }

                const ipAddress = locals.requestContext?.ip ?? getClientAddress();

                await logAudit({
                    actionType: AuditActionType.DELETE,
                    tableName: 'Session',
                    recordId: sessionId,
                    oldData: session,
                    newData: null,
                    userId: actorUserId,
                    ipAddress,
                    prisma: locals.prisma
                });

                return { success: true, message: 'Session deleted successfully' };
            } catch (err) {
                logger.error('Error deleting session:', { err });
                return fail(500, { error: 'Failed to delete session' });
            }
        },
        [SystemRole.ADMIN] // Only allow admin role to delete sessions
    )
};

