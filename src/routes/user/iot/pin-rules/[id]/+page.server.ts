import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { restrict } from '$lib/server/security/guards';
import { SystemRole } from '$lib/types/roles';
import { loadPinRuleDetail } from '$lib/server/pin-rules/pinRuleLoader';
import type { AuthenticatedLoadEvent } from '$lib/server/security/guards';

/**
 * Load pin rule for detail page (read-only view)
 */
export const load = restrict(
    async ({ params, locals, auth, depends, cookies }: AuthenticatedLoadEvent) => {
        depends('app:pin-rules');
        const { id } = params;
        if (!id) {
            throw redirect(302, '/user/iot/pin-rules');
        }
        if (!auth) {
            throw redirect(302, '/user/iot/pin-rules');
        }
        try {
            const currentAccountId =
                (locals as any).currentAccount?.account?.id ??
                cookies.get('current_account_id');
            if (!currentAccountId) {
                throw redirect(302, '/user/iot/pin-rules');
            }
            const result = await loadPinRuleDetail(locals, id, {
                checkOwnership: true,
                userId: auth.user.id,
                accountId: currentAccountId,
                includeUserInfo: true
            });
            // Access: admin_default → anyone; user_default → account members (loadPinRuleDetail verifies accountId);
            // user_custom → creator only
            const canView =
                result.pinRule.ruleType === 'admin_default' ||
                result.pinRule.ruleType === 'user_default' ||
                (result.pinRule.ruleType === 'user_custom' && result.pinRule.createdBy === auth.user.id);
            if (!canView) {
                throw redirect(302, '/user/iot/pin-rules');
            }
            const accountRole =
                (locals as { currentAccount?: { role?: string } }).currentAccount?.role ?? null;
            // Match API PUT logic: admin_* → system ADMIN only; user_default → OWNER/ADMIN; user_custom → creator only
            const canEdit =
                (result.pinRule.ruleType === 'admin_default' || result.pinRule.ruleType === 'admin_custom')
                    ? auth.user.systemRole === 'ADMIN'
                    : result.pinRule.ruleType === 'user_default'
                        ? !!(accountRole && ['OWNER', 'ADMIN'].includes(accountRole))
                        : result.pinRule.ruleType === 'user_custom' && result.pinRule.createdBy === auth.user.id;
            return {
                user: auth.user,
                rule: result.pinRule,
                accountRole,
                canEdit
            };
        } catch (error) {
            console.error('Error loading pin rule:', error);
            throw redirect(302, '/user/iot/pin-rules');
        }
    },
    [SystemRole.USER]
) satisfies PageServerLoad;
