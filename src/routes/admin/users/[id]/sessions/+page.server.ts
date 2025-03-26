import type { PageServerLoad } from './$types';
import { restrict } from '$lib/server/security/guards';
import { error } from '@sveltejs/kit';

export const load = restrict(
    async ({ params, locals }) => {
        const userId = params.id;
        
        // Get user data
        const user = await locals.prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                email: true,
                systemRole: true
            }
        });

        if (!user) {
            throw error(404, 'User not found');
        }

        return {
            user
        };
    },
    ['ADMIN']
) satisfies PageServerLoad;
