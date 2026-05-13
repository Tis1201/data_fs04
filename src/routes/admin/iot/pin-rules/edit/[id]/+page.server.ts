import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { restrict } from '$lib/server/security/guards';
import { SystemRole } from '$lib/types/roles';
import { loadPinRuleDetail } from '$lib/server/pin-rules/pinRuleLoader';
import type { AuthenticatedLoadEvent } from '$lib/server/security/guards';

/**
 * Load pin rule detail data for edit page
 * Per structural standard: thin wrapper using shared loader
 */
export const load = restrict(
    async ({ params, locals, auth }: AuthenticatedLoadEvent) => {
        const { id } = params;
        if (!id) {
            throw redirect(302, '/admin/iot/pin-rules');
        }

        try {
            const result = await loadPinRuleDetail(locals, id, {
                includeUserInfo: true
            });

            return {
                rule: result.pinRule
            };
        } catch (error) {
            console.error('Error loading pin rule:', error);
            throw redirect(302, '/admin/iot/pin-rules');
        }
    },
    [SystemRole.ADMIN]
) satisfies PageServerLoad;