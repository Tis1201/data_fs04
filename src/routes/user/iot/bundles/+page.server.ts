import { error } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { restrict } from '$lib/server/security/guards';
import { logger } from '$lib/server/logger';
import { SystemRole } from '$lib/types/roles';
import { loadBundleList } from '$lib/server/bundles/bundleLoader';
import { createBundleActions } from '$lib/server/bundles/bundleActions';
import type { AuthenticatedEvent } from '$lib/server/security/guards';

/*******************************************************************************************
 * 
 *  Load Block
 * 
 *******************************************************************************************/
export const load = restrict(
    async ({ url, locals, cookies }: AuthenticatedEvent) => {
        try {
            // User routes: scope to current account only (switch-account aware)
            const userId = (locals as any).user?.id;
            const accountId =
                (locals as any).currentAccount?.account?.id ??
                cookies.get('current_account_id');
            
            return await loadBundleList(locals, url, {
                checkOwnership: true,
                userId,
                accountId
            });
        } catch (e) {
            logger.error(`Error loading bundles: ${JSON.stringify(e)}`);
            throw error(500, 'Failed to load bundles');
        }
    },
    [SystemRole.USER] // Only allow user role to access this route
) satisfies PageServerLoad;

/*******************************************************************************************
 * 
 *  Actions Block
 * 
 *******************************************************************************************/
// Create actions with user privileges (ownership check enabled)
const bundleActions = createBundleActions({
    checkOwnership: true, // Users can only delete bundles they own
    enableAdvancedFeatures: false // List page doesn't need advanced features
});

export const actions: Actions = {
    /**
     * Delete bundle action
     */
    delete: restrict(
        async ({ request, locals, cookies }: AuthenticatedEvent) => {
            // Get current account ID
            const currentAccountId =
                (locals as any).currentAccount?.account?.id ?? cookies.get('current_account_id');
            
            if (!currentAccountId) {
                return { success: false, error: 'No account selected' };
            }

            // Get bundle ID from form data
            const formData = await request.formData();
            const bundleId = formData.get('id')?.toString();

            if (!bundleId) {
                return { success: false, error: 'Bundle ID is required' };
            }

            // Verify bundle belongs to current account before delete
            const bundle = await locals.prisma.bundle.findFirst({
                where: { id: bundleId, accountId: currentAccountId },
                select: { id: true }
            });

            if (!bundle) {
                return { success: false, error: 'Bundle not found' };
            }

            // Create a new request with the form data for bundleActions.delete
            const newFormData = new FormData();
            newFormData.append('id', bundleId);
            const newRequest = new Request(request.url, {
                method: 'POST',
                body: newFormData
            });

            return await bundleActions.delete({
                request: newRequest,
                locals
            });
        },
        [SystemRole.USER] // Only allow user role to access this action
    )
};
