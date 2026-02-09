import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/**
 * Redirect legacy edit/[id] URL to detail page [id].
 * Detail is at /user/iot/pin-rules/[id], edit form at /user/iot/pin-rules/[id]/edit.
 */
export const load: PageServerLoad = async ({ params }) => {
    const { id } = params;
    if (!id) {
        throw redirect(302, '/user/iot/pin-rules');
    }
    throw redirect(302, `/user/iot/pin-rules/${id}`);
};
