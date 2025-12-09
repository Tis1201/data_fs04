/**
 * Unified Resource Debug API (v2)
 * 
 * This endpoint provides debug information about resources.
 * Admin-only feature.
 */

import { unifiedEndpoint } from '$lib/server/api/unifiedEndpoint';
import { successResponse, errorResponse, ErrorCodes } from '$lib/types/api';
import prisma from '$lib/server/prisma';

/**
 * GET /api/v2/resources/debug
 * Get debug information about all resources
 * 
 * Includes:
 * - Resource count by type
 * - Resource count by format
 * - Total storage used
 * - Orphaned resources (not used in any bundle)
 */
export const GET = unifiedEndpoint(
	async ({ context }) => {
		// Get all resources
		const resources = await prisma.resource.findMany({
			select: {
				id: true,
				type: true,
				format: true,
				size: true,
				accountId: true,
				bundleApps: {
					select: { id: true }
				}
			}
		});
		
		// Calculate statistics
		const stats = {
			total: resources.length,
			byType: {} as Record<string, number>,
			byFormat: {} as Record<string, number>,
			byAccount: {} as Record<string, number>,
			totalSize: 0,
			orphaned: 0,
			orphanedResources: [] as string[]
		};
		
		resources.forEach(resource => {
			// Count by type
			stats.byType[resource.type] = (stats.byType[resource.type] || 0) + 1;
			
			// Count by format
			if (resource.format) {
				stats.byFormat[resource.format] = (stats.byFormat[resource.format] || 0) + 1;
			}
			
			// Count by account
			const accountKey = resource.accountId || 'system';
			stats.byAccount[accountKey] = (stats.byAccount[accountKey] || 0) + 1;
			
			// Total size
			stats.totalSize += resource.size || 0;
			
			// Orphaned (not used in any bundle)
			if (resource.bundleApps.length === 0) {
				stats.orphaned++;
				stats.orphanedResources.push(resource.id);
			}
		});
		
		// Get bundle usage stats
		const bundleUsage = await prisma.bundleApp.groupBy({
			by: ['resourceId'],
			_count: {
				resourceId: true
			},
			orderBy: {
				_count: {
					resourceId: 'desc'
				}
			},
			take: 10
		});
		
		const topUsedResourceIds = bundleUsage.map(b => b.resourceId);
		const topUsedResources = await prisma.resource.findMany({
			where: {
				id: { in: topUsedResourceIds }
			},
			select: {
				id: true,
				name: true,
				type: true
			}
		});
		
		const topUsed = bundleUsage.map(usage => {
			const resource = topUsedResources.find(r => r.id === usage.resourceId);
			return {
				resourceId: usage.resourceId,
				name: resource?.name || 'Unknown',
				type: resource?.type || 'Unknown',
				usageCount: usage._count.resourceId
			};
		});
		
		return successResponse(
			{
				stats,
				topUsed,
				timestamp: new Date().toISOString()
			},
			{ requestId: context.requestId }
		);
	},
	{ permission: 'admin.viewAllResources' }
);

