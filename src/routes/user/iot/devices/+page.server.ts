import { error } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { restrictModule } from '$lib/server/security/guards';
import type { ModuleAuthenticatedEvent, ModuleAuthenticatedLoadEvent } from '$lib/server/security/guards';
import { logger } from '$lib/server/logger';
import { loadDeviceList } from '$lib/server/devices/deviceLoader';
import { createDeviceActions } from '$lib/server/devices/deviceActions';

/*******************************************************************************************
 * 
 *  Load Block - Using Module Access Control
 * 
 *******************************************************************************************/
export const load = restrictModule(
    async ({ url, locals, depends }: ModuleAuthenticatedLoadEvent) => {
        // Mark for client-side invalidation
        depends('app:userDevices');
        
        try {
            // User routes need ownership checking - only show devices they own or have access to
            const userId = (locals as any).user?.id || (locals as any).auth?.user?.id;
            const accountId = (locals as any).currentAccount?.account?.id;
            
            logger.info('Loading devices for user', { userId, accountId, path: url.pathname });
            
            const result = await loadDeviceList(locals, url, {
                checkOwnership: true,
                userId,
                accountId,
                includeStats: true,        // Users also get device statistics for their devices
                includeRealTimeStatus: true // Users get real-time status
            });
            
            logger.info('Successfully loaded devices', { 
                deviceCount: result?.devices?.length || 0,
                userId,
                accountId 
            });
            
            return result;
        } catch (e) {
            const errorMessage = e instanceof Error ? e.message : String(e);
            const errorStack = e instanceof Error ? e.stack : undefined;
            logger.error(`Error loading devices: ${errorMessage}`, {
                error: e,
                stack: errorStack,
                userId: (locals as any).user?.id || (locals as any).auth?.user?.id,
                accountId: (locals as any).currentAccount?.account?.id,
                path: url.pathname
            });
            
            // If it's already a SvelteKit error, re-throw it
            if (e && typeof e === 'object' && 'status' in e) {
                throw e;
            }
            
            throw error(500, `Failed to load devices: ${errorMessage}`);
        }
    },
    'USER_DEVICES',  // Module name from routeModuleMap
    { action: 'VIEW' }  // Required action
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
     * Toggle device status action - requires EDIT permission
     */
    toggleStatus: restrictModule(
        async ({ request, locals }: ModuleAuthenticatedEvent) => {
            return await deviceActions.toggleStatus({
                request,
                locals
            });
        },
        'USER_DEVICES',
        { action: 'EDIT' }
    ),

    /**
     * Delete device action - requires DELETE permission
     */
    delete: restrictModule(
        async ({ request, locals }: ModuleAuthenticatedEvent) => {
            return await deviceActions.delete({
                request,
                locals
            });
        },
        'USER_DEVICES',
        { action: 'DELETE' }
    ),

    /**
     * Assign tags to device action - requires EDIT permission
     */
    assignTags: restrictModule(
        async ({ request, locals }: ModuleAuthenticatedEvent) => {
            return await deviceActions.assignTags({
                request,
                locals
            });
        },
        'USER_DEVICES',
        { action: 'EDIT' }
    ),

    /**
     * Update device action - requires EDIT permission
     */
    updateDevice: restrictModule(
        async ({ request, locals }: ModuleAuthenticatedEvent) => {
            return await deviceActions.updateDevice({
                request,
                locals
            });
        },
        'USER_DEVICES',
        { action: 'EDIT' }
    )
    // Note: create action is NOT available for user routes (enableCreate: false)
};
