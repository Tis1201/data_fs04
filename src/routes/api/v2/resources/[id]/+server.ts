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

import {
	createCrudHandlers,
	getResourceAccessLevel,
	normalizeResourceAccessInput,
	type UnifiedContext
} from '$lib/server/api/unifiedEndpoint';
import prisma from '$lib/server/prisma';

function mapResourceGetResponse(resource: Record<string, unknown>, context: UnifiedContext) {
	const input = normalizeResourceAccessInput(resource);
	const level = getResourceAccessLevel(context, input);

	const { sharedWithAccounts, path, ...rest } = resource;
	const out: Record<string, unknown> = { ...rest, access: level };
	if (level === 'shared_read') {
		delete out.path;
	}
	return out;
}

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
	mapGetResponse: (resource, context) => mapResourceGetResponse(resource as Record<string, unknown>, context),
	handlers: {
		get: async (id, context) => {
			const resource = await prisma.resource.findUnique({
				where: { id },
				include: {
					account: true,
					sharedWithAccounts: { select: { accountId: true } }
				}
			});

			return resource;
		},

		create: async (_data, _context) => {
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
					account: true,
					sharedWithAccounts: { select: { accountId: true } }
				}
			});
		},

		delete: async (id, _context) => {
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
