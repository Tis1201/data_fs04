import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { getEnhancedPrisma } from '$lib/server/prisma';

export const load: LayoutServerLoad = async ({ locals }) => {
    // First validate the session
    const session = await locals.auth.validate();
    if (!session?.user) {
        throw redirect(302, '/auth/login');
    }

    // Get user data first
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

    // Check if user is admin
    if (!user.rolesString.includes('admin')) {
        throw redirect(302, '/');
    }

    // Now use enhanced prisma with full user context
    const prisma = getEnhancedPrisma({
        id: user.id,
        rolesString: user.rolesString
    });

    return {
        user
    };
};
