import { unifiedEndpoint } from '$lib/server/api/unifiedEndpoint';
import { successResponse } from '$lib/types/api';
import { ErrorCodes } from '$lib/types/api';
import { logger } from '$lib/server/logger';

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
 * GET /api/v2/resources/files
 * List file resources (excluding apps and firmware) with pagination and filtering
 * 
 * Query params:
 * - search: string - Search in name, description, packageName
 * - formats: string (CSV) - Filter by specific formats
 * - page: number - Page number (default: 1)
 * - pageSize: number - Items per page (default: 20, max: 100)
 * - sort: string - Sort field (createdAt, name, version, size)
 * - order: string - Sort order (asc, desc)
 * 
 * Admin: See all file resources
 * User: See only resources from their accounts
 * 
 * Excludes: apk, ipa, exe, msi, deb, rpm, dmg, pkg, app, firmware
 */
export const GET = unifiedEndpoint(
  async ({ context, event }) => {
    const { prisma, session } = context;
    const url = event.url;

    // Parse query parameters
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
    const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get('pageSize') || '20')));
    const search = url.searchParams.get('search')?.trim() || '';
    const sortField = url.searchParams.get('sort') || 'createdAt';
    const sortOrder = url.searchParams.get('order') === 'asc' ? 'asc' : 'desc';
    const formats = parseCsvList(url.searchParams.get('formats'));

    // Validate sort field
    if (!SORT_FIELDS.has(sortField)) {
      throw Object.assign(
        new Error('Invalid sort field'),
        { status: 400, code: ErrorCodes.INVALID_INPUT }
      );
    }

    // Build where clause
    const where: any = {
      // Only include file resources (not apps or firmware)
      format: {
        notIn: ['apk', 'ipa', 'exe', 'msi', 'deb', 'rpm', 'dmg', 'pkg', 'app', 'firmware']
      }
    };

    // Add search filter
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { packageName: { contains: search, mode: 'insensitive' } }
      ];
    }

    // Add format filter
    if (formats) {
      where.format = { in: formats };
    }

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

    // Calculate pagination
    const skip = (page - 1) * pageSize;
    const take = pageSize;

    // Get total count
    const totalCount = await prisma.resource.count({ where });

    // Fetch resources
    const items = await prisma.resource.findMany({
      where,
      orderBy: [{ [sortField]: sortOrder }, { id: 'asc' }],
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

    const totalPages = Math.ceil(totalCount / pageSize);

    logger.info(`[FilesAPI] Found ${items.length} file resources (page ${page}/${totalPages})`);

    return successResponse({
      items,
      meta: {
        page,
        pageSize,
        totalCount,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1
      }
    });
  },
  { permission: 'resource.view' }
);
