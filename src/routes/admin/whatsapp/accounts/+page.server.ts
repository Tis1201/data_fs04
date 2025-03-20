import type { PageServerLoad } from './$types';
import {getEnhancedPrisma} from '$lib/server/prisma';

function parseQueryParams(url: URL, allowedFilters: string[] = []) {
    const queryParams: Record<string, any> = {
        page: Number(url.searchParams.get('page')) || 1,
        per_page: Number(url.searchParams.get('per_page')) || 10,
        search: url.searchParams.get('search') || '',
        sortField: (url.searchParams.get('sort') as 'email' | 'rolesString' | 'createdAt' | 'systemRole') || 'email',
        sortOrder: (url.searchParams.get('order') as 'asc' | 'desc') || 'asc'
    };

    // Dynamically extract allowed filters
    allowedFilters.forEach((filter) => {
        const value = url.searchParams.get(filter);
        if (value) {
            queryParams[filter] = value.includes(',') ? value.split(',').filter(Boolean) : value;
        }
    });

    return queryParams;
}



export const load: PageServerLoad = async ({parent, locals, url }) => {
    const { user } = await parent();

    console.log('Auth context:', { id: user.id, rolesString: user.rolesString });

    const prisma = getEnhancedPrisma({
        id: user.id,
        rolesString: user.rolesString
    });

    const params = parseQueryParams(url, ['roles', 'statuses']);

    console.log(params)


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
        // meta: {
        //     pagination: {
        //         page,
        //         per_page,
        //         total_records: totalRecords,
        //         total_pages: Math.ceil(totalRecords / per_page)
        //     },
        //     sort: {
        //         field: sortField,
        //         order: sortOrder
        //     },
        //     filters: {
        //         search,
        //         roles,
        //         statuses
        //     }
        // }
    };

};