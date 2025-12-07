import { fail } from '@sveltejs/kit';
import { logger } from '$lib/server/logger';
import { superValidate } from 'sveltekit-superforms/server';
import { zod } from 'sveltekit-superforms/adapters';
import type { z } from 'zod';

/**
 * Create device profile actions factory
 * Per structural standard: create{Resource}Actions pattern
 */
export function createDeviceProfileActions(
    profileSchema: z.ZodTypeAny,
    options?: {
        checkOwnership?: boolean;
        enableCreate?: boolean;
        enableUpdate?: boolean;
    }
): {
    create?: (args: { request: Request; locals: any }) => Promise<any>;
    update?: (args: { params: { id: string }; request: Request; locals: any; url?: URL; fetch?: typeof fetch }) => Promise<any>;
} {
    const actions: any = {};

    if (options?.enableCreate) {
        actions.create = async ({ request, locals }: { request: Request; locals: any }) => {
            const form = await superValidate(request, zod(profileSchema));
            
            if (!form.valid) {
                return fail(400, { form });
            }

            try {
                const auth = await locals.auth.validate();
                if (!auth?.user) {
                    return fail(401, { message: 'Unauthorized' });
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
                    settings = [];
                }

                // Create device profile with settings
                const profile = await locals.prisma.deviceProfile.create({
                    data: {
                        name: form.data.name,
                        description: form.data.description,
                        isActive: form.data.isActive === 'true', // Convert string to boolean
                        accountId: userAccountMembership.accountId,
                        createdBy: auth.user.id,
                        level: 'GLOBAL', // Always create as GLOBAL profile
                        settings: {
                            create: settings.map((setting: any, index: number) => ({
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

                return { 
                    form,
                    success: true,
                    message: 'Device profile created successfully'
                };
            } catch (e: any) {
                logger.error(`Error creating device profile: ${e?.message || String(e)}`);
                return fail(500, { 
                    form,
                    message: 'Failed to create device profile' 
                });
            }
        };
    }

    if (options?.enableUpdate) {
        actions.update = async ({ 
            params, 
            request, 
            locals,
            url,
            fetch: fetchFn
        }: { 
            params: { id: string }; 
            request: Request; 
            locals: any;
            url?: URL;
            fetch?: typeof fetch;
        }) => {
            const form = await superValidate(request, zod(profileSchema));
            
            if (!form.valid) {
                return fail(400, { form });
            }

            try {
                const auth = await locals.auth.validate();
                if (!auth?.user) {
                    return fail(401, { message: 'Unauthorized' });
                }

                const { id: profileId } = params;

                // Check ownership if needed
                if (options?.checkOwnership) {
                    const profile = await locals.prisma.deviceProfile.findUnique({
                        where: { id: profileId },
                        select: { accountId: true }
                    });

                    if (!profile) {
                        return fail(404, { form, message: 'Profile not found' });
                    }

                    const hasAccess = await locals.prisma.accountMembership.findFirst({
                        where: {
                            accountId: profile.accountId,
                            userId: auth.user.id
                        }
                    });

                    if (!hasAccess) {
                        return fail(403, { form, message: 'Access denied' });
                    }
                }

                // Parse settings from JSON string
                let settingsArray = [];
                try {
                    settingsArray = JSON.parse(form.data.settings || '[]');
                } catch (e) {
                    logger.warn(`Error parsing settings JSON: ${e}`);
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
                        isActive: form.data.isActive === 'true', // Convert string to boolean
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

                // Broadcast config if profile is active and has assignments (optional)
                if (fetchFn && url && updatedProfile.isActive) {
                    try {
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
                            // Import mapToConfigPayload if needed
                            const { mapToConfigPayload } = await import('$lib/utils/deviceProfileUtils');
                            const config = mapToConfigPayload(deviceProfile as any);

                            const response = await fetchFn(`${url.origin}/api/device-profiles/${profileId}/broadcast-config`, {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                },
                                body: JSON.stringify({ config })
                            });

                            if (!response.ok) {
                                const data = await response.json();
                                logger.warn(`Error broadcasting device profile settings: ${data}`);
                            }
                        }
                    } catch (err) {
                        logger.warn(`Error broadcasting device profile settings: ${err}`);
                    }
                }

                return {
                    form,
                    success: true,
                    message: 'Device profile updated successfully'
                };
            } catch (e: any) {
                logger.error(`Error updating device profile: ${e?.message || String(e)}`);
                return fail(500, { 
                    form,
                    message: 'Failed to update device profile' 
                });
            }
        };
    }

    return actions;
}

