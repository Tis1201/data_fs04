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
      // Admin routes get all advanced features enabled
      return await loadBundleDetail(locals, id, {
        includeAccount: true,           // Fetch account info and accounts list
        checkDeviceOnline: true,        // Real-time device online status
        enableAutoStartWaves: true,     // Auto-start next wave when previous completes
        enableTimeoutChecking: true     // Check for device timeouts
      });
    } catch (err) {
      logger.error(`Error loading bundle details: ${err instanceof Error ? err.message : String(err)}`);
      throw error(500, 'Failed to load bundle details');
    }
  },
  [SystemRole.ADMIN] // Only allow admin role to access this route
) satisfies PageServerLoad;

/*******************************************************************************************
 * 
 *  Actions Block
 * 
 *******************************************************************************************/
// Create actions with admin privileges (advanced features enabled)
const bundleActions = createBundleActions({
  checkOwnership: false,          // Admin can update any bundle
  enableAdvancedFeatures: true    // Enable stopAllWaves action
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
    [SystemRole.ADMIN] // Only allow admin role to access this action
  ),

  /**
   * Stop all waves action (Admin only)
   */
  stopAllWaves: restrict(
    async ({ params, request, locals }: AuthenticatedEvent) => {
      const { id } = params;
      if (!id) {
        throw error(400, 'Bundle ID is required');
      }
      if (!bundleActions.stopAllWaves) {
        throw error(403, 'Stop all waves action not available');
      }
      return await bundleActions.stopAllWaves({
        params: { id },
        request,
        locals
      });
    },
    [SystemRole.ADMIN] // Only allow admin role to access this action
  )
};
