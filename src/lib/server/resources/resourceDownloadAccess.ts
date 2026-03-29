import { error } from '@sveltejs/kit';
import {
	canAccessResourceFields,
	getResourceAccessLevelFields,
	normalizeResourceAccessInput
} from '$lib/server/api/unifiedEndpoint';
import type { SystemRole } from '$lib/server/features/flags';

export function requireResourceBinaryDownloadAccess(
	locals: {
		user: { id: string; systemRole: string };
		currentAccount?: { account?: { id: string } } | null;
	},
	resource: Record<string, unknown>
): void {
	if (!locals.user) {
		throw error(401, 'Authentication required');
	}
	if (locals.user.systemRole === 'ADMIN') {
		return;
	}

	const accessInput = normalizeResourceAccessInput(resource);
	const params = {
		systemRole: locals.user.systemRole as SystemRole,
		userId: locals.user.id,
		accountId: locals.currentAccount?.account?.id
	};

	if (!canAccessResourceFields(params, accessInput)) {
		throw error(403, 'You do not have permission to access this resource');
	}

	const level = getResourceAccessLevelFields(params, accessInput);
	if (level === 'shared_read') {
		throw error(403, 'Download is not available for resources shared to your account');
	}
}
