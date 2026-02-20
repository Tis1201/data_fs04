import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals, cookies }) => {
	const deviceId = params.id;

	if (!deviceId) {
		throw error(404, 'Device not found');
	}

	// Get current account ID
	const currentAccountId =
		(locals as { currentAccount?: { account?: { id: string } } }).currentAccount?.account?.id ??
		cookies.get('current_account_id');

	if (!currentAccountId) {
		throw error(403, 'No account selected');
	}

	// Fetch device information and verify it belongs to current account
	const device = await locals.prisma.device.findFirst({
		where: { 
			id: deviceId,
			accountId: currentAccountId
		},
		select: {
			id: true,
			name: true,
			status: true,
		}
	});

	if (!device) {
		throw error(404, 'Device not found');
	}

	return {
		device
	};
};
