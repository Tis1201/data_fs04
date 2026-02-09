import { unifiedEndpoint } from '$lib/server/api/unifiedEndpoint';
import { successResponse } from '$lib/types/api';
import { ErrorCodes } from '$lib/types/api';

/**
 * GET /api/v2/device-tags
 * List all device tags for the user's account(s)
 * 
 * Admin: See tags from all accounts (or filter by currentAccount if set)
 * User: See tags from their current account
 * 
 * Returns tags with default color
 */
export const GET = unifiedEndpoint(
  async ({ context }) => {
    const { prisma, session, account } = context;

    // Determine which account(s) to query
    let accountFilter: any = {};

    if (session.user.systemRole === 'ADMIN') {
      // Admin can optionally filter by current account
      if (account?.id) {
        accountFilter.accountId = account.id;
      }
      // Otherwise, see all tags
    } else {
      // Regular users need a current account
      if (!account?.id) {
        throw Object.assign(
          new Error('No current account selected'),
          { status: 400, code: ErrorCodes.INVALID_INPUT }
        );
      }
      accountFilter.accountId = account.id;
    }

    // Get device tags
    const tags = await prisma.deviceTag.findMany({
      where: accountFilter,
      select: {
        id: true,
        name: true,
        description: true,
        accountId: true
      },
      orderBy: {
        name: 'asc'
      }
    });

    // Add default color for each tag (model doesn't have color field)
    const tagsWithColor = tags.map((tag: any) => ({
      ...tag,
      color: '#6b7280' // Default gray color
    }));

    return successResponse({
      tags: tagsWithColor,
      total: tagsWithColor.length
    });
  }
  // TODO: re-enable when permission is granted: { permission: 'deviceTag.view' }
);

