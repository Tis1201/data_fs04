import { error } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { restrict } from '$lib/server/security/guards';
import type { AuthenticatedEvent, AuthenticatedLoadEvent } from '$lib/server/security/guards';
import { logger } from '$lib/server/logger';
import { SystemRole } from '$lib/types/roles';
import { loadPreclaimList } from '$lib/server/preclaims/preclaimLoader';
import { createPreclaimActions } from '$lib/server/preclaims/preclaimActions';

/*******************************************************************************************
 * 
 *  Load Block
 * 
 *******************************************************************************************/
export const load = restrict(
    async ({ url, locals, depends }: AuthenticatedLoadEvent) => {
        depends('app:userPreclaimSets');
        
        try {
            // User routes need ownership checking - only show preclaims from their accounts
            // Note: locals.prisma is already enhanced by middleware for user routes
            const auth = await locals.auth.validate();
            const userId = auth?.user?.id;
            const accountId = (locals as any).currentAccount?.account?.id;
            
            return await loadPreclaimList(locals, url, {
                checkOwnership: true, // User can only see preclaims from their accounts
                userId,
                accountId,
                useEnhancedPrisma: true // Use enhanced Prisma (already set in locals.prisma by middleware)
            });
        } catch (e) {
            logger.error(`Error loading preclaims: ${JSON.stringify(e)}`);
            throw error(500, 'Failed to load preclaims');
        }
    },
    [SystemRole.USER] // Only allow user role to access this route
) satisfies PageServerLoad;

/*******************************************************************************************
 * 
 *  Actions Block
 * 
 *******************************************************************************************/
// Create actions with user privileges (ownership check via enhanced Prisma)
const preclaimActions = createPreclaimActions({
    checkOwnership: true, // Users can only toggle status of preclaims they have access to
    useEnhancedPrisma: true // Use enhanced Prisma (already set in locals.prisma by middleware)
});

export const actions: Actions = {
    /**
     * Toggle preclaim set status action
     */
    toggleStatus: restrict(
        async ({ request, locals }: AuthenticatedEvent) => {
            return await preclaimActions.toggleStatus({
                request,
                locals
            });
        },
        [SystemRole.USER] // Only allow user role to access this action
    )
};
