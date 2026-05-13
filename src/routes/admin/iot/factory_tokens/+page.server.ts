import type { PageServerLoad } from './$types';
import { restrict } from '$lib/server/security/guards';
import { SystemRole } from '$lib/types/roles';
import { loadFactoryTokenList } from '$lib/server/factory-tokens/factoryTokenLoader';
import { createFactoryTokenActions } from '$lib/server/factory-tokens/factoryTokenActions';
import type { AuthenticatedLoadEvent } from '$lib/server/security/guards';

/*******************************************************************************************
 * 
 *  Load Block
 * 
 *******************************************************************************************/
export const load = restrict(
    async (event: AuthenticatedLoadEvent) => {
        return await loadFactoryTokenList(event);
    },
    [SystemRole.ADMIN] // Only allow admin role to access this route
) satisfies PageServerLoad;

/*******************************************************************************************
 * 
 *  Actions Block
 * 
 *******************************************************************************************/
export const actions = createFactoryTokenActions();
