import type { PageServerLoad } from './$types';
import {getEnhancedPrisma} from '$lib/server/prisma';

/*******************************************************************************************
 * 
 *  Parse Query Params including pagination, sorting, and filters
 * 
 *******************************************************************************************/
function parseQueryParams(url: URL, allowedFilters: string[] = []) {
    const queryParams: Record<string, any> = {
        page: Number(url.searchParams.get('page')) || 1,
        per_page: Number(url.searchParams.get('per_page')) || 10,
        search: url.searchParams.get('search') || '',
        sortField: (url.searchParams.get('sort') as 'phoneNumber' | 'description' | 'createdAt') || 'phoneNumber',
        sortOrder: (url.searchParams.get('order') as 'asc' | 'desc') || 'asc'
    };

    allowedFilters.forEach((filter) => {
        const value = url.searchParams.get(filter);
        if (value) {
            queryParams[filter] = value.includes(',') ? value.split(',').filter(Boolean) : value;
        }
    });

    return queryParams;
}

/*******************************************************************************************
 * 
 *  Gatekeeper function to check user access based on roles
 * 
 *******************************************************************************************/
async function gatekeeper(context: any, allowed_roles: string[] = ["admin"]){
    // Handle both parent function and locals object
    let user;
    if (typeof context === 'function') {
        // For load function (parent)
        const result = await context();
        user = result.user;
    } else {
        // For actions (locals)
        user = context.user;
    }
    
    if (!user || !allowed_roles.includes(user.rolesString)) {
        throw new Error("Access Denied")
    }
    console.log('Auth context:', { id: user.id, rolesString: user.rolesString });
} 

/*******************************************************************************************
 * 
 *  Database access function to get the enhanced Prisma client
 * 
 *******************************************************************************************/
async function db(context: any){
    // Handle both parent function and locals object
    let user;
    if (typeof context === 'function') {
        // For load function (parent)
        const result = await context();
        user = result.user;
    } else {
        // For actions (locals)
        user = context.user;
    }
    
    const prisma = getEnhancedPrisma({
        id: user.id,
        rolesString: user.rolesString,
        systemRole: user.systemRole
    });
    return prisma;
}

/*******************************************************************************************
 * 
 *  Function to format pagination data for response metadata
 * 
 *******************************************************************************************/
function formatPagination(page: number, per_page: number, totalRecords: number) {
    return {
        page,
        per_page,
        total_records: totalRecords,
        total_pages: Math.ceil(totalRecords / per_page)
    };
}

/*******************************************************************************************
 * 
 *  Function to format sorting data for response metadata
 * 
 *******************************************************************************************/
function formatSorting(sortField: string, sortOrder: string) {
    return { field: sortField, order: sortOrder };
}

/*******************************************************************************************
 * 
 *  Function to format filters for response metadata
 * 
 *******************************************************************************************/
function formatFilters(filters: Record<string, any>) {
    return filters;
}

/*******************************************************************************************
 * 
 *  Main Logic Block
 * 
 *******************************************************************************************/
export const actions = {
    deleteAccount: async ({ request, locals }) => {

        console.log(locals.auth)
        // await gatekeeper(locals.auth);
        const prisma = locals.prisma
        
        const data = await request.formData();
        const id = data.get('id')?.toString();
        
        if (!id) {
            return { success: false, error: 'Account ID is required' };
        }
        
        try {
            await prisma.whatsAppAccount.delete({
                where: { id }
            });
            
            return { success: true };
        } catch (error) {
            console.error('Error deleting WhatsApp account:', error);
            return { success: false, error: 'Failed to delete account' };
        }
    }
};

export const load: PageServerLoad = async ({parent, url, locals }) => {
    
    // await gatekeeper(parent);

    const prisma = locals.prisma
    
    const filters = parseQueryParams(url, ['roles', 'statuses']);

    console.log(filters)

    // Build where conditions dynamically
    const whereConditions = [];
    
    // Define searchable fields
    const searchableFields = ['phoneNumber', 'description'];
    
    if (filters.search) {
        const searchConditions = searchableFields.map(field => ({
            [field]: { contains: filters.search, mode: 'insensitive' }
        }));
        
        whereConditions.push({
            OR: searchConditions
        });
    }
    
    const where = whereConditions.length > 0 ? { AND: whereConditions } : {};
    
    // Get records with pagination and sorting
    const records = await prisma.WhatsAppAccount.findMany({
        where,
        skip: (filters.page - 1) * filters.per_page,
        take: filters.per_page,
        orderBy: {
            [filters.sortField]: filters.sortOrder
        }
    });
     
    // Get total count for pagination
    const totalRecords = await prisma.WhatsAppAccount.count({ where });

    return {
        accounts: records,
        meta: {
            pagination: formatPagination(filters.page, filters.per_page, totalRecords),
            sort: formatSorting(filters.sortField, filters.sortOrder),
            filters: formatFilters(filters)
        }
    };

};