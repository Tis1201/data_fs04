import type { PageServerLoad, Actions } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import { superValidate } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';
import { z } from 'zod';
import { logAudit } from '$lib/server/audit-logger';
import { AuditActionType } from '$lib/constants/system';

// Define the form schema (settings handled as string, converted later)
const profileSchema = z.object({
    name: z.string().min(1, 'Profile name is required').max(100, 'Profile name must be less than 100 characters'),
    description: z.string().max(500, 'Description must be less than 500 characters').optional(),
    isActive: z.string().optional().default('true'), // Store as string for Select component
    settings: z.string().optional().default('[]') // Store as JSON string
});

export const load: PageServerLoad = async ({ locals, url }) => {
    // Check authentication
    const auth = await locals.auth.validate();
    if (!auth?.user) {
        throw redirect(302, '/auth/login');
    }

    // Initialize form with default values and default settings
    const defaultSettings = [
        {
            key: 'kiosk_lock_mode',
            value: 'disabled',
            dataType: 'select',
            label: 'Kiosk Lock Mode',
            category: 'Security',
            order: 0
        },
        {
            key: 'exit_lockdown_password',
            value: '',
            dataType: 'password',
            label: 'Exit Lockdown Password',
            category: 'Security',
            order: 1
        },
        {
            key: 'display_resolution',
            value: '1920x1080',
            dataType: 'select',
            label: 'Display Resolution',
            category: 'Display',
            order: 2
        },
        {
            key: 'screen_orientation',
            value: 'landscape',
            dataType: 'select',
            label: 'Screen Orientation',
            category: 'Display',
            order: 3
        },
        {
            key: 'enable_audio',
            value: 'enabled',
            dataType: 'select',
            label: 'Enable Audio',
            category: 'Audio',
            order: 4
        },
        {
            key: 'volume_level',
            value: '50',
            dataType: 'number',
            label: 'Volume Level',
            category: 'Audio',
            order: 5
        },
        {
            key: 'power_management_schedule',
            value: 'disabled',
            dataType: 'select',
            label: 'Power Management Schedule',
            category: 'Power',
            order: 6
        },
        {
            key: 'reboot_schedule',
            value: 'disabled',
            dataType: 'select',
            label: 'Reboot Schedule',
            category: 'Maintenance',
            order: 7
        },
        {
            key: 'download_schedule',
            value: 'disabled',
            dataType: 'select',
            label: 'Download Schedule',
            category: 'Maintenance',
            order: 8
        }
    ];

    const form = await superValidate(zod(profileSchema), {
        defaults: {
            name: '',
            description: '',
            isActive: 'true',
            settings: JSON.stringify(defaultSettings)
        }
    });

    return {
        form
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
    create: async ({ request, locals, getClientAddress }) => {
        try {
            const auth = await locals.auth.validate();
            if (!auth?.user) {
                return fail(401, { message: 'Unauthorized' });
            }

            const form = await superValidate(request, zod(profileSchema));
            if (!form.valid) {
                return fail(400, { form });
            }

            let userAccountMembership: { accountId: string; role: string };
            if (auth.user.systemRole === 'ADMIN') {
                const m = await locals.prisma.accountMembership.findFirst({
                    where: { userId: auth.user.id },
                    select: { accountId: true, role: true }
                });
                if (!m) {
                    return fail(403, { form, message: 'No account access found. Please contact your administrator.' });
                }
                userAccountMembership = m;
            } else {
                const allUserMemberships = await locals.prisma.accountMembership.findMany({
                    where: { userId: auth.user.id },
                    select: { accountId: true, role: true }
                });
                const m = await locals.prisma.accountMembership.findFirst({
                    where: { userId: auth.user.id, role: { in: ['OWNER', 'ADMIN', 'MEMBER'] } },
                    select: { accountId: true, role: true }
                });
                if (!m) {
                    return fail(403, {
                        form,
                        message: 'Access denied. You need OWNER, ADMIN, or MEMBER role in an account to create device profiles. Your current role(s): ' +
                            (allUserMemberships.map((x) => x.role).join(', ') || 'None')
                    });
                }
                userAccountMembership = m;
            }

            let settings: Array<{ key: string; value: string; dataType: string; label: string; category?: string; order?: number }>;
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
                    accountId: userAccountMembership.accountId,
                    createdBy: auth.user.id,
                    settings: {
                        create: settings.map((s: any, index: number) => ({
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
                console.error('Audit log failed (profile still created):', auditErr);
            }

            // Form actions must return plain serializable data, not json() Response
            return { type: 'success', success: true, message: 'Device profile created successfully' };
        } catch (err) {
            const errMsg =
                err instanceof Error
                    ? err.message
                    : typeof err === 'object' && err !== null && 'message' in err
                      ? String((err as { message: unknown }).message)
                      : String(err);
            const safeMsg = errMsg || 'Failed to create device profile';
            console.error('Error creating device profile:', safeMsg, err);
            return fail(500, {
                message: safeMsg,
                error: { message: safeMsg }
            });
        }
    }
};
