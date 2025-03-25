import { error, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { getEnhancedPrisma } from '$lib/server/prisma';
import { superValidate } from 'sveltekit-superforms/server';
import { userEditSchema } from './schema';
import { zod } from 'sveltekit-superforms/adapters';
import { logger } from '$lib/server/logger';
import { restrict } from '$lib/server/security/guards';

export const load: PageServerLoad = async ({ params, locals }) => {
    const auth = await locals.auth.validate();
    if (!auth?.user || auth.user.systemRole !== 'ADMIN') {
        throw error(403, 'Not authorized to view or edit users');
    }
    
    try {
        // Load existing user
        const user = await locals.prisma.user.findUnique({
            where: { id: params.id },
            select: {
                id: true,
                email: true,
                name: true,
                systemRole: true,
                status: true,
                rolesString: true,
                createdAt: true,
                updatedAt: true
            }
        });

        if (!user) {
            throw error(404, "User not found");
        }

        const form = await superValidate(
            {
                id: user.id,
                email: user.email,
                name: user.name || "",
                systemRole: user.systemRole,
                status: user.status || "ACTIVE",
                rolesString: user.rolesString || ""
            }, 
            zod(userEditSchema)
        );

        return {
            form,
            user
        };
    } catch (e) {
        logger.error('Error loading user:', e);
        throw error(500, 'Failed to load user');
    }
};

export const actions: Actions = {
    /**
     * Update user data
     */
    save: restrict(
        async ({ request, params, locals }) => {
            const id = params.id;
            const form = await superValidate(request, zod(userEditSchema));
            logger.debug('Update user form data:', form);

            if (!form.valid) {
                return fail(400, { form });
            }

            try {
                // Start a transaction to ensure data consistency
                return await locals.prisma.$transaction(async (tx) => {
                    // First check if user exists
                    const existingUser = await tx.user.findUnique({
                        where: { id }
                    });
                    
                    if (!existingUser) {
                        return fail(404, {
                            form,
                            error: 'User not found'
                        });
                    }
                    
                    // Prepare update data
                    const updateData: Record<string, any> = {
                        email: form.data.email,
                        name: form.data.name || null,
                        systemRole: form.data.systemRole,
                        status: form.data.status,
                        rolesString: form.data.rolesString
                    };
                    
                    // Only update password if provided
                    if (form.data.password) {
                        // In a real app, you would hash the password here
                        updateData.password = form.data.password;
                    }
                    
                    // Update user
                    await tx.user.update({
                        where: { id },
                        data: updateData
                    });
                    
                    logger.info('User updated successfully:', { userId: id });
                    
                    return {
                        form,
                        success: true
                    };
                });
            } catch (e) {
                logger.error('Error updating user:', e);
                return fail(500, {
                    form,
                    error: 'Failed to update user'
                });
            }
        },
        ['admin'] // Only allow admin role to update users
    ),

    
};
