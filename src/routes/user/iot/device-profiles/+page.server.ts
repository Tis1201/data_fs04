import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { restrict } from '$lib/server/security/guards';
import type { AuthenticatedLoadEvent } from '$lib/server/security/guards';
import { logger } from '$lib/server/logger';
import { SystemRole } from '$lib/types/roles';
import { loadDeviceProfileList } from '$lib/server/device-profiles/deviceProfileLoader';
import { superValidate } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';
import { z } from 'zod';
import { logAudit } from '$lib/server/audit-logger';
import { AuditActionType } from '$lib/constants/system';

const profileSchema = z.object({
    name: z.string().min(1, 'Profile name is required').max(100, 'Profile name must be less than 100 characters'),
    description: z.string().max(500).optional(),
    isActive: z.string().optional().default('true'),
    settings: z.string().optional().default('[]'),
    profileId: z.string().optional() // for update from modal (same page)
});

function getIpAddress(locals: App.Locals, getClientAddress: () => string): string {
    try {
        return (locals as { ipAddress?: string }).ipAddress ?? getClientAddress();
    } catch {
        return '';
    }
}

/*******************************************************************************************
 * 
 *  Load Block
 * 
 *******************************************************************************************/
export const load = restrict(
    async ({ url, locals, depends }: AuthenticatedLoadEvent) => {
        // Mark for client-side invalidation
        depends('app:userDeviceProfiles');
        
        try {
            // User routes need ownership checking - only show device profiles from their accounts
            const auth = await locals.auth.validate();
            const userId = auth?.user?.id;
            const accountId = (locals as any).currentAccount?.account?.id;
            
            return await loadDeviceProfileList(locals, url, {
                checkOwnership: true, // User can only see profiles from their accounts
                userId,
                accountId
            });
        } catch (e) {
            logger.error(`Error loading device profiles: ${JSON.stringify(e)}`);
            throw error(500, 'Failed to load device profiles');
        }
    },
    [SystemRole.USER] // Only allow user role to access this route
) satisfies PageServerLoad;

/*******************************************************************************************
 * 
 *  Actions Block
 * 
 *******************************************************************************************/
export const actions: Actions = {
    delete: restrict(
        async ({ request, locals, cookies }: { request: Request; locals: App.Locals; cookies: { get: (name: string) => string | undefined } }) => {
            const auth = await locals.auth.validate();
            if (!auth?.user?.id) {
                return fail(401, { message: 'Unauthorized' });
            }
            const formData = await request.formData();
            const id = formData.get('id') as string | null;
            if (!id) {
                return fail(400, { message: 'Profile ID is required' });
            }
            const currentAccountId =
                (locals as { currentAccount?: { account?: { id: string } } }).currentAccount?.account?.id ??
                cookies.get('current_account_id');
            if (!currentAccountId) {
                return fail(403, { message: 'No current account selected' });
            }
            const prisma = locals.prisma;
            const profile = await prisma.deviceProfile.findFirst({
                where: { id, accountId: currentAccountId, level: 'GLOBAL' }
            });
            if (!profile) {
                return fail(404, { message: 'Profile not found or access denied' });
            }
            await prisma.deviceProfile.delete({ where: { id } });
            return { type: 'success' };
        },
        [SystemRole.USER]
    ),

    create: restrict(
        async ({
            request,
            locals,
            getClientAddress,
            cookies
        }: {
            request: Request;
            locals: App.Locals;
            getClientAddress: () => string;
            cookies: { get: (name: string) => string | undefined };
        }) => {
            try {
                const auth = await locals.auth.validate();
                if (!auth?.user) {
                    return fail(401, { message: 'Unauthorized' });
                }
                const form = await superValidate(request, zod(profileSchema));
                if (!form.valid) {
                    return fail(400, { form });
                }
                // Use current account (switch-account aware) so profile is created in the selected account
                const currentAccountId =
                    (locals as { currentAccount?: { account?: { id: string } } }).currentAccount?.account?.id ??
                    cookies.get('current_account_id');
                let accountId: string | null = currentAccountId ?? null;
                if (!accountId) {
                    const m = await locals.prisma.accountMembership.findFirst({
                        where: {
                            userId: auth.user.id,
                            ...(auth.user.systemRole !== 'ADMIN' && { role: { in: ['OWNER', 'ADMIN', 'MEMBER'] } })
                        },
                        select: { accountId: true }
                    }) as { accountId: string } | null;
                    accountId = m?.accountId ?? null;
                }
                if (!accountId) {
                    return fail(403, { form, message: 'No account access found. Switch to an account or ensure you have a role in an account.' });
                }
                // Ensure user is allowed to create in this account
                const membership = await locals.prisma.accountMembership.findFirst({
                    where: {
                        userId: auth.user.id,
                        accountId,
                        ...(auth.user.systemRole !== 'ADMIN' && { role: { in: ['OWNER', 'ADMIN', 'MEMBER'] } })
                    }
                });
                if (!membership) {
                    return fail(403, { form, message: 'You do not have permission to create device profiles in this account.' });
                }
                let settings: any[] = [];
                try {
                    settings = JSON.parse(form.data.settings || '[]');
                } catch {
                    settings = [];
                }
                const profile = await locals.prisma.deviceProfile.create({
                    data: {
                        name: form.data.name,
                        description: form.data.description,
                        isActive: form.data.isActive === 'true',
                        accountId,
                        createdBy: auth.user.id,
                        settings: {
                            create: settings.map((s: any, i: number) => ({
                                key: String(s?.key ?? ''),
                                value: String(s?.value ?? ''),
                                dataType: String(s?.dataType ?? 'text'),
                                label: String(s?.label ?? ''),
                                category: s?.category ?? 'General',
                                order: typeof s?.order === 'number' ? s.order : i
                            }))
                        }
                    }
                });
                try {
                    await logAudit({
                        actionType: AuditActionType.INSERT,
                        tableName: 'DeviceProfile',
                        recordId: profile.id,
                        oldData: null,
                        newData: profile,
                        userId: auth.user.id,
                        ipAddress: getIpAddress(locals, getClientAddress) || undefined,
                        prisma: locals.prisma
                    });
                } catch (auditErr) {
                    logger.warn('Audit log failed (profile still created):', auditErr);
                }
                // Form actions must return plain serializable data, not json() Response
                return { type: 'success', success: true, message: 'Device profile created successfully' };
            } catch (err) {
                const errMsg = err instanceof Error ? err.message : typeof err === 'object' && err !== null && 'message' in err ? String((err as { message: unknown }).message) : String(err);
                logger.error('Error creating device profile:', { errMsg, err });
                return fail(500, { message: errMsg || 'Failed to create device profile', error: { message: errMsg || 'Failed to create device profile' } });
            }
        },
        [SystemRole.USER, SystemRole.ADMIN]
    ),

    update: restrict(
        async ({
            request,
            locals,
            getClientAddress,
            fetch: fetchFn,
            cookies
        }: {
            request: Request;
            locals: App.Locals;
            getClientAddress: () => string;
            fetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
            cookies: { get: (name: string) => string | undefined };
        }) => {
            try {
                const auth = await locals.auth.validate();
                if (!auth?.user) {
                    return fail(401, { message: 'Unauthorized' });
                }
                const form = await superValidate(request, zod(profileSchema));
                if (!form.valid) {
                    return fail(400, { form });
                }
                const profileId = form.data.profileId;
                if (!profileId) {
                    return fail(400, { form, message: 'Profile ID is required for update' });
                }
                // Get current account ID
                const currentAccountId =
                    (locals as { currentAccount?: { account?: { id: string } } }).currentAccount?.account?.id ??
                    cookies.get('current_account_id');
                if (!currentAccountId) {
                    return fail(403, { form, message: 'No current account selected' });
                }
                // Verify profile belongs to current account
                const existingProfile = await locals.prisma.deviceProfile.findFirst({
                    where: { id: profileId, accountId: currentAccountId }
                });
                if (!existingProfile) {
                    return fail(404, { form, error: 'Device profile not found' });
                }
                let settingsArray: any[] = [];
                try {
                    settingsArray = JSON.parse(form.data.settings || '[]');
                } catch {
                    settingsArray = [];
                }
                await locals.prisma.deviceProfileSetting.deleteMany({
                    where: { profileId }
                });
                // Include accountId in where clause for defense-in-depth
                const updatedProfile = await locals.prisma.deviceProfile.update({
                    where: { id: profileId, accountId: currentAccountId },
                    data: {
                        name: form.data.name,
                        description: form.data.description,
                        isActive: form.data.isActive === 'true',
                        updatedBy: auth.user.id,
                        settings: {
                            create: settingsArray.map((s: any, i: number) => ({
                                key: String(s?.key ?? ''),
                                value: String(s?.value ?? ''),
                                dataType: String(s?.dataType ?? 'text'),
                                label: String(s?.label ?? ''),
                                category: s?.category ?? 'General',
                                order: typeof s?.order === 'number' ? s.order : i
                            }))
                        }
                    }
                });
                try {
                    await logAudit({
                        actionType: AuditActionType.UPDATE,
                        tableName: 'DeviceProfile',
                        recordId: profileId,
                        oldData: existingProfile,
                        newData: updatedProfile,
                        userId: auth.user.id,
                        ipAddress: getIpAddress(locals, getClientAddress) || undefined,
                        prisma: locals.prisma
                    });
                } catch (auditErr) {
                    logger.warn('Audit log failed (profile still updated):', auditErr);
                }
                const deviceProfile = await locals.prisma.deviceProfile.findUnique({
                    where: { id: profileId },
                    select: {
                        id: true,
                        name: true,
                        settings: { select: { id: true, key: true, value: true, dataType: true, category: true } },
                        assignments: { select: { id: true, deviceId: true } }
                    }
                });
                // Reapply profile to all assigned devices so they receive and apply the updated config
                if (updatedProfile.isActive && deviceProfile?.assignments?.length && fetchFn) {
                    const deviceIds = deviceProfile.assignments.map((a: { deviceId: string }) => a.deviceId);
                    try {
                        const origin = new URL(request.url).origin;
                        const res = await fetchFn(`${origin}/api/v2/device-profiles/${profileId}/reapply`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ deviceIds })
                        });
                        if (!res.ok) {
                            const data = await res.json().catch(() => ({}));
                            logger.warn('Error reapplying profile to devices:', data);
                        } else {
                            logger.info(`Reapply triggered for profile ${profileId} to ${deviceIds.length} device(s)`);
                        }
                    } catch (err) {
                        logger.warn('Error reapplying profile to devices:', err);
                    }
                }
                // Form actions must return plain serializable data, not json() Response
                return { type: 'success', success: true, message: 'Device profile updated successfully' };
            } catch (err) {
                if (err instanceof Error && 'status' in err) throw err;
                const errMsg = err instanceof Error ? err.message : typeof err === 'object' && err !== null && 'message' in err ? String((err as { message: unknown }).message) : String(err);
                logger.error('Error updating device profile:', { errMsg, err });
                return fail(500, { message: errMsg || 'Failed to update device profile', error: { message: errMsg || 'Failed to update device profile' } });
            }
        },
        [SystemRole.USER, SystemRole.ADMIN]
    )
};
