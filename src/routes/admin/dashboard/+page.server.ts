import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
    const session = await locals.auth.validate();
    if (!session?.user) {
        throw redirect(302, '/auth/login');
    }

    // Get user data
    const user = await locals.prisma.user.findUnique({
        where: { id: session.user.id },
        select: {
            id: true,
            email: true,
            rolesString: true,
            systemRole: true
        }
    });

    if (!user) {
        throw redirect(302, '/auth/login');
    }

    if (!user.rolesString.includes('admin')) {
        throw redirect(302, '/');
    }

    return {
        user
    };
};
