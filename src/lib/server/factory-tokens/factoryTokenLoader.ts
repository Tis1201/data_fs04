/**
 * Factory token loader
 * Centralized data loading logic for factory token routes
 */

import type { AuthenticatedLoadEvent } from '$lib/server/security/guards';
import { fetchTableData } from '$lib/components/ui_components_sveltekit/table/utils/server';
import { createFactoryTokenTableOptions } from './factoryTokenTableOptions';

/**
 * Load factory token list data
 * Factory tokens are admin-only, so no ownership filtering needed
 */
export async function loadFactoryTokenList(
    event: AuthenticatedLoadEvent
): Promise<{
    factoryTokens: any[];
    meta: any;
}> {
    const { url, locals, depends } = event;
    
    // Add a dependency key for invalidation
    depends('app:factoryTokens');
    
    // Use the reusable fetchTableData function with our table options
    const tableOptions = createFactoryTokenTableOptions();
    const result = await fetchTableData(locals, url, tableOptions);
    
    return {
        factoryTokens: result.records,
        meta: result.meta
    };
}

