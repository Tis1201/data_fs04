import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
    // Validate session and get user directly from auth
    const session = await locals.auth.validate();
    if (!session?.user) {
        throw redirect(302, '/auth/login');
    }

    // Check if user has admin role
    const user = session.user;
    if (!user.systemRole || user.systemRole !== 'ADMIN') {
        throw redirect(302, '/');
    }

    return {
        user: {
            id: user.id,
            email: user.email,
            role: user.systemRole,
            systemRole: user.systemRole
        }
    };
};
