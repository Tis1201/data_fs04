import { error, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { restrict } from '$lib/server/security/guards';
import type { AuthenticatedEvent, AuthenticatedLoadEvent } from '$lib/server/security/guards';
import { logger } from '$lib/server/logger';
import { SystemRole } from '$lib/types/roles';
import { loadPreclaimList } from '$lib/server/preclaims/preclaimLoader';
import { createPreclaimActions } from '$lib/server/preclaims/preclaimActions';

/*******************************************************************************************
 * 
 *  Load Block
 * 
 *******************************************************************************************/
export const load = restrict(
    async ({ url, locals, depends, cookies }: AuthenticatedLoadEvent) => {
        depends('app:userPreclaimSets');

        try {
            const auth = await locals.auth.validate();
            const userId = auth?.user?.id;
            const accountId =
                (locals as any).currentAccount?.account?.id ??
                cookies.get('current_account_id');

            const listResult = await loadPreclaimList(locals, url, {
                checkOwnership: true,
                userId,
                accountId,
                useEnhancedPrisma: true
            });

            // Load profile options for Add/Edit modal (GLOBAL level, current account)
            const currentAccountId = (locals as any).currentAccount?.account?.id ?? accountId;
            const profiles = currentAccountId
                ? await locals.prisma.deviceProfile.findMany({
                      where: {
                          isActive: true,
                          level: 'GLOBAL',
                          accountId: currentAccountId
                      },
                      select: { id: true, name: true, description: true },
                      orderBy: { name: 'asc' }
                  })
                : [];

            const profileOptions = profiles.map((p: { id: string; name: string; description: string | null }) => ({
                id: p.id,
                label: p.name
            }));

            // Account options: only accounts the user is a member of (not all non-system accounts)
            const memberships = userId
                ? await locals.prisma.accountMembership.findMany({
                      where: { userId },
                      select: { accountId: true }
                  })
                : [];
            const accountIds = memberships.map((m: { accountId: string }) => m.accountId);
            const userAccounts =
                accountIds.length > 0
                    ? await locals.prisma.account.findMany({
                          where: { id: { in: accountIds }, isSystem: false },
                          select: { id: true, name: true },
                          orderBy: { name: 'asc' }
                      })
                    : [];
            const accountOptions = userAccounts.map((a: { id: string; name: string }) => ({
                id: a.id,
                label: a.name
            }));

            return {
                ...listResult,
                profileOptions,
                accountOptions
            };
        } catch (e) {
            logger.error(`Error loading preclaims: ${JSON.stringify(e)}`);
            throw error(500, 'Failed to load preclaims');
        }
    },
    [SystemRole.USER]
) satisfies PageServerLoad;

/*******************************************************************************************
 * 
 *  Actions Block
 * 
 *******************************************************************************************/
const preclaimActions = createPreclaimActions({
    checkOwnership: true,
    useEnhancedPrisma: true
});

export const actions: Actions = {
    toggleStatus: restrict(
        async ({ request, locals }: AuthenticatedEvent) => {
            return await preclaimActions.toggleStatus({ request, locals });
        },
        [SystemRole.USER]
    ),

    delete: restrict(
        async ({ request, locals, cookies }: AuthenticatedEvent) => {
            const formData = await request.formData();
            const id = formData.get('id')?.toString();
            if (!id) {
                return fail(400, { type: 'error', message: 'Pre-Enrollment set ID is required' });
            }

            // Get current account ID
            const currentAccountId =
                (locals as any).currentAccount?.account?.id ?? cookies.get('current_account_id');
            
            if (!currentAccountId) {
                return fail(403, { type: 'error', message: 'No account selected' });
            }

            try {
                // Verify preclaim set belongs to current account
                const existing = await locals.prisma.preclaimSet.findFirst({ 
                    where: { id, accountId: currentAccountId } 
                });
                if (!existing) {
                    return fail(404, { type: 'error', message: 'Pre-Enrollment set not found' });
                }
                await locals.prisma.preclaimSet.delete({ where: { id } });
                return { type: 'success', message: 'Pre-enrollment deleted successfully.' };
            } catch (e) {
                logger.error(`Error deleting preclaim set ${id}: ${e}`);
                return fail(500, { type: 'error', message: 'Unable to delete Pre-enrollment. Please try again!' });
            }
        },
        [SystemRole.USER]
    )
};
