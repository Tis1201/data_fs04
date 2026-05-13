import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
    // Server-side redirect to the dashboard
    throw redirect(302, '/user/dashboard');
};
