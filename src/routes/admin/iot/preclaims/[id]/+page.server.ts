import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { restrict } from '$lib/server/security/guards';
import type { AuthenticatedLoadEvent } from '$lib/server/security/guards';
import { SystemRole } from '$lib/types/roles';
import { logger } from '$lib/server/logger';
import { loadPreclaimDetail } from '$lib/server/preclaims/preclaimLoader';

/*******************************************************************************************
 * 
 *  Load Block
 * 
 *******************************************************************************************/
export const load = restrict(
    async ({ params, locals, depends }: AuthenticatedLoadEvent) => {
        depends('app:preclaim');
        
        const { id } = params;
        if (!id) {
            throw error(400, 'Preclaim set ID is required');
        }

        try {
            // Admin routes don't need ownership checking - can see all preclaims
            return await loadPreclaimDetail(
                locals,
                id,
                {
                    checkOwnership: false // Admin doesn't need ownership check
                }
            );
        } catch (err) {
            logger.error(`Error loading preclaim set ${id}: ${err instanceof Error ? err.message : String(err)}`);
            if (err && typeof err === 'object' && 'status' in err) {
                throw err; // Re-throw SvelteKit errors
            }
            throw error(500, 'Failed to load pre-claim set details');
        }
    },
    [SystemRole.ADMIN] // Only allow admin role to access this route
) satisfies PageServerLoad;
