/**
 * Route Parameter Matcher for Role-Based Routes
 * 
 * This matcher allows routes like /[role=role]/iot/devices
 * to match both /admin/iot/devices and /user/iot/devices
 * 
 * @see docs/local/PHASE3_UNIFIED_ROUTE_EXAMPLE.md
 */

import type { ParamMatcher } from '@sveltejs/kit';

export const match: ParamMatcher = (param) => {
	return param === 'admin' || param === 'user';
};

