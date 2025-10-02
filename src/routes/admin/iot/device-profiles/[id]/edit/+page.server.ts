import { mapToConfigPayload } from '$lib/utils/mappers/deviceProfileMapper';
import type { PageServerLoad, Actions } from './$types';
import { fail, redirect, error } from '@sveltejs/kit';
import { superValidate } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';
import { z } from 'zod';

// Define the form schema (settings handled as string, converted later)
const profileSchema = z.object({
    name: z.string().min(1, 'Profile name is required').max(100, 'Profile name must be less than 100 characters'),
    description: z.string().max(500, 'Description must be less than 500 characters').optional(),
    settings: z.string().optional().default('[]') // Store as JSON string
});

export const load: PageServerLoad = async ({ params, url, locals }) => {
    // Check authentication
    const auth = await locals.auth.validate();
    if (!auth?.user) {
        throw redirect(302, '/auth/login');
    }

    const { id: profileId } = params;

    // Get profile details
    const profile = await locals.prisma.deviceProfile.findUnique({
        where: { id: profileId },
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

    // Check if user has access to this profile
    const hasAccess = await locals.prisma.accountMembership.findFirst({
        where: {
            accountId: profile.accountId,
            userId: auth.user.id
        }
    });


    if (!hasAccess && auth.user.systemRole !== 'ADMIN') {
        throw error(403, 'Access denied');
    }

    // Initialize form with existing profile data
    const form = await superValidate(zod(profileSchema), {
        defaults: {
            name: profile.name,
            description: profile.description || '',
            settings: JSON.stringify(profile.settings || [])
        }
    });

    return {
        form,
        profile
    };
};

export const actions: Actions = {
    update: async ({ params, request, locals, url, fetch }) => {
        // Check authentication
        const auth = await locals.auth.validate();
        if (!auth?.user) {
            return fail(401, { message: 'Unauthorized' });
        }

        const { id: profileId } = params;

        // Validate form
        const form = await superValidate(request, zod(profileSchema));
        
        if (!form.valid) {
            return fail(400, { form });
        }

        try {
            // Parse settings from JSON string
            let settingsArray = [];
            try {
                settingsArray = JSON.parse(form.data.settings || '[]');
            } catch (e) {
                console.error('Error parsing settings JSON:', e);
                settingsArray = [];
            }

            // First, delete all existing settings for this profile
            await locals.prisma.deviceProfileSetting.deleteMany({
                where: { profileId: profileId }
            });

            // Then update the profile and create new settings
            const updatedProfile = await locals.prisma.deviceProfile.update({
                where: { id: profileId },
                data: {
                    name: form.data.name,
                    description: form.data.description,
                    updatedBy: auth.user.id,
                    settings: {
                        create: settingsArray.map((setting: any, index: number) => ({
                            key: setting.key,
                            value: String(setting.value || ''),
                            dataType: setting.dataType,
                            label: setting.label,
                            category: setting.category || 'General',
                            order: setting.order !== undefined ? setting.order : index
                        }))
                    }
                }
            });

            const deviceProfile = await locals.prisma.deviceProfile.findUnique({
                where: { id: profileId },
                select: {
                    id: true,
                    name: true,
                    settings: {
                        select: {
                            id: true,
                            key: true,
                            value: true,
                            dataType: true,
                            category: true
                        }
                    },
                    assignments: {
                        select: {
                            id: true
                        }
                    }
                }
            });

            if (deviceProfile?.assignments && deviceProfile.assignments.length > 0) {
                const config = mapToConfigPayload(deviceProfile as any);

                try {
                    const response = await fetch(`/api/device-profiles/${profileId}/broadcast-config`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            config
                        })
                    });

                    if (!response.ok) {
                        const data = await response.json();
                        console.error('Error broadcasting device profile settings: ', data);
                    }
                } catch (err) {
                    console.error('Error broadcasting device profile settings: ', err);
                }
            }

            return { form, success: true, message: 'Device profile updated successfully' };

        } catch (error) {
            console.error('Error updating device profile:', error);
            if (error instanceof Error && 'status' in error) {
                throw error;
            }
            return fail(500, { 
                form,
                message: 'Failed to update device profile' 
            });
        }
    }
};
