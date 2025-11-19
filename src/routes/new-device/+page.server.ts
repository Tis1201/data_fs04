import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
    // Check if user is already authenticated
    const redirectTo = '/user/iot/devices/new';
    
    // Redirect to login with redirectTo parameter
    throw redirect(302, `/auth/login?redirectTo=${encodeURIComponent(redirectTo)}`);
};

