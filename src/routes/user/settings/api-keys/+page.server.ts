import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/** Canonical route is `/user/developers/api-keys`. */
export const load: PageServerLoad = async ({ url }) => {
	throw redirect(301, `/user/developers/api-keys${url.search}`);
};
