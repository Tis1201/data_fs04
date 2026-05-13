import { unifiedEndpoint } from '$lib/server/api/unifiedEndpoint';
import { successResponse, errorResponse } from '$lib/types/api';
import { ErrorCodes } from '$lib/types/api';

/**
 * GET /api/v2/device-profiles
 * List device profiles with pagination and filtering
 * 
 * Query params:
 * - search: string - Search in name and description
 * - status: 'all' | 'active' | 'inactive' - Filter by status
 * - limit: number - Items per page (default: 100)
 * - offset: number - Pagination offset (default: 0)
 * 
 * Admin: See all profiles
 * User: See only profiles from their accounts
 */
export const GET = unifiedEndpoint(
  async ({ context, event }) => {
    const { prisma, session, account } = context;
    const url = event.url;

    const search = url.searchParams.get('search');
    const status = url.searchParams.get('status');
    const limit = parseInt(url.searchParams.get('limit') || '100');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    // Build where clause
    const where: any = {};

    // Role-based filtering
    if (session.user.systemRole === 'USER') {
      // Users can only see profiles from accounts they're members of
      const userAccountMemberships = await prisma.accountMembership.findMany({
        where: { userId: session.user.id },
        select: { accountId: true }
      });

      const accountIds = userAccountMemberships.map((m: { accountId: string }) => m.accountId);
      
      if (accountIds.length === 0) {
        // User has no account memberships
        return successResponse({
          profiles: [],
          total: 0,
          pagination: { limit, offset, hasMore: false }
        });
      }

      where.accountId = { in: accountIds };
    }
    // Admin sees all profiles (no account filter)

    // Search filter
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } }
      ];
    }

    // Status filter
    if (status && status !== 'all') {
      if (status === 'active') {
        where.isActive = true;
      } else if (status === 'inactive') {
        where.isActive = false;
      }
    }

    // Get device profiles
    const profiles = await prisma.deviceProfile.findMany({
      where,
      select: {
        id: true,
        name: true,
        description: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        createdBy: true,
        updatedBy: true,
        account: {
          select: {
            id: true,
            name: true
          }
        },
        _count: {
          select: {
            assignments: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset
    });

    const total = await prisma.deviceProfile.count({ where });

    return successResponse({
      profiles,
      total,
      pagination: {
        limit,
        offset,
        hasMore: offset + limit < total
      }
    });
  },
  { permission: 'deviceProfile.view' }
);

/**
 * POST /api/v2/device-profiles
 * Create a new device profile
 * 
 * Body:
 * - name: string (required)
 * - description: string (optional)
 * - settings: array (required) - Array of profile settings
 * - accountId: string (required for admin, ignored for users)
 * 
 * Admin: Can create profiles for any account (must specify accountId)
 * User: Creates profile for their primary account (accountId ignored)
 */
export const POST = unifiedEndpoint(
  async ({ context, event }) => {
    const { prisma, session, account } = context;
    const body = await event.request.json();
    const { name, description, settings, accountId: requestedAccountId } = body;

    // Validate required fields
    if (!name || !settings || !Array.isArray(settings)) {
      throw Object.assign(
        new Error('Name and settings are required'),
        { status: 400, code: ErrorCodes.INVALID_INPUT }
      );
    }

    // Determine target accountId based on role
    let targetAccountId: string;

    if (session.user.systemRole === 'ADMIN') {
      // Admin must specify accountId
      if (!requestedAccountId) {
        throw Object.assign(
          new Error('Account ID is required for admin profile creation'),
          { status: 400, code: ErrorCodes.INVALID_INPUT }
        );
      }

      // Validate account exists
      const accountExists = await prisma.account.findUnique({
        where: { id: requestedAccountId },
        select: { id: true }
      });

      if (!accountExists) {
        throw Object.assign(
          new Error('Specified account not found'),
          { status: 404, code: ErrorCodes.NOT_FOUND }
        );
      }

      targetAccountId = requestedAccountId;
    } else {
      // Users use their primary account
      const userAccountMembership = await prisma.accountMembership.findFirst({
        where: {
          userId: session.user.id,
          role: { in: ['OWNER', 'ADMIN', 'MEMBER'] }
        },
        select: { accountId: true }
      });

      if (!userAccountMembership) {
        throw Object.assign(
          new Error('No account access found'),
          { status: 403, code: ErrorCodes.FORBIDDEN }
        );
      }

      targetAccountId = userAccountMembership.accountId;
    }

    // Create device profile with settings
    const profile = await prisma.deviceProfile.create({
      data: {
        name,
        description,
        accountId: targetAccountId,
        createdBy: session.user.id,
        settings: {
          create: settings.map((setting: any, index: number) => ({
            key: setting.key,
            value: setting.value,
            dataType: setting.dataType,
            label: setting.label,
            category: setting.category,
            order: setting.order ?? index
          }))
        }
      },
      include: {
        settings: {
          orderBy: { order: 'asc' }
        },
        account: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    return successResponse(
      { profile },
      { message: 'Device profile created successfully', status: 201 }
    );
  },
  { permission: 'deviceProfile.create' }
);
