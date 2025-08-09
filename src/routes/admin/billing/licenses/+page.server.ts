import type { PageServerLoad } from './$types';
import { restrict } from '$lib/server/security/guards';
import { fetchTableData } from '$lib/components/ui_components_sveltekit/table/utils/server';
import { SystemRole } from '$lib/types/roles';

// Table options for Licenses
const table_options = {
    modelName: 'license',
    searchableFields: ['accountId', 'deviceId', 'keyId', 'algorithm', 'status'],
    allowedFilters: ['status', 'accountId'],
    defaultSortField: 'issuedAt',
    defaultSortOrder: 'desc' as const,
    defaultPerPage: 10
};

export const load = restrict(
    async ({ url, locals, depends }: any) => {
        depends('app:licenses');
        const result = await fetchTableData(locals, url, table_options);
        return {
            licenses: result.records,
            meta: result.meta
        };
    },
    [SystemRole.ADMIN]
) satisfies PageServerLoad;
