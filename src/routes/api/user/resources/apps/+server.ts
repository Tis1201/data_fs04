import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { restrict } from '$lib/server/security/guards';
import { SystemRole } from '$lib/types/roles';
import { logger } from '$lib/server/logger';

// Allowed app formats (server-enforced)
const ALLOWED_FORMATS = new Set(['apk', 'ipa', 'app', 'exe', 'msi', 'deb', 'rpm', 'dmg', 'pkg', 'cpk']);

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
  async ({ url, locals, auth }: { url: URL; locals: any; auth: any }) => {
    try {
      const search = url.searchParams.get('search');
      const formatFilter = parseCsvList(url.searchParams.get('format'));
      const versionFilter = url.searchParams.get('version');
      const excludePackagesCsv = url.searchParams.get('excludePackages');
      const excludePackages = excludePackagesCsv ? excludePackagesCsv.split(',').map((s) => s.trim()).filter(Boolean) : [];
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

      // Scope to current account (switch-account aware)
      const currentAccountId = (locals as { currentAccount?: { account?: { id: string } } }).currentAccount?.account?.id;
      if (!currentAccountId) {
        return json({
          items: [],
          meta: {
            page: 1,
            pageSize,
            totalItems: 0,
            totalPages: 1,
            hasNext: false,
            sort: sortParam,
            order: orderParam
          }
        });
      }

      // Build where clause
      const where: any = {
        accountId: currentAccountId,
        format: { in: Array.from(ALLOWED_FORMATS) }
      };

      if (formatFilter && formatFilter.length) {
        where.format = { in: formatFilter };
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

      // Exclude already-selected packages if provided
      if (excludePackages.length) {
        if (!where.NOT) where.NOT = [] as any;
        (where.NOT as any[]).push({ packageName: { in: excludePackages } });
      }

      // Exclude null package names from unique list
      if (!where.NOT) where.NOT = [] as any;
      (where.NOT as any[]).push({ packageName: null });

      // Pagination calculus
      const skip = (page - 1) * pageSize;
      const take = pageSize;

      // Count total (distinct by packageName)
      // ZenStack will automatically filter based on access policies
      const grouped = await locals.prisma.resource.groupBy({
        by: ['packageName'],
        where,
        _count: { _all: true }
      });
      const totalItems = grouped.length;

      // Fetch items (distinct by packageName)
      // ZenStack will automatically filter based on access policies
      const items = await locals.prisma.resource.findMany({
        where,
        distinct: ['packageName'],
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
      logger.error(`[UserAppsAPI] Error fetching app resources: ${String(err)}`);
      return json({ success: false, error: 'Failed to fetch app resources' }, { status: 500 });
    }
  },
  [SystemRole.USER] // Allow USER role to access this route
);

