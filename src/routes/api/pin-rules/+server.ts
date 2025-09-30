import { json } from '@sveltejs/kit';
import { logger } from '$lib/server/logger';
import { restrict } from '$lib/server/security/guards';
import { pinSSEService } from '$lib/server/pin-management/sseService';
import type { RequestHandler } from './$types';

// GET /api/pin-rules - Get all pin rules (filtered by user permissions)
export const GET = restrict(
  async ({ url, locals, auth }: any) => {
    try {
      const { prisma } = locals;
      
      // Get query parameters
      const ruleType = url.searchParams.get('ruleType') || '';
      const accountId = url.searchParams.get('accountId') || '';
      const isActive = url.searchParams.get('isActive');
      
      // Build where clause based on user permissions
      const whereClause: any = {};
      
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
              devicePins: true,
              userActions: true
            }
          }
        },
        orderBy: [
          { priority: 'asc' },
          { createdAt: 'desc' }
        ]
      });
      
      logger.info(`Retrieved ${rules.length} pin rules for user ${auth.user.id}`, {
        userId: auth.user.id,
        ruleType,
        accountId,
        isActive
      });
      
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
      const validRuleTypes = ['admin_default', 'account_default', 'user_custom'];
      if (!validRuleTypes.includes(ruleType)) {
        return json({
          success: false,
          error: 'Invalid rule type',
          message: 'ruleType must be one of: admin_default, account_default, user_custom'
        }, { status: 400 });
      }
      
      // Set priority based on rule type
      const priority = ruleType === 'admin_default' ? 1 : 
                     ruleType === 'account_default' ? 2 : 3;
      
      // Get user's account ID for account_default and user_custom rules
      let accountId = null;
      if (ruleType !== 'admin_default') {
        const userMembership = await prisma.accountMembership.findFirst({
          where: { userId: auth.user.id },
          select: { accountId: true }
        });
        
        if (!userMembership) {
          return json({
            success: false,
            error: 'User not associated with any account',
            message: 'Cannot create account or user rules without account membership'
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
      
      // Broadcast rule creation event
      if (newRule.accountId) {
        pinSSEService.notifyRuleCreated(newRule.accountId, newRule);
      } else {
        pinSSEService.notifyRuleCreated('admin', newRule);
      }
      
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
