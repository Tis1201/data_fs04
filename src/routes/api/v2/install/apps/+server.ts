import { json, type RequestHandler } from '@sveltejs/kit';
import { logger } from '$lib/server/logger';
import { PrismaClient } from '@prisma/client';

// Hardcoded API key for device agent installation
// TODO: Move to environment variable for production
const INSTALL_API_KEY = 'gXKC9oVonzK6WRtwRVBdjIBQQcJUYgx6vL2HUwcJ6UJoVd6iRW';

// Allowed app formats
const ALLOWED_FORMATS = new Set(['apk', 'ipa', 'app', 'exe', 'msi', 'deb', 'rpm', 'dmg', 'pkg', 'cpk']);

// Allowed sort fields
const SORT_FIELDS = new Set(['createdAt', 'name', 'version', 'size']);

/**
 * Verify API key from Authorization header
 */
function verifyApiKey(request: Request): boolean {
	const authHeader = request.headers.get('authorization');
	if (!authHeader) {
		return false;
	}

	// Support both "Bearer TOKEN" and "API-Key TOKEN" formats
	const parts = authHeader.split(' ');
	if (parts.length !== 2) {
		return false;
	}

	const token = parts[1];
	return token === INSTALL_API_KEY;
}

/**
 * GET /api/v2/install/apps
 * 
 * List and search device apps from resources table
 * 
 * Headers:
 * - Authorization: Bearer {INSTALL_API_KEY} or API-Key {INSTALL_API_KEY}
 * 
 * Query Parameters:
 * - search: Search term for name, description, or packageName
 * - format: Filter by format (apk, cpk, exe, etc.) - comma-separated
 * - sort: Sort field (createdAt, name, version, size) - default: createdAt
 * - order: Sort order (asc, desc) - default: desc
 * - page: Page number (1-based) - default: 1
 * - pageSize: Number of items per page (1-100) - default: 20
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "items": [...],
 *     "meta": {
 *       "page": 1,
 *       "pageSize": 20,
 *       "totalItems": 100,
 *       "totalPages": 5,
 *       "hasNext": true,
 *       "sort": "createdAt",
 *       "order": "desc"
 *     }
 *   }
 * }
 */
export const GET: RequestHandler = async (event) => {
	const { request, url } = event;

	try {
		// Verify API key
		if (!verifyApiKey(request)) {
			const clientIp = await event.getClientAddress();
			logger.warn('[InstallAppsAPI] Unauthorized access attempt', {
				clientIp,
				userAgent: request.headers.get('user-agent')
			});

			return json(
				{
					success: false,
					error: 'Unauthorized - Invalid or missing API key'
				},
				{ status: 401 }
			);
		}

		// Parse query parameters
		const search = url.searchParams.get('search');
		const formatParam = url.searchParams.get('format');
		const sortParam = url.searchParams.get('sort') || 'createdAt';
		const orderParam = (url.searchParams.get('order') || 'desc').toLowerCase();
		const pageParam = url.searchParams.get('page');
		const pageSizeParam = url.searchParams.get('pageSize');

		// Parse format filter
		const formatFilter = formatParam
			? formatParam
					.split(',')
					.map((f) => f.trim().toLowerCase())
					.filter((f) => ALLOWED_FORMATS.has(f))
			: [];

		// Validate pagination
		const page = Math.max(1, Number.isFinite(Number(pageParam)) ? Number(pageParam) : 1);
		const pageSizeRaw = Number.isFinite(Number(pageSizeParam)) ? Number(pageSizeParam) : 20;
		const pageSize = Math.min(Math.max(1, pageSizeRaw), 100);

		// Validate sort
		const sortField = SORT_FIELDS.has(sortParam) ? sortParam : 'createdAt';
		const sortOrder: 'asc' | 'desc' = orderParam === 'asc' ? 'asc' : 'desc';

		// Build where clause
		const where: any = {
			type: 'application', // Only application resources
			format: { in: Array.from(ALLOWED_FORMATS) }
		};

		// Apply format filter if provided
		if (formatFilter.length > 0) {
			where.format = { in: formatFilter };
		}

		// Apply search filter
		if (search && search.trim().length) {
			const q = search.trim();
			where.OR = [
				{ name: { contains: q, mode: 'insensitive' } },
				{ description: { contains: q, mode: 'insensitive' } },
				{ packageName: { contains: q, mode: 'insensitive' } }
			];
		}

		// Exclude null package names
		where.packageName = { not: null };

		// Create Prisma client (without ZenStack - no user context needed)
		const prisma = new PrismaClient();

		try {
			// Pagination calculus
			const skip = (page - 1) * pageSize;
			const take = pageSize;

			// Count total items
			const totalItems = await prisma.resource.count({ where });

			// Fetch items
			const items = await prisma.resource.findMany({
				where,
				orderBy: [{ [sortField]: sortOrder }, { id: 'asc' }], // stable tie-breaker
				skip,
				take,
				select: {
					id: true,
					name: true,
					description: true,
					type: true,
					target: true,
					version: true,
					format: true,
					packageName: true,
					path: true,
					size: true,
					createdAt: true,
					updatedAt: true,
					createdBy: true,
					updatedBy: true,
					accountId: true
				}
			});

			const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
			const hasNext = page < totalPages;

			const clientIp = await event.getClientAddress();
			logger.info('[InstallAppsAPI] Apps list fetched', {
				search,
				format: formatFilter,
				sort: sortField,
				order: sortOrder,
				page,
				pageSize,
				totalItems,
				clientIp
			});

			return json({
				success: true,
				data: {
					items,
					meta: {
						page,
						pageSize,
						totalItems,
						totalPages,
						hasNext,
						sort: sortField,
						order: sortOrder
					}
				}
			});
		} finally {
			await prisma.$disconnect();
		}
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		logger.error('[InstallAppsAPI] Error fetching apps', {
			error: message,
			stack: err instanceof Error ? err.stack : undefined
		});

		return json(
			{
				success: false,
				error: 'Failed to fetch apps',
				details: { message }
			},
			{ status: 500 }
		);
	}
};
