import { redirect } from '@sveltejs/kit';
import { restrict } from '$lib/server/security/guards';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = restrict(
    async ({ locals, auth }) => {
        // Check if user has admin access
        if (auth.user.systemRole !== 'ADMIN') {
            throw redirect(302, '/dashboard');
        }

        return {
            user: auth.user
        };
    },
    ['ADMIN'] // Restrict to admin users only
);
