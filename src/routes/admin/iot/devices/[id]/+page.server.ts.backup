import type { PageServerLoad, Actions } from './$types';
import type { RequestEvent } from '@sveltejs/kit';
import { fail } from '@sveltejs/kit';
import { restrict } from '$lib/server/security/guards';
import { SystemRole } from '$lib/types/roles';
import { deviceEditSchema } from './schema';
import { loadDeviceDetail } from '$lib/server/device/deviceDetailLoader';
import { 
    createSaveAction, 
    createGenerateApiKeyAction, 
    createUpdateDeviceProfileAction 
} from '$lib/server/device/deviceDetailActions';

export const load = restrict(
    async (event: any) => {
        event.depends('app:device');
        
        if (!event.params.id) {
            throw new Error('Device ID is required');
        }
        
        return await loadDeviceDetail(
            event.locals.prisma,
            event.params.id,
            deviceEditSchema,
            {
                checkOwnership: false, // Admin doesn't need ownership check
                verboseLogging: true   // Admin uses verbose logging
            }
        );
    },
    [SystemRole.ADMIN] // Only allow admin role to access this route
) satisfies PageServerLoad;

export const actions: Actions = {
    /**
     * Update device data
     */
    save: restrict(
        async (event: any) => {
            const saveAction = createSaveAction(deviceEditSchema);
            return await saveAction({
                prisma: event.locals.prisma,
                userId: (event.locals as any).user.id,
                ipAddress: (event.locals as any).ipAddress,
                deviceId: event.params.id,
                checkOwnership: false // Admin doesn't need ownership check
            }, event.request);
        },
        [SystemRole.ADMIN] // Only allow admin role to access this action
    ),

    /**
     * Generate new API key for the device
     */
    generateApiKey: restrict(
        async (event: any) => {
            const generateApiKeyAction = createGenerateApiKeyAction(deviceEditSchema);
            return await generateApiKeyAction({
                prisma: event.locals.prisma,
                userId: (event.locals as any).user.id,
                ipAddress: (event.locals as any).ipAddress,
                deviceId: event.params.id,
                checkOwnership: false // Admin doesn't need ownership check
            });
        },
        [SystemRole.ADMIN] // Only allow admin role to access this action
    ),

    /**
     * Update device-level profile
     */
    updateDeviceProfile: restrict(
        async (event: any) => {
            const auth = await event.locals.auth.validate();
            
            if (!auth?.user) {
                return fail(401, { message: 'Unauthorized' });
            }

            const updateProfileAction = createUpdateDeviceProfileAction();
            return await updateProfileAction({
                prisma: event.locals.prisma,
                userId: auth.user.id,
                ipAddress: (event.locals as any).ipAddress,
                deviceId: event.params.id,
                checkOwnership: false // Admin doesn't need ownership check
            }, event.request);
        },
        [SystemRole.ADMIN]
    )
};
