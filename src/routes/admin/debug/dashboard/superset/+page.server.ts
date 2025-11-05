import type { PageServerLoad } from './$types';
import { restrict } from '$lib/server/security/guards';
import { SystemRole } from '$lib/types/roles';
import { env } from '$env/dynamic/private';

const SUPERSET_URL = env.SUPERSET_BASE_URL ?? 'https://superset-dev.datarealities.com';
const DASHBOARD_ID = env.SUPERSET_DASHBOARD_ID ?? 'ffccb079-3b83-449e-abdc-a9f0caef0f8f';

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
