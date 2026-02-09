import { unifiedEndpoint } from '$lib/server/api/unifiedEndpoint';
import { successResponse } from '$lib/types/api';
import { ErrorCodes } from '$lib/types/api';
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

/**
 * GET /api/v2/resources/apps
 * List app resources (APK, IPA, etc.) with pagination and filtering
 * 
 * Query params:
 * - search: string - Search in name, description, packageName
 * - format: string (CSV) - Filter by formats (apk,ipa,exe,etc.)
 * - version: string - Filter by version
 * - ruleId: string - Exclude packages already in this pin rule
 * - excludePackages: string (CSV) - Exclude specific packages
 * - createdAfter: string (ISO date) - Filter by creation date
 * - createdBefore: string (ISO date) - Filter by creation date
 * - page: number - Page number (default: 1)
 * - pageSize: number - Items per page (default: 20, max: 100)
 * - sort: string - Sort field (createdAt, name, version, size)
 * - order: string - Sort order (asc, desc)
 * 
 * Admin: See all app resources
 * User: See only resources from their accounts
 * 
 * Returns distinct packages by packageName
 */
export const GET = unifiedEndpoint(
  async ({ context, event }) => {
    const { prisma, session } = context;
    const url = event.url;

    // Parse query parameters
    const search = url.searchParams.get('search');
    const formatFilter = parseCsvList(url.searchParams.get('format'));
    const versionFilter = url.searchParams.get('version');
    const ruleId = url.searchParams.get('ruleId');
    const excludePackagesCsv = url.searchParams.get('excludePackages');
    const excludePackages = excludePackagesCsv
      ? excludePackagesCsv.split(',').map((s) => s.trim()).filter(Boolean)
      : [];
    const packagesCsv = url.searchParams.get('packages');
    const packagesFilter = packagesCsv
      ? packagesCsv.split(',').map((s) => s.trim()).filter(Boolean)
      : undefined;
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
      throw Object.assign(
        new Error('Invalid format filter'),
        { status: 400, code: ErrorCodes.INVALID_INPUT }
      );
    }

    // Validate date filters
    const createdAfterDate = createdAfter ? new Date(createdAfter) : undefined;
    const createdBeforeDate = createdBefore ? new Date(createdBefore) : undefined;
    if (
      (createdAfter && isNaN(createdAfterDate!.getTime())) ||
      (createdBefore && isNaN(createdBeforeDate!.getTime()))
    ) {
      throw Object.assign(
        new Error('Invalid date filter'),
        { status: 400, code: ErrorCodes.INVALID_INPUT }
      );
    }

    // Build where clause
    const where: any = {};

    // Format filter
    if (formatFilter && formatFilter.length) {
      where.format = { in: formatFilter };
    } else {
      where.format = { in: Array.from(ALLOWED_FORMATS) };
    }

    // Version filter
    if (versionFilter) {
      where.version = versionFilter;
    }

    // Date filters
    if (createdAfterDate || createdBeforeDate) {
      where.createdAt = {};
      if (createdAfterDate) where.createdAt.gt = createdAfterDate;
      if (createdBeforeDate) where.createdAt.lt = createdBeforeDate;
    }

    // Restrict to specific packages (e.g. for pin rule app list)
    if (packagesFilter && packagesFilter.length > 0) {
      where.packageName = { in: packagesFilter };
    }

    // Search filter
    if (search && search.trim().length) {
      const q = search.trim();
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
        { packageName: { contains: q, mode: 'insensitive' } }
      ];
    }

    // Exclude packages from rule if provided
    if (ruleId) {
      const rule = await prisma.pinRule.findUnique({
        where: { id: ruleId },
        select: { apps: true }
      });
      const rulePkgs = (rule?.apps ?? []).filter(Boolean);
      if (rulePkgs.length) {
        if (!where.NOT) where.NOT = [] as any;
        (where.NOT as any[]).push({ packageName: { in: rulePkgs } });
      }
    }

    // Exclude specific packages
    if (excludePackages.length) {
      if (!where.NOT) where.NOT = [] as any;
      (where.NOT as any[]).push({ packageName: { in: excludePackages } });
    }

    // Exclude null package names
    if (!where.NOT) where.NOT = [] as any;
    (where.NOT as any[]).push({ packageName: null });

    // Role-based account filtering
    if (session.user.systemRole !== 'ADMIN') {
      const memberships = await prisma.accountMembership.findMany({
        where: { userId: session.user.id },
        select: { accountId: true }
      });
      const accountIds = memberships.map((m: { accountId: string }) => m.accountId);
      // If no accounts, force empty result set
      where.accountId = accountIds.length > 0 ? { in: accountIds } : '__NO_ACCOUNT__';
    }

    // Pagination
    const skip = (page - 1) * pageSize;
    const take = pageSize;

    logger.info(`[AppsAPI] Query params:`, {
      search,
      formatFilter,
      versionFilter,
      createdAfter,
      createdBefore,
      page,
      pageSize,
      sortField,
      sortOrder,
      role: session.user.systemRole
    });

    // Count total (distinct by packageName)
    const grouped = await prisma.resource.groupBy({
      by: ['packageName'],
      where,
      _count: { _all: true }
    });
    const totalItems = grouped.length;

    logger.info(`[AppsAPI] Total items found: ${totalItems}`);

    // Fetch items (distinct by packageName)
    const items = await prisma.resource.findMany({
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
        releaseType: true,
        path: true,
        createdAt: true
      }
    });

    logger.info(`[AppsAPI] Items returned: ${items.length}`);

    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    const hasNext = page < totalPages;

    return successResponse({
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
  },
  { permission: 'resource.view', skipPermission: true } // TODO: remove skipPermission when ACL is fixed
);
