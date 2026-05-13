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

export const actions: Actions = {
    create: async ({ request, locals, getClientAddress }) => {
        // Check authentication
        const auth = await locals.auth.validate();
        if (!auth?.user) {
            return fail(401, { message: 'Unauthorized' });
        }

        // Validate form with standard data type
        const form = await superValidate(request, zod(profileSchema));
        
        if (!form.valid) {
            return fail(400, { form });
        }

        // Get user's account membership with appropriate roles
        const userAccountMembership = await locals.prisma.accountMembership.findFirst({
            where: { 
                userId: auth.user.id,
                role: { in: ['SYSTEM', 'OWNER', 'ADMIN', 'MEMBER'] }
            },
            select: { accountId: true }
        });

        if (!userAccountMembership) {
            return fail(403, { 
                form,
                message: 'No account access found' 
            });
        }

        // Parse settings from form data
        let settings = [];
        try {
            settings = JSON.parse(form.data.settings || '[]');
        } catch (e) {
            // Error parsing settings JSON
            settings = [];
        }

        try {
            // Create device profile with settings
            // Filter out only the fields that exist in the database schema
            const profile = await locals.prisma.deviceProfile.create({
                data: {
                    name: form.data.name,
                    description: form.data.description,
                    isActive: form.data.isActive === 'true', // Convert string to boolean
                    accountId: userAccountMembership.accountId,
                    createdBy: auth.user.id,
                    settings: {
                        create: settings.map((setting: any, index: number) => ({
                            key: setting.key,
                            value: String(setting.value || ''), // Ensure value is a string
                            dataType: setting.dataType,
                            label: setting.label,
                            category: setting.category || 'General',
                            order: setting.order !== undefined ? setting.order : index
                        }))
                    }
                }
            });

            // Log audit for device profile creation
            await logAudit({
                actionType: AuditActionType.INSERT,
                tableName: 'DeviceProfile',
                recordId: profile.id,
                oldData: null,
                newData: profile,
                userId: auth.user.id,
                ipAddress: (locals as any).ipAddress || getClientAddress(),
                prisma: locals.prisma
            });

            // Return success response - let the form handler handle the redirect
            return { 
                form,
                success: true,
                message: 'Device profile created successfully'
            };

        } catch (error) {
            return fail(500, { 
                form: {
                    ...form,
                    data: {
                        name: form.data.name,
                        description: form.data.description,
                        settings: form.data.settings
                    }
                },
                message: 'Failed to create device profile' 
            });
        }
    }
};
