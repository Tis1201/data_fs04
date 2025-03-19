import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';

export const load = (async ({ locals }) => {
    // Check authentication
    const auth = await locals.auth.validate();
    
    // If not authenticated, redirect to login
    if (!auth) {
        throw redirect(302, '/login?redirectTo=/admin/debug/stream');
    }
    
    // If authenticated but not admin, redirect to home
    // if (auth.user.role !== 'ADMIN') {
    //     throw redirect(302, '/');
    // }
    
    return {
        user: auth.user
    };
}) satisfies PageServerLoad;
