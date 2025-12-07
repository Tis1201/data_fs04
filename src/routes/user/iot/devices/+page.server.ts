import { error } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { restrict } from '$lib/server/security/guards';
import type { AuthenticatedEvent, AuthenticatedLoadEvent } from '$lib/server/security/guards';
import { logger } from '$lib/server/logger';
import { SystemRole } from '$lib/types/roles';
import { loadDeviceList } from '$lib/server/devices/deviceLoader';
import { createDeviceActions } from '$lib/server/devices/deviceActions';

/*******************************************************************************************
 * 
 *  Load Block
 * 
 *******************************************************************************************/
export const load = restrict(
    async ({ url, locals, depends }: AuthenticatedLoadEvent) => {
        // Mark for client-side invalidation
        depends('app:userDevices');
        
        try {
            // User routes need ownership checking - only show devices they own or have access to
            const userId = (locals as any).user?.id || (locals as any).auth?.user?.id;
            const accountId = (locals as any).currentAccount?.account?.id;
            
            return await loadDeviceList(locals, url, {
                checkOwnership: true,
                userId,
                accountId,
                includeStats: true,        // Users also get device statistics for their devices
                includeRealTimeStatus: true // Users get real-time status
            });
        } catch (e) {
            logger.error(`Error loading devices: ${JSON.stringify(e)}`);
            throw error(500, 'Failed to load devices');
        }
    },
    [SystemRole.USER] // Only allow user role to access this route
) satisfies PageServerLoad;

/*******************************************************************************************
 * 
 *  Actions Block
 * 
 *******************************************************************************************/
// Create actions with user privileges (no create, ownership check enabled)
const deviceActions = createDeviceActions({
    checkOwnership: true,  // Users can only delete/toggle devices they own
    enableCreate: false   // Users cannot create devices
});

export const actions: Actions = {
    /**
     * Toggle device status action
     */
    toggleStatus: restrict(
        async ({ request, locals }: AuthenticatedEvent) => {
            return await deviceActions.toggleStatus({
                request,
                locals
            });
        },
        [SystemRole.USER] // Only allow user role to access this action
    ),

    /**
     * Delete device action
     */
    delete: restrict(
        async ({ request, locals }: AuthenticatedEvent) => {
            return await deviceActions.delete({
                request,
                locals
            });
        },
        [SystemRole.USER] // Only allow user role to access this action
    )
    // Note: create action is NOT available for user routes (enableCreate: false)
};
