import type { PageServerLoad, Actions } from './$types';
import { restrict } from '$lib/server/security/guards';
import { SystemRole } from '$lib/types/roles';
import { loadPinRuleList } from '$lib/server/pin-rules/pinRuleLoader';
import { createPinRuleActions } from '$lib/server/pin-rules/pinRuleActions';
import type { AuthenticatedLoadEvent } from '$lib/server/security/guards';

/**
 * Load pin rule list data
 * Per structural standard: thin wrapper using shared loader
 */
export const load = restrict(
    async ({ url, locals, depends, auth }: AuthenticatedLoadEvent) => {
        // Add depends call for cache invalidation
        depends('app:pin-rules');
        
        try {
            // Get user's account for scoping
            const membership = await locals.prisma.accountMembership.findFirst({
                where: { userId: auth.user.id },
                select: { accountId: true, role: true }
            });

            if (!membership) {
                return {
                    user: auth.user,
                    accountRole: null,
                    rules: [],
                    meta: {
                        pagination: {
                            page: 1,
                            per_page: 10,
                            total_records: 0,
                            total_pages: 0
                        },
                        sort: {
                            field: 'createdAt',
                            order: 'desc'
                        },
                        filters: {}
                    }
                };
            }

            const result = await loadPinRuleList(locals, url, {
                checkOwnership: true,
                userId: auth.user.id,
                accountId: membership.accountId
            });
            
            return {
                user: auth.user,
                accountRole: membership.role,
                ...result
            };
        } catch (error) {
            console.error('Error loading pin rules:', error);
            return {
                user: auth.user,
                accountRole: null,
                rules: [],
                meta: {
                    pagination: {
                        page: 1,
                        per_page: 10,
                        total_records: 0,
                        total_pages: 0
                    },
                    sort: {
                        field: 'createdAt',
                        order: 'desc'
                    },
                    filters: {}
                }
            };
        }
    },
    [SystemRole.USER]
) satisfies PageServerLoad;

/**
 * Pin rule actions
 * Per structural standard: thin wrapper using shared actions factory
 */
export const actions: Actions = {
    ...createPinRuleActions({ checkOwnership: true })
};
