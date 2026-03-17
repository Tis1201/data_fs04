import { mapToConfigPayload } from '$lib/utils/mappers/deviceProfileMapper';
import type { PageServerLoad, Actions } from './$types';
import { fail, redirect, error } from '@sveltejs/kit';
import { superValidate, message } from 'sveltekit-superforms';
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

export const actions: Actions = {
    update: async ({ params, request, locals, url, fetch, getClientAddress }) => {
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
            // Get existing profile for audit log
            const existingProfile = await locals.prisma.deviceProfile.findUnique({
                where: { id: profileId }
            });

            if (!existingProfile) {
                return fail(404, { form, error: 'Device profile not found' });
            }

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

            // Log audit for device profile update
            await logAudit({
                actionType: AuditActionType.UPDATE,
                tableName: 'DeviceProfile',
                recordId: profileId,
                oldData: existingProfile,
                newData: updatedProfile,
                userId: auth.user.id,
                ipAddress: (locals as any).ipAddress || getClientAddress(),
                prisma: locals.prisma
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

            // TC-RDM-PR-0137: Only broadcast config when profile is active.
            // When profile becomes inactive, retain previous configuration (don't push anything).
            if (updatedProfile.isActive && deviceProfile?.assignments && deviceProfile.assignments.length > 0) {
                const config = mapToConfigPayload(deviceProfile as any);

                try {
                    const response = await fetch(`/api/v2/device-profiles/${profileId}/broadcast-config`, {
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

            // Auto-reapply to all assigned devices after profile update (only if profile is active)
            try {
                // Only auto-reapply if the profile is active
                if (!updatedProfile.isActive) {
                    console.log('[AdminProfileEdit] Profile is inactive, skipping auto-reapply');
                } else {
                    // Get all devices assigned to this profile
                    const assignedDevices = await locals.prisma.device.findMany({
                        where: {
                            profileAssignment: {
                                profileId: profileId
                            },
                            status: 'ACTIVE'
                        },
                        select: { id: true, name: true }
                    });

                    if (assignedDevices.length > 0) {
                    // Update DeviceProfileAssignment records to APPLYING status
                    await locals.prisma.deviceProfileAssignment.updateMany({
                        where: {
                            deviceId: { in: assignedDevices.map(d => d.id) },
                            profileId: profileId
                        },
                        data: {
                            status: 'APPLYING',
                            lastSyncAt: new Date()
                        }
                    });

                    // Send reapply messages to each device
                    for (const device of assignedDevices) {
                        try {
                            // Call the device assignment endpoint to send the reapply message
                            await fetch(`/api/v2/device-profiles/${profileId}/assign`, {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                },
                                body: JSON.stringify({
                                    deviceIds: [device.id]
                                })
                            });
                        } catch (error) {
                            console.error(`Failed to send auto-reapply message to device ${device.id}: ${String(error)}`);
                        }
                    }

                    // Send real-time notification to UI about auto-reapply
                    try {
                        // Import messaging components for UI notification
                        const { publisher } = await import('$lib/server/messaging/core/publisher');
                        const { MessageFactory } = await import('$lib/server/messaging/interfaces/message');
                        const { SystemUser } = await import('$lib/server/messaging/interfaces/message');

                        // Send UI notification to profile scope
                        const uiNotification = MessageFactory.createSystemMessage(
                            'device:profileUpdate',
                            `subscription:profile:${profileId}`,
                            {
                                action: 'applyProfile',
                                profileId: profileId,
                                message: `Profile updated - reapplying to ${assignedDevices.length} devices`,
                                sentAt: new Date().toISOString(),
                                autoReapply: true,
                                deviceCount: assignedDevices.length,
                                deviceIds: assignedDevices.map(d => d.id)
                            },
                            SystemUser,
                            { echoToSender: false }
                        );

                        await publisher.publish(uiNotification);
                    } catch (uiError) {
                        console.error(`Failed to send auto-reapply UI notification: ${String(uiError)}`);
                    }
                }
                }
            } catch (autoReapplyError) {
                console.error(`Error during auto-reapply: ${String(autoReapplyError)}`);
                // Don't fail the profile update if auto-reapply fails
            }

            // Update form with fresh data from the database to reflect saved state
            form.data.name = updatedProfile.name;
            form.data.description = updatedProfile.description || '';
            form.data.isActive = String(updatedProfile.isActive);

            return message(form, { success: true, text: 'Device profile updated successfully' });

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
