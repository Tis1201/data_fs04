import { error, fail } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getEnhancedPrisma } from '$lib/server/prisma';
import { superValidate } from 'sveltekit-superforms/server';
import { userSchema } from '$lib/schemas/user';
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
                email: user.email,
                name: user.name || "",
                role: user.systemRole,
                status: user.status || "ACTIVE"
            }, 
            zod(userSchema)
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

export const actions = {
    /**
     * Update user data
     */
    save: restrict(
        async ({ request, params, locals }) => {
            const id = params.id;
            const form = await superValidate(request, zod(userSchema));
            logger.debug('Update user form data:', form);

            if (!form.valid) {
                return fail(400, { form });
            }

            
            try {
                // Update user data
                const userData = {
                    email: form.data.email,
                    name: form.data.name || "",
                    systemRole: form.data.role,
                    status: form.data.status,
                    rolesString: form.data.role.toLowerCase()
                };

                // Update existing user
                await locals.prisma.user.update({
                    where: { id },
                    data: userData
                });
                logger.info('User updated successfully:', { userId: id });

                return {
                    form,
                    success: true
                };

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
