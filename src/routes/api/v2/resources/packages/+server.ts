/**
 * Unified Resources Packages API (v2)
 * 
 * This endpoint returns all unique package names from the Resource table.
 * Works for both admin and user roles with appropriate permission checks.
 */

import { unifiedEndpoint } from '$lib/server/api/unifiedEndpoint';
import type { RequestHandler } from '@sveltejs/kit';

/**
 * GET /api/v2/resources/packages
 * Get all unique package names
 * 
 * - Admin: sees all packages from all users
 * - User: sees only packages they created (createdBy)
 * 
 * Returns:
 * - List of unique package names with metadata
 * - Display name, description, type, format for each package
 */
export const GET: RequestHandler = unifiedEndpoint(
	async ({ context }) => {
		const isAdmin = context.session.user.systemRole === 'ADMIN';

		// Build where clause - admins see all, users see only their own
		const whereClause: any = {
			packageName: { not: null }
		};

		// Non-admins can only see packages they created
		if (!isAdmin) {
			whereClause.createdBy = context.session.user.id;
		}

		// Fetch all unique package names from Resource table
		const resources = await context.prisma.resource.findMany({
			where: whereClause,
			select: {
				packageName: true,
				name: true,
				description: true,
				type: true,
				format: true
			},
			distinct: ['packageName'],
			orderBy: { packageName: 'asc' }
		});

		const allPackages = resources
			.filter((resource: any) => resource.packageName)
			.map((resource: any) => ({
				packageName: resource.packageName!,
				displayName: resource.name,
				description: resource.description,
				type: resource.type,
				format: resource.format
			}));

		return {
			success: true,
			data: {
				packages: allPackages,
				counts: {
					total: allPackages.length
				}
			},
			meta: {
				timestamp: new Date().toISOString(),
				requestId: context.requestId,
				message: `Found ${allPackages.length} unique packages`
			}
		};
	}
	// No specific permission needed - filters by createdBy for users
	// Admin sees all, user sees only their own uploaded packages
);

