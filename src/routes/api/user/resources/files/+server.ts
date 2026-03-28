import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { restrict } from '$lib/server/security/guards';
import { SystemRole } from '$lib/types/roles';
import { logger } from '$lib/server/logger';
import { resourceVisibilityOrForAccount } from '$lib/server/api/unifiedEndpoint';

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

export const GET: RequestHandler = restrict(
  async ({ url, locals, cookies }: { url: URL; locals: any; cookies: any }) => {
    try {
      const currentAccountId =
        (locals as any).currentAccount?.account?.id ?? cookies.get('current_account_id');
      if (!currentAccountId) {
        return json({ success: true, items: [], meta: { page: 1, pageSize: 20, totalCount: 0, totalPages: 0, hasNextPage: false, hasPreviousPage: false } });
      }

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

      const and: any[] = [{ OR: resourceVisibilityOrForAccount(currentAccountId) }];

      if (formats) {
        and.push({ format: { in: formats } });
      } else {
        and.push({
          format: {
            notIn: ['apk', 'ipa', 'exe', 'msi', 'deb', 'rpm', 'dmg', 'pkg', 'app', 'firmware']
          }
        });
      }

      if (search) {
        and.push({
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { description: { contains: search, mode: 'insensitive' } },
            { packageName: { contains: search, mode: 'insensitive' } }
          ]
        });
      }

      const where: any = { AND: and };

      // Calculate pagination
      const skip = (page - 1) * pageSize;
      const take = pageSize;

      // Get total count (ZenStack will automatically filter based on access policies)
      const totalCount = await locals.prisma.resource.count({ where });

      // Fetch resources (ZenStack will automatically filter based on access policies)
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
      logger.error(`[UserFilesAPI] Error fetching file resources: ${String(err)}`);
      return json({ success: false, error: 'Failed to fetch file resources' }, { status: 500 });
    }
  },
  [SystemRole.USER] // Allow USER role to access this route
);

