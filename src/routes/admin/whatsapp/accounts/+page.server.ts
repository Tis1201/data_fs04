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
        sortField: (url.searchParams.get('sort') as 'email' | 'rolesString' | 'createdAt' | 'systemRole') || 'email',
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
async function gatekeeper(parent: () => PromiseLike<{ user: any; }> | { user: any; }, allowed_roles: string[] = ["admin"]){
    const { user } = await parent();
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
async function db(parent: () => PromiseLike<{ user: any; }> | { user: any; }){
    const { user } = await parent();
    const prisma = getEnhancedPrisma({
        id: user.id,
        rolesString: user.rolesString
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
export const load: PageServerLoad = async ({parent, url }) => {
    
    await gatekeeper(parent);

    const prisma = await db(parent);
    
    const filters = parseQueryParams(url, ['roles', 'statuses']);

    console.log(filters)

    const page = Number(url.searchParams.get('page')) || 1;
    const per_page = Number(url.searchParams.get('per_page')) || 10;
    const search = url.searchParams.get('search') || ''; // Optional search filter
    const role = url.searchParams.get('role') || ''; // Optional role filter

    const records = await prisma.WhatsAppAccount.findMany({
        where: {
            description: {
                contains: search,
                mode: 'insensitive',
            },
            // Add role filtering if applicable
        },
        skip: (page - 1) * per_page,
        take: per_page,
    });

    console.log({page, per_page, search, role})
     
    return {
        data: records,
        meta: {
            data: records,
            meta: {
                pagination: formatPagination(filters.page, filters.per_page, 5),
                sort: formatSorting(filters.sortField, filters.sortOrder),
                filters: formatFilters(filters)
            }
        }
    };

};