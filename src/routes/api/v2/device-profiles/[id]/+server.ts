/**
 * Unified Device Profile Detail API (v2)
 * 
 * This endpoint replaces:
 * - /api/admin/iot/device-profiles/[id]
 * - /api/user/iot/device-profiles/[id]
 * 
 * Works for both admin and user roles with appropriate permission checks.
 */

import { createCrudHandlers } from '$lib/server/api/unifiedEndpoint';
import prisma from '$lib/server/prisma';

/**
 * CRUD handlers for device profiles
 */
export const { GET, PUT, DELETE } = createCrudHandlers({
	resourceName: 'Device Profile',
	permissions: {
		read: 'deviceProfile.view',
		create: 'deviceProfile.edit',
		update: 'deviceProfile.edit',
		delete: 'deviceProfile.delete'
	},
	handlers: {
		get: async (id, context) => {
			return await prisma.deviceProfile.findUnique({
				where: { id },
				include: {
					account: true,
					deviceProfileAssignments: {
						include: {
							device: {
								select: {
									id: true,
									name: true,
									serialNumber: true,
									online: true
								}
							}
						}
					},
					_count: {
						select: {
							deviceProfileAssignments: true
						}
					}
				}
			});
		},

		create: async (data, context) => {
			// This is handled by POST in parent route
			throw new Error('Use POST /api/v2/device-profiles to create');
		},

		update: async (id, data, context) => {
			return await prisma.deviceProfile.update({
				where: { id },
				data: {
					name: data.name,
					description: data.description,
					configuration: data.configuration,
					updatedAt: new Date()
				},
				include: {
					account: true,
					_count: {
						select: {
							deviceProfileAssignments: true
						}
					}
				}
			});
		},

		delete: async (id, context) => {
			// Check if profile has assignments
			const assignmentCount = await prisma.deviceProfileAssignment.count({
				where: { deviceProfileId: id }
			});

			if (assignmentCount > 0) {
				throw Object.assign(
					new Error(`Cannot delete profile with ${assignmentCount} active assignments`),
					{ status: 409, code: 'CONFLICT' }
				);
			}

			await prisma.deviceProfile.delete({
				where: { id }
			});
		}
	}
});

