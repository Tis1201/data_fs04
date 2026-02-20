import { error, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { restrict } from '$lib/server/security/guards';
import type { AuthenticatedLoadEvent, AuthenticatedEvent } from '$lib/server/security/guards';
import { logger } from '$lib/server/logger';
import { SystemRole } from '$lib/types/roles';
import { loadDeviceTagList } from '$lib/server/device-tags/deviceTagLoader';
import { createDeviceTagActions } from '$lib/server/device-tags/deviceTagActions';
import { AuditActionType } from '$lib/constants/system';
import { logAudit } from '$lib/server/audit-logger';

/*******************************************************************************************
 * 
 *  Load Block
 * 
 *******************************************************************************************/
export const load = restrict(
    async ({ url, locals, depends, cookies }: AuthenticatedLoadEvent) => {
        depends('app:userDeviceTags');
        
        try {
            const auth = await locals.auth.validate();
            const userId = auth?.user?.id;
            const accountId =
                (locals as any).currentAccount?.account?.id ??
                cookies.get('current_account_id');
            
            const result = await loadDeviceTagList(locals, url, {
                checkOwnership: true,
                userId,
                accountId
            });

            const currentAccount = (locals as any).currentAccount?.account;
            
            return {
                ...result,
                currentAccount: currentAccount ? {
                    id: currentAccount.id,
                    name: currentAccount.name
                } : null
            };
        } catch (e) {
            logger.error(`Error loading device tags: ${JSON.stringify(e)}`);
            throw error(500, 'Failed to load device tags');
        }
    },
    [SystemRole.USER]
) satisfies PageServerLoad;

/*******************************************************************************************
 * 
 *  Actions Block
 * 
 *******************************************************************************************/
// Create actions with user privileges (ownership check enabled)
const deviceTagActions = createDeviceTagActions({
    checkOwnership: true
});

export const actions: Actions = {
    /**
     * Create device tag action
     */
    createTag: restrict(
        async ({ request, locals }: AuthenticatedEvent) => {
            const formData = await request.formData();
            const name = formData.get('name')?.toString()?.trim() || '';
            const description = formData.get('description')?.toString()?.trim() || '';

            if (!name) {
                return fail(400, { success: false, error: 'Tag name is required' });
            }

            try {
                const currentAccount = (locals as any).currentAccount?.account;
                if (!currentAccount?.id) {
                    return fail(400, { success: false, error: 'No account selected' });
                }

                const accountId = currentAccount.id;

                const existingTag = await locals.prisma.deviceTag.findFirst({
                    where: {
                        accountId,
                        name: { equals: name, mode: 'insensitive' }
                    }
                });

                if (existingTag) {
                    return fail(409, { success: false, error: 'A tag with this name already exists' });
                }

                const deviceTag = await locals.prisma.deviceTag.create({
                    data: {
                        name,
                        description: description || null,
                        accountId
                    }
                });

                logger.info(`Device Tag created: ${deviceTag.id} by user ${locals.user.id}`);

                await logAudit({
                    actionType: AuditActionType.INSERT,
                    tableName: 'DeviceTag',
                    recordId: deviceTag.id,
                    oldData: null,
                    newData: deviceTag,
                    userId: locals.user.id,
                    ipAddress: locals.ipAddress,
                    prisma: locals.prisma
                });

                return { success: true, tag: deviceTag };
            } catch (err) {
                logger.error(`Error creating device tag: ${JSON.stringify(err)}`);
                return fail(500, { success: false, error: 'Failed to create tag. Please try again.' });
            }
        },
        [SystemRole.USER]
    ),

    /**
     * Delete device tag action
     */
    delete: restrict(
        async ({ request, locals }: AuthenticatedEvent) => {
            return await deviceTagActions.delete({
                request,
                locals
            });
        },
        [SystemRole.USER]
    )
};
