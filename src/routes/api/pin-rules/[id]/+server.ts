import { json } from '@sveltejs/kit';
import { logger } from '$lib/server/logger';
import { restrict } from '$lib/server/security/guards';
import { pinSSEService } from '$lib/server/pin-management/sseService';
import type { RequestHandler } from './$types';

// GET /api/pin-rules/[id] - Get a specific pin rule
export const GET = restrict(
  async ({ params, locals, auth }: any) => {
    try {
      const { prisma } = locals;
      const { id } = params;
      
      const rule = await prisma.pinRule.findUnique({
        where: { id },
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
          devicePins: {
            include: {
              device: {
                select: {
                  id: true,
                  name: true,
                  status: true
                }
              }
            }
          },
          userActions: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true
                }
              },
              device: {
                select: {
                  id: true,
                  name: true
                }
              }
            },
            orderBy: {
              createdAt: 'desc'
            },
            take: 10 // Last 10 actions
          },
          _count: {
            select: {
              devicePins: true,
              userActions: true
            }
          }
        }
      });
      
      if (!rule) {
        return json({
          success: false,
          error: 'Pin rule not found',
          message: 'The requested pin rule does not exist'
        }, { status: 404 });
      }
      
      // If ADMIN, restrict visibility to admin_* rules only
      if (auth.user.systemRole === 'ADMIN' && !(rule.ruleType === 'admin_default' || rule.ruleType === 'admin_custom')) {
        return json({
          success: false,
          error: 'Insufficient permissions',
          message: 'Admins can only access admin-level rules'
        }, { status: 403 });
      }

      logger.info(`Retrieved pin rule ${id} for user ${auth.user.id}`, {
        ruleId: id,
        userId: auth.user.id,
        ruleType: rule.ruleType
      });
      
      return json({
        success: true,
        data: {
          rule,
          timestamp: new Date().toISOString()
        }
      });
      
    } catch (error) {
      logger.error('Failed to retrieve pin rule', {
        error: error instanceof Error ? error.message : String(error),
        ruleId: params.id,
        stack: error instanceof Error ? error.stack : undefined
      });
      
      return json({
        success: false,
        error: 'Failed to retrieve pin rule',
        message: error instanceof Error ? error.message : 'Unknown error'
      }, { status: 500 });
    }
  },
  ['ADMIN', 'USER']
);

// PUT /api/pin-rules/[id] - Update a pin rule
export const PUT = restrict(
  async ({ params, request, locals, auth }: any) => {
    try {
      const { prisma } = locals;
      const { id } = params;
      const body = await request.json();
      
      // Get the existing rule to check permissions
      const existingRule = await prisma.pinRule.findUnique({
        where: { id },
        include: {
          account: {
            select: {
              members: {
                where: { userId: auth.user.id },
                select: { role: true }
              }
            }
          }
        }
      });
      
      if (!existingRule) {
        return json({
          success: false,
          error: 'Pin rule not found',
          message: 'The requested pin rule does not exist'
        }, { status: 404 });
      }
      
      // Check permissions
      const memberRole = existingRule.account?.members?.[0]?.role as string | undefined;
      const canEdit = 
        auth.user.systemRole === 'ADMIN' || // Admin can edit any rule
        (existingRule.ruleType === 'user_custom' && existingRule.createdBy === auth.user.id) || // User can edit their own custom rules
        (existingRule.ruleType === 'user_default' && !!memberRole && ['OWNER', 'ADMIN'].includes(memberRole)); // Account OWNER/ADMIN can edit account default rules
      
      if (!canEdit) {
        return json({
          success: false,
          error: 'Insufficient permissions',
          message: 'You do not have permission to edit this pin rule'
        }, { status: 403 });
      }
      
      // Validate update data
      const { name, description, apps, targetType, targetValue, isActive } = body;
      
      const updateData: any = {};
      
      if (name !== undefined) updateData.name = name;
      if (description !== undefined) updateData.description = description;
      if (apps !== undefined) {
        if (!Array.isArray(apps)) {
          return json({
            success: false,
            error: 'Invalid apps format',
            message: 'apps must be an array'
          }, { status: 400 });
        }
        updateData.apps = apps;
      }
      if (targetType !== undefined) updateData.targetType = targetType;
      if (targetValue !== undefined) {
        if (!Array.isArray(targetValue)) {
          return json({
            success: false,
            error: 'Invalid targetValue format',
            message: 'targetValue must be an array'
          }, { status: 400 });
        }
        updateData.targetValue = targetValue;
      }
      if (isActive !== undefined) updateData.isActive = isActive;
      
      // Update the rule
      const updatedRule = await prisma.pinRule.update({
        where: { id },
        data: updateData,
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
      
      logger.info(`Updated pin rule ${id}`, {
        ruleId: id,
        userId: auth.user.id,
        changes: Object.keys(updateData)
      });
      
      // Broadcast rule update event
      if (updatedRule.accountId) {
        pinSSEService.notifyRuleUpdated(updatedRule.accountId, updatedRule);
      } else {
        pinSSEService.notifyRuleUpdated('admin', updatedRule);
      }
      
      return json({
        success: true,
        data: {
          rule: updatedRule,
          message: 'Pin rule updated successfully'
        }
      });
      
    } catch (error) {
      logger.error('Failed to update pin rule', {
        error: error instanceof Error ? error.message : String(error),
        ruleId: params.id,
        stack: error instanceof Error ? error.stack : undefined
      });
      
      return json({
        success: false,
        error: 'Failed to update pin rule',
        message: error instanceof Error ? error.message : 'Unknown error'
      }, { status: 500 });
    }
  },
  ['ADMIN', 'USER']
);

// DELETE /api/pin-rules/[id] - Delete a pin rule
export const DELETE = restrict(
  async ({ params, locals, auth }: any) => {
    try {
      const { prisma } = locals;
      const { id } = params;
      
      // Get the existing rule to check permissions
      const existingRule = await prisma.pinRule.findUnique({
        where: { id },
        include: {
          account: {
            select: {
              members: {
                where: { userId: auth.user.id },
                select: { role: true }
              }
            }
          }
        }
      });
      
      if (!existingRule) {
        return json({
          success: false,
          error: 'Pin rule not found',
          message: 'The requested pin rule does not exist'
        }, { status: 404 });
      }
      
      // Check permissions
      const memberRole = existingRule.account?.members?.[0]?.role as string | undefined;
      const canDelete = 
        auth.user.systemRole === 'ADMIN' || // Admin can delete any rule
        (existingRule.ruleType === 'user_custom' && existingRule.createdBy === auth.user.id) || // User can delete their own custom rules
        (existingRule.ruleType === 'user_default' && !!memberRole && ['OWNER', 'ADMIN'].includes(memberRole)); // Account OWNER/ADMIN can delete account default rules
      
      if (!canDelete) {
        return json({
          success: false,
          error: 'Insufficient permissions',
          message: 'You do not have permission to delete this pin rule'
        }, { status: 403 });
      }
      
      // Prevent deletion of admin default rules
      if (existingRule.ruleType === 'admin_default' && auth.user.systemRole !== 'ADMIN') {
        return json({
          success: false,
          error: 'Cannot delete admin default rules',
          message: 'Only system administrators can delete admin default rules'
        }, { status: 403 });
      }
      
      // Delete the rule (cascade will handle related records)
      await prisma.pinRule.delete({
        where: { id }
      });
      
      logger.info(`Deleted pin rule ${id}`, {
        ruleId: id,
        userId: auth.user.id,
        ruleType: existingRule.ruleType
      });
      
      // Broadcast rule deletion event
      if (existingRule.accountId) {
        pinSSEService.notifyRuleDeleted(existingRule.accountId, id, existingRule.ruleType);
      } else {
        pinSSEService.notifyRuleDeleted('admin', id, existingRule.ruleType);
      }
      
      return json({
        success: true,
        data: {
          message: 'Pin rule deleted successfully'
        }
      });
      
    } catch (error) {
      logger.error('Failed to delete pin rule', {
        error: error instanceof Error ? error.message : String(error),
        ruleId: params.id,
        stack: error instanceof Error ? error.stack : undefined
      });
      
      return json({
        success: false,
        error: 'Failed to delete pin rule',
        message: error instanceof Error ? error.message : 'Unknown error'
      }, { status: 500 });
    }
  },
  ['ADMIN', 'USER']
);
