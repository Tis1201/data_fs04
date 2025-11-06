import type { PageServerLoad } from './$types';
import { restrict } from '$lib/server/security/guards';
import { SystemRole } from '$lib/types/roles';
import { env } from '$env/dynamic/private';

const SUPERSET_URL = env.SUPERSET_BASE_URL ?? 'https://superset-dev.datarealities.com';
// const SUPERSET_URL = "http://localhost:8088";
// 
const DASHBOARD_ID = env.SUPERSET_DASHBOARD_ID ?? '8b01e0b9-578d-4d41-a1ab-3501427aa985';

export const load = restrict(
	async () => {
		return {
			guestToken: null,
			iframeUrl: null,
			supersetUrl: SUPERSET_URL,
			dashboardId: DASHBOARD_ID
		};
	},
	[SystemRole.ADMIN]
) satisfies PageServerLoad;
