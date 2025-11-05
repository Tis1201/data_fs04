import type { PageServerLoad } from './$types';
import { restrict } from '$lib/server/security/guards';
import { SystemRole } from '$lib/types/roles';

export const load = restrict(
	async () => {
		return {
			guestToken: null,
			iframeUrl: null
		};
	},
	[SystemRole.ADMIN]
) satisfies PageServerLoad;
