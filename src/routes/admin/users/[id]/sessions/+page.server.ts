import type { PageServerLoad } from './$types';
import type { Actions } from './$types';
import { error, fail } from '@sveltejs/kit';
import { restrict } from '$lib/server/security/guards';
import { fetchTableData } from '$lib/components/ui_components_sveltekit/table/utils/server';
import { logger } from '$lib/server/logger';
import { SystemRole } from '../../schema';

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
    async ({ params, url, locals }) => {
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
        async ({ request, params, locals }) => {
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
                return { success: true, message: 'Session revoked successfully' };
            } catch (error) {
                logger.error('Error revoking session:', error);
                return fail(500, { error: 'Failed to revoke session' });
            }
        },
        [SystemRole.ADMIN] // Only allow admin role to revoke sessions
    )
};

