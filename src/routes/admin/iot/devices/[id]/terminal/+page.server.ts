import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	const deviceId = params.id;

	if (!deviceId) {
		throw error(404, 'Device not found');
	}

	// Fetch device information to verify it exists
	const device = await locals.prisma.device.findUnique({
		where: { id: deviceId },
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
