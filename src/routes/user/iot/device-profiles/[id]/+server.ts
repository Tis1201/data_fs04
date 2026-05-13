import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { restrict } from '$lib/server/security/guards';
import type { AuthenticatedEvent } from '$lib/server/security/guards';
import { SystemRole } from '$lib/types/roles';
import { loadDeviceProfileDetail } from '$lib/server/device-profiles/deviceProfileLoader';

/**
 * GET /user/iot/device-profiles/[id]
 * Returns profile details with settings as JSON for Edit Profile modal
 */
export const GET: RequestHandler = restrict(
    async ({ params, locals }: AuthenticatedEvent) => {
        const profileId = params.id;

        if (!profileId) {
            throw error(400, 'Profile ID is required');
        }

        const auth = await locals.auth.validate();
        if (!auth?.user?.id) {
            throw error(401, 'Unauthorized');
        }

        const accountId = (locals as any).currentAccount?.account?.id;

        const result = await loadDeviceProfileDetail(locals, profileId, {
            checkOwnership: true,
            userId: auth.user.id,
            accountId
        });

        const profile = result.profile as any;
        const settingsArray = (profile.settings || []).map((s: any, index: number) => ({
            key: s.key,
            value: s.value,
            dataType: s.dataType,
            label: s.label,
            category: s.category || 'General',
            order: s.order !== undefined ? s.order : index
        }));

        return json({
            success: true,
            profile: {
                id: profile.id,
                name: profile.name,
                description: profile.description || '',
                isActive: profile.isActive,
                settings: settingsArray
            },
            form: {
                name: profile.name,
                description: profile.description || '',
                isActive: String(profile.isActive),
                settings: JSON.stringify(settingsArray)
            }
        });
    },
    [SystemRole.USER]
) satisfies RequestHandler;
