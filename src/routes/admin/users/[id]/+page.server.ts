import { error, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { getEnhancedPrisma } from '$lib/server/prisma';
import { superValidate } from 'sveltekit-superforms/server';
import { userSchema } from '$lib/schemas/user';
import { zod } from 'sveltekit-superforms/adapters';
import { logger } from '$lib/server/logger';

export const load: PageServerLoad = async ({ params, parent }) => {
    const parentData = await parent();
    if (!parentData?.user) {
        throw error(401, "Unauthorized");
    }

    try {
        const prisma = getEnhancedPrisma({
            id: parentData.user.id,
            rolesString: parentData.user.rolesString,
            systemRole: parentData.user.systemRole
        });

        const user = await prisma.user.findUnique({
            where: { id: params.id },
            select: {
                id: true,
                email: true,
                systemRole: true,
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
                role: user.systemRole
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

export const actions: Actions = {
    default: async ({ request, params, parent }) => {
        const parentData = await parent();
        if (!parentData?.user) {
            throw error(401, "Unauthorized");
        }

        const form = await superValidate(request, zod(userSchema));
        logger.debug('Update user form data:', form);

        if (!form.valid) {
            return fail(400, { form });
        }

        try {
            const prisma = getEnhancedPrisma({
                id: parentData.user.id,
                rolesString: parentData.user.rolesString
            });

            const user = await prisma.user.update({
                where: { id: params.id },
                data: {
                    email: form.data.email,
                    systemRole: form.data.role,
                    rolesString: form.data.role.toLowerCase()
                }
            });

            logger.info('User updated successfully:', { userId: user.id });
            return {
                form,
                success: true
            };

        } catch (e) {
            logger.error('Error updating user:', e);
            return fail(500, {
                form,
                message: 'Failed to update user'
            });
        }
    }
};
