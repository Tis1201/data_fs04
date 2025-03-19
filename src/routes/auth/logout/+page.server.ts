import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { lucia } from '$lib/server/auth/lucia';

export const load: PageServerLoad = async ({ locals, cookies }) => {
    // Get the current session
    const session = await locals.auth.validate();
    if (session) {
        // Delete the session cookie
        const sessionCookie = lucia.createBlankSessionCookie();
        cookies.set(sessionCookie.name, sessionCookie.value, {
            path: ".",
            ...sessionCookie.attributes
        });
    }

    throw redirect(302, '/auth/login');
};
