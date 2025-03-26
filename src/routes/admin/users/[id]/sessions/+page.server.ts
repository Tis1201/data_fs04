import type { PageServerLoad } from './$types';
import { restrict } from '$lib/server/security/guards';
import { error } from '@sveltejs/kit';
import { fetchTableData } from '$lib/components/ui_components_sveltekit/table/utils/server';

// Define table options for Sessions
const table_options = {
    modelName: 'session',
    searchableFields: ['id', 'userAgent', 'ipAddress'],
    allowedFilters: [],
    defaultSortField: 'createdAt',
    defaultSortOrder: 'desc' as const,
    defaultPerPage: 10
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
        
        // Instead of using fetchTableData, we'll use a custom query to include user information
        // This allows us to get the sessions with user data in a single query
        
        // Get pagination parameters from URL
        const page = parseInt(url.searchParams.get('page') || '1');
        const per_page = parseInt(url.searchParams.get('per_page') || table_options.defaultPerPage.toString());
        const sortField = url.searchParams.get('sort') || table_options.defaultSortField;
        const sortOrder = (url.searchParams.get('order') || table_options.defaultSortOrder) as 'asc' | 'desc';
        
        // Calculate pagination
        const skip = (page - 1) * per_page;
        
        // Get total count for pagination
        const totalCount = await locals.prisma.session.count({
            where: { userId }
        });
        
        // Get sessions with user information
        const sessions = await locals.prisma.session.findMany({
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
            take: per_page
        });
        
        // Format result to match fetchTableData output
        const result = {
            records: sessions,
            meta: {
                pagination: {
                    page,
                    per_page,
                    total_records: totalCount,
                    total_pages: Math.ceil(totalCount / per_page)
                },
                sort: {
                    field: sortField,
                    order: sortOrder
                }
            }
        };
        
        return {
            user,
            sessions: result.records,
            meta: result.meta
        };
    },
    ['ADMIN'] // Only allow admin role to access this route
) satisfies PageServerLoad;

export const actions = {
    revokeSession: async ({ request, params, locals }) => {
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
            
            return { success: true, message: 'Session revoked successfully' };
        } catch (error) {
            console.error('Error revoking session:', error);
            return { success: false, error: 'Failed to revoke session' };
        }
    }
};

