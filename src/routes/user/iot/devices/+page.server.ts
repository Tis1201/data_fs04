import { error } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { logger } from '$lib/server/logger';
import { loadDeviceList } from '$lib/server/devices/deviceLoader';
import { createDeviceActions } from '$lib/server/devices/deviceActions';

/*******************************************************************************************
 * 
 *  Load Block (no ACL - any authenticated user with account can access)
 * 
 *******************************************************************************************/
export const load: PageServerLoad = async ({ url, locals, depends }) => {
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
};

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
    toggleStatus: async ({ request, locals }) => {
        return await deviceActions.toggleStatus({ request, locals });
    },

    /**
     * Delete device action
     */
    delete: async ({ request, locals }) => {
        return await deviceActions.delete({ request, locals });
    },

    /**
     * Assign tags to device action
     */
    assignTags: async ({ request, locals }) => {
        return await deviceActions.assignTags({ request, locals });
    },

    /**
     * Get device details action
     */
    getDeviceDetails: async ({ request, locals }) => {
        return await deviceActions.getDeviceDetails({ request, locals });
    },

    /**
     * Update device action
     */
    updateDevice: async ({ request, locals }) => {
        return await deviceActions.updateDevice({ request, locals });
    }
    // Note: create action is NOT available for user routes (enableCreate: false)
};
