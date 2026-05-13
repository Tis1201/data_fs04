import { redirect } from '@sveltejs/kit';
import { restrict, type AuthenticatedLoadEvent } from '$lib/server/security/guards';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = restrict(
    async (event: AuthenticatedLoadEvent) => {
        const { locals, auth } = event;
        
        // Check if user is authenticated
        if (!auth) {
            throw redirect(302, '/dashboard');
        }
        
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
