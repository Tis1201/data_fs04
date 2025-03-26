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
        
        // Use the reusable fetchTableData function with our table options
        // Add userId filter to only show sessions for this user
        const customOptions = {
            ...table_options,
            additionalWhere: { userId }
        };
        
        const result = await fetchTableData(locals, url, customOptions);
        
        return {
            user,
            sessions: result.records,
            meta: result.meta
        };
    },
    ['ADMIN'] // Only allow admin role to access this route
) satisfies PageServerLoad;
