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
            // User routes need ownership checking - only show preclaims from their accounts
            // Note: locals.prisma is already enhanced by middleware for user routes
            const auth = await locals.auth.validate();
            const userId = auth?.user?.id;
            const accountId = (locals as any).currentAccount?.account?.id;
            
            return await loadPreclaimDetail(
                locals,
                id,
                {
                    checkOwnership: true, // User can only see preclaims from their accounts
                    userId,
                    accountId,
                    useEnhancedPrisma: true // Use enhanced Prisma (already set in locals.prisma by middleware)
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
    [SystemRole.USER] // Only allow user role to access this route
) satisfies PageServerLoad;
