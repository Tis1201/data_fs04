import { unifiedEndpoint } from '$lib/server/api/unifiedEndpoint';
import { json } from '@sveltejs/kit';
import rawPrisma from '$lib/server/prisma';
import { requirePermission } from '$lib/server/security/permissions';
import { ErrorCodes } from '$lib/types/api';

const ALLOWED_SORT_FIELDS = new Set(['createdAt', 'name', 'macId', 'status', 'expiresAt', 'claimedAt', 'wifiAddress', 'lanAddress']);
const ALLOWED_SORT_ORDERS = new Set(['asc', 'desc']);
// wifiAddress and lanAddress are UI display aliases for macId (not real DB columns)
const SORT_FIELD_ALIAS: Record<string, string> = { wifiAddress: 'macId', lanAddress: 'macId' };

/**
 * GET /api/v2/preclaims/[id]/devices
 * Get devices for a preclaim set
 * 
 * Uses the shared table data fetcher for consistency with UI components
 * 
 * Query params: Standard table params (page, per_page, search, sort, order, filters)
 * 
 * Returns preclaim devices with status and claim information
 */
export const GET = unifiedEndpoint(
  async ({ context, params, event }) => {
    const { prisma, permissionUser } = context;
    const { id } = params;
    const url = event.url;

    // Load preclaim set and check permission with resource (required for USER role)
    const preclaimSet = await prisma.preclaimSet.findFirst({
      where: { id },
      select: { id: true, accountId: true }
    });
    if (!preclaimSet) {
      throw Object.assign(new Error('Pre-claim set not found'), { status: 404, code: ErrorCodes.NOT_FOUND });
    }
    await requirePermission(permissionUser, 'preclaim.view', preclaimSet);

    const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
    const perPage = Math.min(100, Math.max(1, Number(url.searchParams.get('per_page')) || 10));

    const sortFieldParam = url.searchParams.get('sort_field') || url.searchParams.get('sort') || 'name';
    const sortField = ALLOWED_SORT_FIELDS.has(sortFieldParam) ? sortFieldParam : 'name';
    const dbSortField = SORT_FIELD_ALIAS[sortField] ?? sortField;
    const sortOrderParam = url.searchParams.get('sort_order') || url.searchParams.get('order') || 'asc';
    const sortOrder = (ALLOWED_SORT_ORDERS.has(sortOrderParam) ? sortOrderParam : 'desc') as 'asc' | 'desc';
    const search = (url.searchParams.get('search') || '').trim();

    const select = {
      id: true,
      deviceId: true,
      macId: true,
      name: true,
      status: true,
      expiresAt: true,
      claimedAt: true,
      createdAt: true
    };

    const baseWhere = { setId: id };
    const where = search
      ? {
          AND: [
            baseWhere,
            {
              OR: [
                { id: { contains: search, mode: 'insensitive' as const } },
                { macId: { contains: search, mode: 'insensitive' as const } },
                { name: { contains: search, mode: 'insensitive' as const } }
              ]
            }
          ]
        }
      : baseWhere;

    const [records, totalRecords] = await Promise.all([
      rawPrisma.preclaimDevice.findMany({
        where,
        select,
        orderBy: { [dbSortField]: sortOrder },
        skip: (page - 1) * perPage,
        take: perPage
      }),
      rawPrisma.preclaimDevice.count({ where })
    ]);

    const totalPages = Math.ceil(totalRecords / perPage) || 1;
    const pagination = {
      page,
      per_page: perPage,
      total_records: totalRecords,
      total_pages: totalPages
    };
    const sort = { field: sortField, order: sortOrder };

    return json({ records, pagination, sort });
  },
  {} // permission checked in handler with preclaim set resource
);
