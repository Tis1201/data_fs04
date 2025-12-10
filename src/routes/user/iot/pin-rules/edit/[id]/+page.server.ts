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
            throw redirect(302, '/user/iot/pin-rules');
        }

        // auth is guaranteed by restrict but TypeScript still includes null, so guard
        if (!auth) {
            throw redirect(302, '/user/iot/pin-rules');
        }

        try {
            // Get user's account for scoping
            const membership = await locals.prisma.accountMembership.findFirst({
                where: { userId: auth.user.id },
                select: { accountId: true, role: true }
            });

            if (!membership) {
                throw redirect(302, '/user/iot/pin-rules');
            }

            const result = await loadPinRuleDetail(locals, id, {
                checkOwnership: true,
                userId: auth.user.id,
                accountId: membership.accountId,
                includeUserInfo: true
            });

            // Additional check: User can edit their own rules or admin_default rules
            if (result.pinRule.createdBy !== auth.user.id && result.pinRule.ruleType !== 'admin_default') {
                throw redirect(302, '/user/iot/pin-rules');
            }

            return {
                user: auth.user,
                rule: result.pinRule
            };
        } catch (error) {
            console.error('Error loading pin rule:', error);
            throw redirect(302, '/user/iot/pin-rules');
        }
    },
    [SystemRole.USER]
) satisfies PageServerLoad;
