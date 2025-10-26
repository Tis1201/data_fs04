import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
    // Check if user is authenticated
    if (locals.user) {
        // User is logged in, redirect based on their role
        const userRole = locals.user.systemRole;
        
        if (userRole === 'ADMIN' || userRole === 'SUPER_ADMIN') {
            // Admin users go to admin dashboard
            throw redirect(302, '/admin/dashboard');
        } else {
            // Regular users go to user dashboard
            throw redirect(302, '/user/dashboard');
        }
    }
    
    // User is not authenticated, redirect to login
    throw redirect(302, '/auth/login');
};
