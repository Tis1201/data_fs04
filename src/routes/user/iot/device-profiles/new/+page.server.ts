import type { PageServerLoad, Actions } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import { superValidate } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';
import { z } from 'zod';

// Define the form schema (settings handled as string, converted later)
const profileSchema = z.object({
    name: z.string().min(1, 'Profile name is required').max(100, 'Profile name must be less than 100 characters'),
    description: z.string().max(500, 'Description must be less than 500 characters').optional(),
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
            settings: JSON.stringify(defaultSettings)
        }
    });

    // Debug logging
    console.log('Server form initialization:');
    console.log('- Form data:', form.data);
    console.log('- Form valid:', form.valid);
    console.log('- Form errors:', form.errors);
    console.log('- Form posted:', form.posted);

    return {
        form
    };
};

export const actions: Actions = {
    create: async ({ request, locals }) => {
        // Check authentication
        const auth = await locals.auth.validate();
        if (!auth?.user) {
            return fail(401, { message: 'Unauthorized' });
        }
        
        console.log('User info:', { 
            id: auth.user.id, 
            email: auth.user.email, 
            systemRole: auth.user.systemRole 
        });

        // Validate form with standard data type
        const form = await superValidate(request, zod(profileSchema));
        
        // Debug logging
        console.log('Server received form data:', form.data);
        console.log('Form valid:', form.valid);
        console.log('Form errors:', form.errors);
        
        if (!form.valid) {
            return fail(400, { form });
        }

        // Check user's account access and role
        let userAccountMembership;
        
        if (auth.user.systemRole === 'ADMIN') {
            console.log('User is system admin, has full access');
            // For system admin, we need to get any account they have access to
            userAccountMembership = await locals.prisma.accountMembership.findFirst({
                where: { userId: auth.user.id },
                select: { accountId: true, role: true }
            });
            
            if (!userAccountMembership) {
                return fail(403, { 
                    form,
                    message: 'No account access found. Please contact your administrator.' 
                });
            }
        } else {
            // Regular user - need OWNER or ADMIN role in account
            const allUserMemberships = await locals.prisma.accountMembership.findMany({
                where: { userId: auth.user.id },
                select: { accountId: true, role: true }
            });
            
            console.log('User account memberships:', allUserMemberships);
            
            userAccountMembership = await locals.prisma.accountMembership.findFirst({
                where: { 
                    userId: auth.user.id,
                    role: { in: ['OWNER', 'ADMIN', 'MEMBER'] }
                },
                select: { accountId: true, role: true }
            });

            if (!userAccountMembership) {
                console.log('User does not have OWNER, ADMIN, or MEMBER role in any account');
                return fail(403, { 
                    form,
                    message: 'Access denied. You need OWNER, ADMIN, or MEMBER role in an account to create device profiles. Your current role(s): ' + 
                             (allUserMemberships.map(m => m.role).join(', ') || 'None')
                });
            }
            
            console.log('User has access with role:', userAccountMembership.role);
        }

        // Parse settings from form data
        let settings = [];
        try {
            settings = JSON.parse(form.data.settings || '[]');
        } catch (e) {
            console.error('Error parsing settings JSON:', e);
            settings = [];
        }

        try {
            // Create device profile with settings
            const profile = await locals.prisma.deviceProfile.create({
                data: {
                    name: form.data.name,
                    description: form.data.description,
                    accountId: userAccountMembership.accountId,
                    createdBy: auth.user.id,
                    settings: {
                        create: settings.map((setting, index) => ({
                            key: setting.key,
                            value: setting.value,
                            dataType: setting.dataType,
                            label: setting.label,
                            category: setting.category,
                            order: setting.order || index
                        }))
                    }
                }
            });

            // Return success response - let the form handler handle the redirect
            return { 
                form,
                success: true,
                message: 'Device profile created successfully'
            };

        } catch (error) {
            console.error('Error creating device profile:', error);
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
