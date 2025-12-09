/**
 * Unified Resource Detail API (v2)
 * 
 * This endpoint replaces:
 * - /api/admin/iot/resources/[id]
 * - /api/user/resources/[id]
 * - /api/resources/[id] (shared endpoint)
 * 
 * Works for both admin and user roles with appropriate permission checks.
 */

import { createCrudHandlers, requireResourceAccess } from '$lib/server/api/unifiedEndpoint';
import prisma from '$lib/server/prisma';

/**
 * CRUD handlers for resources
 */
export const { GET, PUT, DELETE } = createCrudHandlers({
	resourceName: 'Resource',
	permissions: {
		read: 'resource.view',
		create: 'resource.edit',
		update: 'resource.edit',
		delete: 'resource.delete'
	},
	handlers: {
		get: async (id, context) => {
			const resource = await prisma.resource.findUnique({
				where: { id },
				include: {
					account: true
				}
			});

			// Check access (admin can see all, user can only see their account's resources)
			if (resource) {
				requireResourceAccess(context, {
					accountId: resource.accountId || undefined,
					createdBy: resource.createdBy
				});
			}

			return resource;
		},

		create: async (data, context) => {
			// This is handled by create-cloud endpoint or file upload
			throw new Error('Use POST /api/v2/resources/create-cloud to create');
		},

		update: async (id, data, context) => {
			const updates: any = {
				name: data.name,
				description: data.description,
				updatedAt: new Date(),
				updatedBy: context.session.user.id
			};

			// Only admin can change account ownership
			if (data.accountId && context.session.user.systemRole === 'ADMIN') {
				updates.accountId = data.accountId;
			}

			return await prisma.resource.update({
				where: { id },
				data: updates,
				include: {
					account: true
				}
			});
		},

		delete: async (id, context) => {
			// Check if resource is in use
			const bundleCount = await prisma.bundleApp.count({
				where: { resourceId: id }
			});

			if (bundleCount > 0) {
				throw Object.assign(
					new Error(`Cannot delete resource that is used in ${bundleCount} bundles`),
					{ status: 409, code: 'CONFLICT' }
				);
			}

			await prisma.resource.delete({
				where: { id }
			});
		}
	}
});

