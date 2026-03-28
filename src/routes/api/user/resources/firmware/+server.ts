import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { restrict } from '$lib/server/security/guards';
import { SystemRole } from '$lib/types/roles';
import { logger } from '$lib/server/logger';
import { resourceVisibilityOrForAccount } from '$lib/server/api/unifiedEndpoint';

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
  async ({ url, locals, cookies }: { url: URL; locals: any; cookies: any }) => {
    try {
      const currentAccountId =
        (locals as any).currentAccount?.account?.id ?? cookies.get('current_account_id');
      if (!currentAccountId) {
        return json({ items: [], meta: { page: 1, pageSize: 20, totalItems: 0, totalPages: 0, hasNext: false } });
      }

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

      const and: any[] = [{ OR: resourceVisibilityOrForAccount(currentAccountId) }];

      if (formatFilter && formatFilter.length) {
        and.push({ format: { in: formatFilter } });
      } else {
        and.push({ format: { in: Array.from(ALLOWED_FORMATS) } });
      }

      if (versionFilter) {
        and.push({ version: versionFilter });
      }

      if (createdAfterDate || createdBeforeDate) {
        const createdAt: Record<string, Date> = {};
        if (createdAfterDate) createdAt.gt = createdAfterDate;
        if (createdBeforeDate) createdAt.lt = createdBeforeDate;
        and.push({ createdAt });
      }

      if (search && search.trim().length) {
        const q = search.trim();
        and.push({
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { description: { contains: q, mode: 'insensitive' } },
            { packageName: { contains: q, mode: 'insensitive' } }
          ]
        });
      }

      const where: any = { AND: and };

      // Pagination calculus
      const skip = (page - 1) * pageSize;
      const take = pageSize;

      // Count total
      const totalItems = await locals.prisma.resource.count({ where });

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
  [SystemRole.USER]
);


