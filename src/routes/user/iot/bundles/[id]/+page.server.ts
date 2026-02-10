import { error } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { restrict } from '$lib/server/security/guards';
import type { AuthenticatedEvent, AuthenticatedLoadEvent } from '$lib/server/security/guards';
import { logger } from '$lib/server/logger';
import { SystemRole } from '$lib/types/roles';
import { loadBundleDetail } from '$lib/server/bundles/bundleLoader';
import { createBundleActions } from '$lib/server/bundles/bundleActions';

/*******************************************************************************************
 * 
 *  Load Block
 * 
 *******************************************************************************************/
export const load = restrict(
  async ({ params, locals, depends }: AuthenticatedLoadEvent) => {
    // Mark this load for client-side invalidation when bundles are updated
    depends('app:bundle');
    const { id } = params;
    if (!id) {
      throw error(400, 'Bundle ID is required');
    }

    try {
      // User routes: use real-time device status (Redis) so bundle device list matches devices list
      return await loadBundleDetail(locals, id, {
        includeAccount: false,          // Users don't need account management
        checkDeviceOnline: true,       // Use Redis real-time status (same as devices list)
        enableAutoStartWaves: false,    // Users don't auto-start waves
        enableTimeoutChecking: false    // Users don't check timeouts
      });
    } catch (err) {
      logger.error(`Error loading bundle details: ${err instanceof Error ? err.message : String(err)}`);
      throw error(500, 'Failed to load bundle details');
    }
  },
  [SystemRole.USER] // Only allow user role to access this route
) satisfies PageServerLoad;

/*******************************************************************************************
 * 
 *  Actions Block
 * 
 *******************************************************************************************/
// Create actions with user privileges (no advanced features)
const bundleActions = createBundleActions({
  checkOwnership: true,            // Users can only update bundles they own
  enableAdvancedFeatures: false    // Disable stopAllWaves action
});

export const actions: Actions = {
  /**
   * Update bundle action
   */
  updateBundle: restrict(
    async ({ params, request, locals }: AuthenticatedEvent) => {
      const { id } = params;
      if (!id) {
        throw error(400, 'Bundle ID is required');
      }
      return await bundleActions.update({
        params: { id },
        request,
        locals
      });
    },
    [SystemRole.USER] // Only allow user role to access this action
  )
  // Note: stopAllWaves is NOT available for user routes (enableAdvancedFeatures: false)
};
