import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { restrict } from '$lib/server/security/guards';
import { SystemRole } from '$lib/types/roles';
import { logger } from '$lib/server/logger';

const ALLOWED_FORMATS = new Set(['txt', 'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'mp4', 'avi', 'mov', 'wmv', 'mp3', 'wav', 'flac', 'zip', 'rar', '7z', 'tar', 'gz', 'json', 'xml', 'csv', 'log', 'md', 'html', 'css', 'js', 'ts', 'py', 'java', 'cpp', 'c', 'h', 'sql', 'sh', 'bat', 'ps1', 'apk', 'ipa', 'exe', 'msi', 'deb', 'rpm', 'dmg', 'pkg']);
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
 * Unified Files API Endpoint
 * 
 * Supports both ADMIN and USER roles.
 * - ADMIN: Sees all file resources across all accounts
 * - USER: Sees only file resources from their account memberships (via ZenStack access policies)
 * 
 * ZenStack's enhanced Prisma client automatically enforces access policies based on:
 * - User's system role (ADMIN vs USER)
 * - User's account memberships
 * - Resource's accountId
 */
export const GET: RequestHandler = restrict(
  async ({ url, locals }: { url: URL; locals: any }) => {
    try {
      // Parse query parameters
      const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
      const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get('pageSize') || '20')));
      const search = url.searchParams.get('search')?.trim() || '';
      const sortField = url.searchParams.get('sort') || 'createdAt';
      const sortOrder = url.searchParams.get('order') === 'asc' ? 'asc' : 'desc';
      const formats = parseCsvList(url.searchParams.get('formats'));

      // Validate sort field
      if (!SORT_FIELDS.has(sortField)) {
        return json({ success: false, error: 'Invalid sort field' }, { status: 400 });
      }

      // Build where clause
      // ZenStack will automatically filter based on access policies (account membership)
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
          { packageName: { contains: search, mode: 'insensitive' } }
        ];
      }

      // Add format filter
      if (formats) {
        where.format = { in: formats };
      }

      // Calculate pagination
      const skip = (page - 1) * pageSize;
      const take = pageSize;

      // Get total count (ZenStack automatically filters by access policies)
      const totalCount = await locals.prisma.resource.count({ where });

      // Fetch resources (ZenStack automatically filters by access policies)
      const items = await locals.prisma.resource.findMany({
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

      return json({
        success: true,
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
    } catch (err) {
      logger.error(`[ResourcesFilesAPI] Error fetching file resources: ${String(err)}`);
      return json({ success: false, error: 'Failed to fetch file resources' }, { status: 500 });
    }
  },
  [SystemRole.ADMIN, SystemRole.USER] // Allow both ADMIN and USER roles
);

