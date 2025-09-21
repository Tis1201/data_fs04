import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { restrict } from '$lib/server/security/guards';
import { SystemRole } from '$lib/types/roles';
import { logger } from '$lib/server/logger';

// Allowed firmware formats (server-enforced)
const ALLOWED_FORMATS = new Set(['bin', 'hex', 'firmware', 'fw', 'cpk', 'apk', 'zip']);

// Allowed sort fields mapping to DB columns
const SORT_FIELDS = new Set(['createdAt', 'name', 'version', 'size']);

function parseCsvList(param: string | null): string[] | undefined {
  if (!param) return undefined;
  const values = param
    .split(',')
    .map((v) => v.trim().toLowerCase())
    .filter((v) => v.length > 0);
  return values.length ? values : undefined;
}

export const GET: RequestHandler = restrict(
  async ({ url, locals }: { url: URL; locals: any }) => {
    try {
      const search = url.searchParams.get('search');
      const formatFilter = parseCsvList(url.searchParams.get('format'));
      const versionFilter = url.searchParams.get('version');
      const createdAfter = url.searchParams.get('createdAfter');
      const createdBefore = url.searchParams.get('createdBefore');
      const pageParam = url.searchParams.get('page');
      const pageSizeParam = url.searchParams.get('pageSize');
      const sortParam = url.searchParams.get('sort') || 'createdAt';
      const orderParam = (url.searchParams.get('order') || 'desc').toLowerCase();

      // Validate pagination
      const page = Math.max(1, Number.isFinite(Number(pageParam)) ? Number(pageParam) : 1);
      const pageSizeRaw = Number.isFinite(Number(pageSizeParam)) ? Number(pageSizeParam) : 20;
      const pageSize = Math.min(Math.max(1, pageSizeRaw), 100);

      // Validate sort
      const sortField = SORT_FIELDS.has(sortParam) ? sortParam : 'createdAt';
      const sortOrder: 'asc' | 'desc' = orderParam === 'asc' ? 'asc' : 'desc';

      // Validate format filter
      if (formatFilter && formatFilter.some((f) => !ALLOWED_FORMATS.has(f))) {
        return json({ success: false, error: 'Invalid format filter' }, { status: 400 });
      }

      // Validate date filters
      const createdAfterDate = createdAfter ? new Date(createdAfter) : undefined;
      const createdBeforeDate = createdBefore ? new Date(createdBefore) : undefined;
      if ((createdAfter && isNaN(createdAfterDate!.getTime())) || (createdBefore && isNaN(createdBeforeDate!.getTime()))) {
        return json({ success: false, error: 'Invalid date filter' }, { status: 400 });
      }

      // Build where clause (no strict type/target enforcement)
      const where: any = {};

      if (formatFilter && formatFilter.length) {
        where.format = { in: formatFilter };
      } else {
        // Default to allowed formats, but this can be overridden with ?format=
        where.format = { in: Array.from(ALLOWED_FORMATS) };
      }

      if (versionFilter) {
        where.version = versionFilter;
      }

      if (createdAfterDate || createdBeforeDate) {
        where.createdAt = {};
        if (createdAfterDate) where.createdAt.gt = createdAfterDate;
        if (createdBeforeDate) where.createdAt.lt = createdBeforeDate;
      }

      if (search && search.trim().length) {
        const q = search.trim();
        where.OR = [
          { name: { contains: q, mode: 'insensitive' } },
          { description: { contains: q, mode: 'insensitive' } },
          { packageName: { contains: q, mode: 'insensitive' } }
        ];
      }

      // Pagination calculus
      const skip = (page - 1) * pageSize;
      const take = pageSize;

      // Debug logging
      logger.info(`[FirmwareAPI] Query params:`, {
        search,
        formatFilter,
        versionFilter,
        createdAfter,
        createdBefore,
        page,
        pageSize,
        sortField,
        sortOrder
      });
      logger.info(`[FirmwareAPI] Where clause:`, where);

      // Count total
      const totalItems = await locals.prisma.resource.count({ where });
      logger.info(`[FirmwareAPI] Total items found: ${totalItems}`);

      // Fetch items
      const items = await locals.prisma.resource.findMany({
        where,
        orderBy: [{ [sortField]: sortOrder }, { id: 'asc' }], // stable tie-breaker
        skip,
        take,
        select: {
          id: true,
          name: true,
          description: true,
          version: true,
          format: true,
          packageName: true,
          size: true,
          path: true,
          createdAt: true
        }
      });

      logger.info(`[FirmwareAPI] Items returned: ${items.length}`);

      const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
      const hasNext = page < totalPages;

      return json({
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
      });
    } catch (err) {
      logger.error(`[FirmwareAPI] Error fetching firmware resources: ${String(err)}`);
      return json({ success: false, error: 'Failed to fetch firmware resources' }, { status: 500 });
    }
  },
  [SystemRole.ADMIN]
);


