import { mapToConfigPayload } from '$lib/utils/mappers/deviceProfileMapper';
import type { PageServerLoad, Actions } from './$types';
import { fail, redirect, error } from '@sveltejs/kit';
import { superValidate } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';
import { z } from 'zod';
import { logAudit } from '$lib/server/audit-logger';
import { AuditActionType } from '$lib/constants/system';
import { DESCRIPTION_MAX } from '$lib/constants/description';

// Define the form schema (settings handled as string, converted later)
const profileSchema = z.object({
    name: z.string().min(1, 'Profile name is required').max(100, 'Profile name must be less than 100 characters'),
    description: z.string().max(DESCRIPTION_MAX, `Description must be less than ${DESCRIPTION_MAX} characters`).optional(),
    isActive: z.string().optional().default('true'), // Store as string for Select component
    settings: z.string().optional().default('[]') // Store as JSON string
});

export const load: PageServerLoad = async ({ params, url, locals, cookies }) => {
    // Check authentication
    const auth = await locals.auth.validate();
    if (!auth?.user) {
        throw redirect(302, '/auth/login');
    }

    const { id: profileId } = params;

    // Get current account ID
    const currentAccountId =
        (locals as { currentAccount?: { account?: { id: string } } }).currentAccount?.account?.id ??
        cookies.get('current_account_id');
    
    if (!currentAccountId) {
        throw error(403, 'No account selected');
    }

    // Get profile details - filter by current account
    const profile = await locals.prisma.deviceProfile.findFirst({
        where: { id: profileId, accountId: currentAccountId },
        include: {
            settings: {
                orderBy: { order: 'asc' }
            },
            account: {
                select: {
                    id: true,
                    name: true
                }
            }
        }
    });

    if (!profile) {
        throw error(404, 'Profile not found');
    }

    // Initialize form with existing profile data
    const form = await superValidate({
        name: profile.name,
        description: profile.description || '',
        isActive: String(profile.isActive), // Convert boolean to string
        settings: JSON.stringify(profile.settings || [])
    }, zod(profileSchema));

    return {
        form,
        profile
    };
};

function getIpAddress(locals: App.Locals, getClientAddress: () => string): string {
    try {
        return (locals as { ipAddress?: string }).ipAddress ?? getClientAddress();
    } catch {
        return '';
    }
}

export const actions: Actions = {
    update: async ({ params, request, locals, fetch, getClientAddress, cookies }) => {
        const { id: profileId } = params;
        try {
            const auth = await locals.auth.validate();
            if (!auth?.user) {
                return fail(401, { message: 'Unauthorized' });
            }

            const form = await superValidate(request, zod(profileSchema));
            if (!form.valid) {
                return fail(400, { form });
            }

            // Get current account ID
            const currentAccountId =
                (locals as { currentAccount?: { account?: { id: string } } }).currentAccount?.account?.id ??
                cookies.get('current_account_id');
            
            if (!currentAccountId) {
                return fail(403, { form, message: 'No account selected' });
            }

            // Verify profile belongs to current account
            const existingProfile = await locals.prisma.deviceProfile.findFirst({
                where: { id: profileId, accountId: currentAccountId }
            });
            if (!existingProfile) {
                return fail(404, { form, error: 'Device profile not found' });
            }

            // Check for duplicate profile name (case-insensitive) within account, excluding current profile
            const existingByName = await locals.prisma.deviceProfile.findFirst({
                where: {
                    accountId: currentAccountId,
                    name: { equals: form.data.name.trim(), mode: 'insensitive' },
                    id: { not: profileId }
                }
            });
            if (existingByName) {
                return fail(400, { form, message: 'A profile with this name already exists. Please choose a unique name.' });
            }

            let settingsArray: Array<{ key?: string; value?: string; dataType?: string; label?: string; category?: string; order?: number }>;
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
                        create: settingsArray.map((s: any, index: number) => ({
                            key: String(s?.key ?? ''),
                            value: String(s?.value ?? ''),
                            dataType: String(s?.dataType ?? 'text'),
                            label: String(s?.label ?? ''),
                            category: s?.category ?? 'General',
                            order: typeof s?.order === 'number' ? s.order : index
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
                console.error('Audit log failed (profile still updated):', auditErr);
            }

            const deviceProfile = await locals.prisma.deviceProfile.findUnique({
                where: { id: profileId },
                select: {
                    id: true,
                    name: true,
                    settings: { select: { id: true, key: true, value: true, dataType: true, category: true } },
                    assignments: { select: { id: true } }
                }
            });

            if (updatedProfile.isActive && deviceProfile?.assignments?.length) {
                try {
                    const config = mapToConfigPayload(deviceProfile as any);
                    const response = await fetch(`/api/v2/device-profiles/${profileId}/broadcast-config`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ config })
                    });
                    if (!response.ok) {
                        const data = await response.json().catch(() => ({}));
                        console.error('Error broadcasting device profile settings:', data);
                    }
                } catch (err) {
                    console.error('Error broadcasting device profile settings:', err);
                }
            }

            // Form actions must return plain serializable data, not json() Response
            return { type: 'success', success: true, message: 'Device profile updated successfully' };
        } catch (err) {
            if (err instanceof Error && 'status' in err) {
                throw err;
            }
            const errMsg =
                err instanceof Error
                    ? err.message
                    : typeof err === 'object' && err !== null && 'message' in err
                      ? String((err as { message: unknown }).message)
                      : String(err);
            const safeMsg = errMsg || 'Failed to update device profile';
            console.error('Error updating device profile:', safeMsg, err);
            return fail(500, {
                message: safeMsg,
                error: { message: safeMsg }
            });
        }
    }
};
