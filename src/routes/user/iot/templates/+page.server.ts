import type { PageServerLoad, Actions } from './$types';
import { restrict, type AuthenticatedLoadEvent, type AuthenticatedEvent } from '$lib/server/security/guards';
import { SystemRole } from '$lib/types/roles';

/**
 * Template row shape for list (name, type, assigned count, updated, isDefault).
 * API placeholder until templates API exists.
 */
export interface TemplateRow {
    id: string;
    name: string;
    type: 'Alert' | 'Configuration';
    assignedSensors: number;
    lastUpdatedOn: string;
    isDefault?: boolean;
}

export const load = restrict(
    async ({ url, locals, depends }: AuthenticatedLoadEvent) => {
        depends('app:userTemplates');

        const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
        const perPage = Math.min(100, Math.max(10, parseInt(url.searchParams.get('per_page') || '10', 10)));
        const search = (url.searchParams.get('search') || '').trim();
        const sortField = url.searchParams.get('sort') || 'lastUpdatedOn';
        const sortOrder = (url.searchParams.get('order') || 'desc') as 'asc' | 'desc';

        // Placeholder: no templates API yet – return empty list and meta
        const totalRecords = 0;
        const totalPages = Math.max(1, Math.ceil(totalRecords / perPage));
        const templates: TemplateRow[] = [];

        return {
            templates,
            meta: {
                pagination: { page, per_page: perPage, total_records: totalRecords, total_pages: totalPages },
                sort: { field: sortField, order: sortOrder },
                filters: { search }
            }
        };
    },
    [SystemRole.USER]
) satisfies PageServerLoad;

export const actions: Actions = {
    delete: restrict(
        async ({ request }: AuthenticatedEvent) => {
            const form = await request.formData();
            const id = form.get('id') as string | null;
            if (!id) return { success: false, error: 'Missing template id' };
            // TODO: call templates API when available
            return { success: true };
        },
        [SystemRole.USER]
    ),
    duplicate: restrict(
        async ({ request }: AuthenticatedEvent) => {
            const form = await request.formData();
            const id = form.get('id') as string | null;
            if (!id) return { success: false, error: 'Missing template id' };
            // TODO: call templates API when available
            return { success: true };
        },
        [SystemRole.USER]
    ),
    setDefault: restrict(
        async ({ request }: AuthenticatedEvent) => {
            const form = await request.formData();
            const id = form.get('id') as string | null;
            if (!id) return { success: false, error: 'Missing template id' };
            // TODO: call templates API when available
            return { success: true };
        },
        [SystemRole.USER]
    )
};
