/**
 * Unified Bundle Apps API (v2)
 * 
 * This endpoint replaces:
 * - /api/admin/iot/bundles/[id]/apps
 * - /api/user/iot/bundles/[id]/apps
 * 
 * Manages apps assigned to a bundle.
 */

import { unifiedEndpoint, requireResourceAccess } from '$lib/server/api/unifiedEndpoint';
import { successResponse, errorResponse, ErrorCodes } from '$lib/types/api';
import prisma from '$lib/server/prisma';

/**
 * GET /api/v2/bundles/[id]/apps
 * List apps assigned to bundle
 */
export const GET = unifiedEndpoint(
	async ({ context, params }) => {
		const bundleId = params.id;
		
		// Check bundle access
		const bundle = await prisma.bundle.findUnique({
			where: { id: bundleId },
			select: { id: true, accountId: true, createdBy: true }
		});
		
		if (!bundle) {
			throw Object.assign(
				new Error('Bundle not found'),
				{ status: 404, code: ErrorCodes.NOT_FOUND }
			);
		}
		
		requireResourceAccess(context, {
			accountId: bundle.accountId ?? undefined,
			createdBy: bundle.createdBy
		});
		
		// Get bundle apps with resource info
		const bundleApps = await prisma.bundleApp.findMany({
			where: { bundleId },
			include: {
				resource: {
					select: {
						id: true,
						name: true,
						packageName: true,
						version: true,
						type: true,
						format: true,
						size: true,
						path: true
					}
				}
			},
			orderBy: { order: 'asc' }
		});
		
		return successResponse(
			bundleApps,
			{ requestId: context.requestId }
		);
	},
	{ permission: 'bundle.view' }
);

/**
 * POST /api/v2/bundles/[id]/apps
 * Add app to bundle
 */
export const POST = unifiedEndpoint(
	async ({ context, params, event }) => {
		const bundleId = params.id;
		const data = await event.request.json();
		const { resourceId, order } = data;
		
		if (!resourceId) {
			throw Object.assign(
				new Error('resourceId is required'),
				{ status: 400, code: ErrorCodes.INVALID_INPUT }
			);
		}
		
		// Check bundle access
		const bundle = await prisma.bundle.findUnique({
			where: { id: bundleId },
			select: {
				id: true,
				accountId: true,
				createdBy: true,
				status: true
			}
		});
		
		if (!bundle) {
			throw Object.assign(
				new Error('Bundle not found'),
				{ status: 404, code: ErrorCodes.NOT_FOUND }
			);
		}
		
		requireResourceAccess(context, {
			accountId: bundle.accountId ?? undefined,
			createdBy: bundle.createdBy
		});
		
		// Can only add apps to DRAFT bundles
		if (bundle.status !== 'DRAFT') {
			throw Object.assign(
				new Error('Can only add apps to DRAFT bundles'),
				{ status: 409, code: ErrorCodes.CONFLICT }
			);
		}
		
		// Verify resource exists and is an app
		const resource = await prisma.resource.findUnique({
			where: { id: resourceId },
			select: {
				id: true,
				type: true,
				accountId: true
			}
		});
		
		if (!resource) {
			throw Object.assign(
				new Error('Resource not found'),
				{ status: 404, code: ErrorCodes.NOT_FOUND }
			);
		}
		
		if (resource.type !== 'APP') {
			throw Object.assign(
				new Error('Resource must be an app'),
				{ status: 400, code: ErrorCodes.INVALID_INPUT }
			);
		}
		
		// Check resource access (can use if owned or public)
		const canUseResource = context.session.user.systemRole === 'ADMIN' ||
		                       resource.accountId === context.account?.id;
		
		if (!canUseResource) {
			throw Object.assign(
				new Error('Access denied to this resource'),
				{ status: 403, code: ErrorCodes.FORBIDDEN }
			);
		}
		
		// Determine order
		let appOrder = order;
		if (appOrder === undefined || appOrder === null) {
			// Get max order and add 1
			const maxOrder = await prisma.bundleApp.findFirst({
				where: { bundleId },
				orderBy: { order: 'desc' },
				select: { order: true }
			});
			appOrder = (maxOrder?.order || 0) + 1;
		}
		
		// Add app to bundle
		const bundleApp = await prisma.bundleApp.create({
			data: {
				bundleId,
				resourceId,
				order: appOrder,
				createdBy: context.session.user.id,
				updatedBy: context.session.user.id
			},
			include: {
				resource: {
					select: {
						id: true,
						name: true,
						packageName: true,
						version: true
					}
				}
			}
		});
		
		return successResponse(
			bundleApp,
			{ requestId: context.requestId }
		);
	},
	{ permission: 'bundle.edit' }
);

