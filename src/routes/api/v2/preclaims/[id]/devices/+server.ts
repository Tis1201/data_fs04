/**
 * Unified Preclaim Devices API (v2)
 * 
 * This endpoint replaces:
 * - /api/admin/iot/preclaims/[id]/devices
 * - /api/user/iot/preclaims/[id]/devices
 * 
 * Lists devices associated with a preclaim set.
 */

import { unifiedEndpoint, requireResourceAccess } from '$lib/server/api/unifiedEndpoint';
import { successResponse, paginatedResponse, errorResponse, ErrorCodes } from '$lib/types/api';
import prisma from '$lib/server/prisma';
import { logger } from '$lib/server/logger';
import { fetchTableData } from '$lib/components/ui_components_sveltekit/table/utils/server';

/**
 * GET /api/v2/preclaims/[id]/devices
 * Get devices in a preclaim set
 * 
 * Query params:
 * - page: page number
 * - pageSize: items per page
 * - status: filter by status
 * - sort_field: field to sort by
 * - sort_order: sort order (asc/desc)
 */
export const GET = unifiedEndpoint(
	async ({ context, params, event }) => {
		const preclaimSetId = params.id;
		
		// Get preclaim set and check access
		const preclaimSet = await prisma.preclaimSet.findUnique({
			where: { id: preclaimSetId },
			select: {
				id: true,
				accountId: true,
				createdBy: true
			}
		});
		
		if (!preclaimSet) {
			throw Object.assign(
				new Error('Preclaim set not found'),
				{ status: 404, code: ErrorCodes.NOT_FOUND }
			);
		}
		
		// Check access
		requireResourceAccess(context, {
			accountId: preclaimSet.accountId || undefined,
			createdBy: preclaimSet.createdBy
		});
		
		try {
			// Normalize query params to the shared table utils convention
			const normalizedUrl = new URL(event.url);
			const sortFieldParam = event.url.searchParams.get('sort_field');
			const sortOrderParam = event.url.searchParams.get('sort_order');
			if (sortFieldParam) normalizedUrl.searchParams.set('sort', sortFieldParam);
			if (sortOrderParam) normalizedUrl.searchParams.set('order', sortOrderParam);
			
			// Use the shared fetchTableData utility for consistency
			const result = await fetchTableData<any>(context.locals, normalizedUrl, {
				modelName: 'preclaimDevice',
				searchableFields: ['id', 'deviceId', 'macId', 'name'],
				allowedFilters: ['status'],
				defaultSortField: 'createdAt',
				defaultSortOrder: 'desc',
				defaultPerPage: 10,
				select: {
					id: true,
					deviceId: true,
					macId: true,
					name: true,
					status: true,
					claimedAt: true,
					createdAt: true
				},
				// Ensure we only fetch claims for this preclaim set
				baseWhere: { setId: preclaimSetId },
				// Map URL filters to DB fields/operators
				filterMappings: {
					status: {
						field: 'status',
						operator: 'equals'
					}
				}
			});
			
			// Return in v2 format
			return successResponse(
				{
					records: result.records,
					pagination: result.meta.pagination,
					sort: result.meta.sort
				},
				{ requestId: context.requestId }
			);
		} catch (e: any) {
			logger.error(`Failed to load preclaim devices: ${e?.message || String(e)}`, {
				requestId: context.requestId,
				preclaimSetId
			});
			
			throw Object.assign(
				new Error('Failed to load preclaim devices'),
				{ status: 500, code: ErrorCodes.INTERNAL_ERROR }
			);
		}
	},
	{ permission: 'preclaim.view' }
);

