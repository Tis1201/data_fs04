/**
 * Unified Device Selector API (v2)
 * 
 * This endpoint provides device selection for dropdowns/pickers.
 * Works for both admin and user roles with appropriate permission checks.
 */

import { unifiedEndpoint } from '$lib/server/api/unifiedEndpoint';
import { successResponse } from '$lib/types/api';
import { areDevicesOnline } from '$lib/server/device/devicePresence';
import { getBulkDeviceInformationByDeviceIds } from '$lib/server/clickhouse/client';

/**
 * GET /api/v2/devices/select
 * Get devices for selection/dropdown
 * 
 * Query params:
 * - page: page number (default: 1)
 * - per_page: items per page (default: 10, max: 50)
 * - sort: sort field (name, status, lastUsedAt)
 * - order: sort order (asc, desc)
 * - search: search term
 * - status: filter by status
 * - tag: filter by tag (name)
 * - tagIds: comma-separated device tag IDs (devices that have any of these tags)
 * - excludeDeviceIds: comma-separated IDs to exclude
 * - includeDeviceIds: comma-separated IDs to include (overrides other filters)
 */
export const GET = unifiedEndpoint(
	async ({ context, event }) => {
		const url = event.url;
		const page = Math.max(1, Number(url.searchParams.get('page') || '1'));
		const perPage = Math.min(50, Math.max(1, Number(url.searchParams.get('per_page') || '10')));
		const sort = (url.searchParams.get('sort') || 'name') as 'name' | 'status' | 'lastUsedAt';
		const order = (url.searchParams.get('order') || 'asc') as 'asc' | 'desc';
		const search = (url.searchParams.get('search') || '').trim();
		const status = url.searchParams.get('status');
		const tag = url.searchParams.get('tag');
		const tagIdsCsv = url.searchParams.get('tagIds');
		const excludeIdsCsv = url.searchParams.get('excludeDeviceIds');
		const includeIdsCsv = url.searchParams.get('includeDeviceIds');
		
		const tagIds = tagIdsCsv ? tagIdsCsv.split(',').map((s) => s.trim()).filter(Boolean) : [];
		const excludeIds = excludeIdsCsv ? excludeIdsCsv.split(',').map((s) => s.trim()).filter(Boolean) : [];
		const includeIds = includeIdsCsv ? includeIdsCsv.split(',').map((s) => s.trim()).filter(Boolean) : [];
		
		const where: any = {};
		
		// Search filter
		if (search) {
			where.OR = [
				{ name: { contains: search, mode: 'insensitive' } },
				{ description: { contains: search, mode: 'insensitive' } },
				{ id: { contains: search, mode: 'insensitive' } }
			];
		}
		
		// Status filter
		if (status) where.status = status;
		
		// Tag filter (by name or by tag IDs)
		if (tagIds.length) {
			where.tags = { some: { id: { in: tagIds } } };
		} else if (tag) {
			where.tags = {
				some: { name: tag }
			};
		}
		
		// Include/exclude filters
		if (includeIds.length) {
			where.id = { in: includeIds };
		} else if (excludeIds.length) {
			where.id = { notIn: excludeIds };
		}
		
		// Non-admin: restrict by account
		const isAdmin = context.session.user.systemRole === 'ADMIN';
		if (!isAdmin) {
			where.accountId = context.account?.id;
		}
		
		const skip = includeIds.length ? 0 : (page - 1) * perPage;
		const take = includeIds.length ? includeIds.length : perPage;
		
		const [total, devices] = await Promise.all([
			context.prisma.device.count({ where }),
			context.prisma.device.findMany({
				where,
				orderBy: [{ [sort]: order }, { id: 'asc' }],
				skip,
				take,
				select: {
					id: true,
					name: true,
					status: true,
					model: true,
					description: true,
					macAddress: true,
					// Keep DB field for backwards compatibility, but we'll override with Redis presence below
					connected: true,
					lastUsedAt: true,
					createdAt: true
				}
			})
		]);

		// Fetch real-time presence from Redis (MQTT presence tracker)
		const deviceIds = devices.map((d: { id: string }) => d.id);
		const [presenceMap, deviceInfoMap] = await Promise.all([
			areDevicesOnline(deviceIds),
			getBulkDeviceInformationByDeviceIds(deviceIds).catch(() => new Map())
		]);
		const devicesWithPresence = devices.map((device: typeof devices[number]) => {
			const info = deviceInfoMap.get(device.id);
			return {
				...device,
				// Override DB-connected with Redis presence (fallback to false)
				connected: presenceMap.get(device.id) ?? false,
				// Enrich with ClickHouse heartbeat timestamps for Last Seen (align with Device detail page)
				last_connected_at: info?.last_connected_at ?? null,
				last_status_at: info?.last_status_at ?? null
			};
		});
		
		return successResponse(
			{
				devices: devicesWithPresence,
				meta: {
					current_page: page,
					per_page: perPage,
					total,
					last_page: Math.max(1, Math.ceil(total / perPage))
				}
			},
			{ requestId: context.requestId }
		);
	}
	// No permission check - uses account filtering instead
	// Admin sees all devices, user sees only their account's devices
);

