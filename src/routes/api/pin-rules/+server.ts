import { json } from '@sveltejs/kit';
import { logger } from '$lib/server/logger';
import { restrict } from '$lib/server/security/guards';
import type { RequestHandler } from './$types';

// GET /api/pin-rules - Get all pin rules (filtered by user permissions)
export const GET = restrict(
  async ({ url, locals, auth }: any) => {
    try {
      const { prisma } = locals;
      
      // Get query parameters
      const search = url.searchParams.get('search') || '';
      const ruleType = url.searchParams.get('ruleType') || '';
      const accountId = url.searchParams.get('accountId') || '';
      const isActive = url.searchParams.get('isActive');
      logger.info(`[PinRulesAPI][GET] incoming params: ${JSON.stringify({ search, ruleType, accountId, isActive })}`);
      logger.info(`[PinRulesAPI][GET] user context: ${JSON.stringify({ userId: auth?.user?.id, systemRole: auth?.user?.systemRole })}`);
      
      // Build where clause based on user permissions
      let whereClause: any = {};
      
      // Filter by rule type if specified
      if (ruleType) {
        whereClause.ruleType = ruleType;
      }
      
      // Filter by account if specified
      if (accountId) {
        whereClause.accountId = accountId;
      }
      
      // Filter by active status if specified
      if (isActive !== null && isActive !== undefined) {
        whereClause.isActive = isActive === 'true';
      }
      
      // Add search filter if provided
      if (search) {
        const searchConditions = [
          { name: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
          { apps: { has: search } }
        ];
        
        // If we already have other conditions, combine them with AND
        if (Object.keys(whereClause).length > 0) {
          whereClause = {
            AND: [
              whereClause,
              { OR: searchConditions }
            ]
          };
        } else {
          whereClause.OR = searchConditions;
        }
      }
      
      // Permission-based scoping
      if (auth.user.systemRole === 'ADMIN') {
        // Admins: return only admin-level rules
        logger.info('[PinRulesAPI][GET] applying ADMIN scoping (admin_default/admin_custom only)');
        const adminRuleTypes = {
          OR: [
            { ruleType: 'admin_default' },
            { ruleType: 'admin_custom' }
          ]
        };
        
        // Combine with existing whereClause
        if (Object.keys(whereClause).length > 0) {
          whereClause = {
            AND: [
              whereClause,
              adminRuleTypes
            ]
          };
        } else {
          whereClause = adminRuleTypes;
        }
      } else {
        // Non-admins: scope to account, and only see
        // - user_default for their account (all account users can see)
        // - user_custom created by themselves in their account
        logger.info('[PinRulesAPI][GET] applying NON-ADMIN scoping');
        const membership = await prisma.accountMembership.findFirst({
          where: { userId: auth.user.id },
          select: { accountId: true }
        });
        logger.info(`[PinRulesAPI][GET] membership lookup: ${JSON.stringify({ membership })}`);
        const userAccountId = membership?.accountId || '';
        logger.info(`[PinRulesAPI][GET] derived userAccountId (membership only): ${JSON.stringify({ userAccountId, fromMembership: membership?.accountId })}`);

        // If we cannot determine an account, return empty result to avoid leaking data
        if (!userAccountId) {
          logger.info(`[PinRulesAPI][GET] No account determined for non-admin; returning empty list. userId=${auth.user.id}`);
          return json({ success: true, data: { rules: [], total: 0, timestamp: new Date().toISOString() } });
        }

        // Debug: Check availability per branch before combined query
        try {
          const [cntUserDefault, cntUserCustom] = await Promise.all([
            prisma.pinRule.count({ where: { ruleType: 'user_default', accountId: userAccountId } }),
            prisma.pinRule.count({ where: { ruleType: 'user_custom', accountId: userAccountId, createdBy: auth.user.id } })
          ]);
          logger.info(`[PinRulesAPI][GET] pre-query counts: ${JSON.stringify({ userAccountId, cntUserDefault, cntUserCustom })}`);
        } catch (e) {
          logger.error('[PinRulesAPI][GET] pre-query count failed', { error: e instanceof Error ? e.message : String(e) });
        }

        whereClause = {
          ...whereClause,
          OR: [
            {
              ruleType: 'user_default',
              accountId: userAccountId
            },
            {
              ruleType: 'user_custom',
              accountId: userAccountId,
              createdBy: auth.user.id
            }
          ]
        };
      }
      logger.info(`[PinRulesAPI][GET] final whereClause: ${JSON.stringify(whereClause)}`);
        
      // Get rules based on user permissions
      const rules = await prisma.pinRule.findMany({
        where: whereClause,
        include: {
          createdByUser: {
            select: {
              id: true,
              name: true,
              email: true
            }
          },
          account: {
            select: {
              id: true,
              name: true,
              slug: true
            }
          },
          _count: {
            select: {
              userActions: true
            }
          }
        },
        orderBy: [
          { ruleType: 'desc' },
          { priority: 'desc' },
          { createdAt: 'desc' }
        ]
      });
      
      try {
        const summary = {
          count: rules.length,
          sample: rules.slice(0, 10).map((r: any) => ({ id: r.id, ruleType: r.ruleType, accountId: r.accountId, createdBy: r.createdBy }))
        };
        logger.info(`[PinRulesAPI][GET] query result summary: ${JSON.stringify(summary)}`);
      } catch {}
      
      return json({
        success: true,
        data: {
          rules,
          total: rules.length,
          timestamp: new Date().toISOString()
        }
      });
      
    } catch (error) {
      logger.error('Failed to retrieve pin rules', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      return json({
        success: false,
        error: 'Failed to retrieve pin rules',
        message: error instanceof Error ? error.message : 'Unknown error'
      }, { status: 500 });
    }
  },
  ['ADMIN', 'USER'] // Allow both admin and regular users
);

// POST /api/pin-rules - Create a new pin rule
export const POST = restrict(
  async ({ request, locals, auth }: any) => {
    try {
      const { prisma } = locals;
      const body = await request.json();
      
      // Validate required fields
      const { ruleType, name, apps, targetType, targetValue, description } = body;
      
      if (!ruleType || !name || !apps || !Array.isArray(apps)) {
        return json({
          success: false,
          error: 'Missing required fields',
          message: 'ruleType, name, and apps are required'
        }, { status: 400 });
      }
      
      // Validate rule type
      const validRuleTypes = ['admin_default', 'user_default', 'admin_custom', 'user_custom'];
      if (!validRuleTypes.includes(ruleType)) {
        return json({
          success: false,
          error: 'Invalid rule type',
          message: 'ruleType must be one of: admin_default, user_default, admin_custom, user_custom'
        }, { status: 400 });
      }
      
      // Set default priority if not provided: 1 for *_default, 2 for *_custom (higher overrides)
      const priority = typeof body.priority === 'number' 
        ? body.priority 
        : (ruleType.endsWith('_default') ? 1 : 2);
      
      // Get user's account ID for user-scoped rules
      let accountId = null;
      if (ruleType === 'user_custom' || ruleType === 'user_default') {
        const userMembership = await prisma.accountMembership.findFirst({
          where: { userId: auth.user.id },
          select: { accountId: true }
        });
        
        if (!userMembership) {
          return json({
            success: false,
            error: 'User not associated with any account',
            message: 'Cannot create user rules without account membership'
          }, { status: 400 });
        }
        
        accountId = userMembership.accountId;
      }
      
      // Create the pin rule
      const newRule = await prisma.pinRule.create({
        data: {
          ruleType,
          createdBy: auth.user.id,
          accountId,
          name,
          description,
          apps,
          targetType: targetType || 'all',
          targetValue: targetValue || [],
          priority,
          isActive: true
        },
        include: {
          createdByUser: {
            select: {
              id: true,
              name: true,
              email: true
            }
          },
          account: {
            select: {
              id: true,
              name: true,
              slug: true
            }
          }
        }
      });
      
      logger.info(`Created pin rule ${newRule.id}`, {
        ruleId: newRule.id,
        ruleType: newRule.ruleType,
        userId: auth.user.id,
        accountId: newRule.accountId
      });
      
      return json({
        success: true,
        data: {
          rule: newRule,
          message: 'Pin rule created successfully'
        }
      }, { status: 201 });
      
    } catch (error) {
      logger.error('Failed to create pin rule', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      
      return json({
        success: false,
        error: 'Failed to create pin rule',
        message: error instanceof Error ? error.message : 'Unknown error'
      }, { status: 500 });
    }
  },
  ['ADMIN', 'USER'] // Allow both admin and regular users
);
