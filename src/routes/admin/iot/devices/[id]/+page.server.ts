import type { PageServerLoad, Actions } from './$types';
import { fail, error } from '@sveltejs/kit';
import { restrict } from '$lib/server/security/guards';
import type { AuthenticatedEvent, AuthenticatedLoadEvent } from '$lib/server/security/guards';
import { SystemRole } from '$lib/types/roles';
import { deviceEditSchema } from './schema';
import { loadDeviceDetail } from '$lib/server/devices/deviceLoader';
import { 
    createSaveAction, 
    createGenerateApiKeyAction, 
    createUpdateDeviceProfileAction 
} from '$lib/server/device/deviceDetailActions';

/*******************************************************************************************
 * 
 *  Load Block
 * 
 *******************************************************************************************/
export const load = restrict(
    async ({ params, locals, depends }: AuthenticatedLoadEvent) => {
        // Mark for client-side invalidation
        depends('app:device');
        
        const { id } = params;
        if (!id) {
            throw error(400, 'Device ID is required');
        }
        
        return await loadDeviceDetail(
            locals,
            id,
            deviceEditSchema,
            {
                checkOwnership: false, // Admin doesn't need ownership check
                verboseLogging: true   // Admin uses verbose logging
            }
        );
    },
    [SystemRole.ADMIN] // Only allow admin role to access this route
) satisfies PageServerLoad;

/*******************************************************************************************
 * 
 *  Actions Block
 * 
 *******************************************************************************************/
export const actions: Actions = {
    /**
     * Update device data
     */
    save: restrict(
        async ({ params, request, locals }: AuthenticatedEvent) => {
            const { id } = params;
            if (!id) {
                return fail(400, { error: 'Device ID is required' });
            }
            const saveAction = createSaveAction(deviceEditSchema);
            return await saveAction({
                prisma: locals.prisma,
                userId: (locals as any).user.id,
                ipAddress: (locals as any).ipAddress,
                deviceId: id,
                checkOwnership: false // Admin doesn't need ownership check
            }, request);
        },
        [SystemRole.ADMIN] // Only allow admin role to access this action
    ),

    /**
     * Generate new API key for the device
     */
    generateApiKey: restrict(
        async ({ params, locals }: AuthenticatedEvent) => {
            const { id } = params;
            if (!id) {
                throw error(400, 'Device ID is required');
            }
            const generateApiKeyAction = createGenerateApiKeyAction(deviceEditSchema);
            return await generateApiKeyAction({
                prisma: locals.prisma,
                userId: (locals as any).user.id,
                ipAddress: (locals as any).ipAddress,
                deviceId: id,
                checkOwnership: false // Admin doesn't need ownership check
            });
        },
        [SystemRole.ADMIN] // Only allow admin role to access this action
    ),

    /**
     * Update device-level profile
     */
    updateDeviceProfile: restrict(
        async ({ params, request, locals }: AuthenticatedEvent) => {
            const { id } = params;
            if (!id) {
                return fail(400, { error: 'Device ID is required' });
            }
            const auth = await locals.auth.validate();
            
            if (!auth?.user) {
                return fail(401, { message: 'Unauthorized' });
            }

            const updateProfileAction = createUpdateDeviceProfileAction();
            return await updateProfileAction({
                prisma: locals.prisma,
                userId: auth.user.id,
                ipAddress: (locals as any).ipAddress,
                deviceId: id,
                checkOwnership: false // Admin doesn't need ownership check
            }, request);
        },
        [SystemRole.ADMIN]
    )
};
