
import type { PageServerLoad } from './$types';
import { logService } from '$lib/server/clickhouse/logService';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ url, locals, depends }) => {
    // Basic auth check assumed via hooks, but good to ensure session exists
    const session = await locals.auth.validate();
    if (!session) {
        throw error(401, 'Unauthorized');
    }

    depends('data:logs');

    const page = Number(url.searchParams.get('page')) || 1;
    const per_page = Number(url.searchParams.get('per_page')) || 50;
    const search = url.searchParams.get('search') || undefined;
    const level = url.searchParams.get('level') || undefined;
    const sortBy = url.searchParams.get('sort') || 'timestamp';
    const sortOrder = (url.searchParams.get('order') as 'asc' | 'desc') || 'desc';

    try {
        const { logs, total } = await logService.getLogs({
            page,
            limit: per_page,
            search,
            level,
            sortBy,
            sortOrder,
            // Scope to user's account if needed, using the current context account
            accountId: session.currentAccount?.accountId
        });

        return {
            props: {
                records: logs,
                pagination: {
                    page,
                    per_page,
                    total_records: total,
                    total_pages: Math.ceil(total / per_page)
                },
                sort: {
                    field: sortBy,
                    order: sortOrder
                },
                loading: false
            }
        };
    } catch (err) {
        console.error('Failed to load logs', err);
        return {
            props: {
                records: [],
                pagination: {
                    page,
                    per_page,
                    total_records: 0,
                    total_pages: 0
                },
                sort: {
                    field: sortBy,
                    order: sortOrder
                },
                loading: false,
                error: 'Failed to load logs'
            }
        };
    }
};
