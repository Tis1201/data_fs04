import { json } from '@sveltejs/kit';
import { logger } from '$lib/server/logger';
import { restrict } from '$lib/server/security/guards';
import { PinRuleEngine } from '$lib/server/pin-management/ruleEngine';
import { pinSSEService } from '$lib/server/pin-management/sseService';
import type { RequestHandler } from './$types';

// POST /api/devices/[id]/apply-rules - Apply all applicable rules to a device
export const POST = restrict(
  async ({ params, locals, auth }: any) => {
    try {
      const { prisma } = locals;
      const { id: deviceId } = params;
      
      // Get device information
      const device = await prisma.device.findUnique({
        where: { id: deviceId },
        include: {
          account: {
            select: {
              members: {
                where: { userId: auth.user.id },
                select: { role: true }
              }
            }
          },
          tags: {
            select: {
              name: true
            }
          }
          // Add appPins to see current state
        }
      });
      
      if (!device) {
        return json({
          success: false,
          error: 'Device not found',
          message: 'The requested device does not exist'
        }, { status: 404 });
      }
      
      // Check if user has permission to apply rules to this device
      const hasPermission = 
        auth.user.systemRole === 'ADMIN' ||
        device.account?.members?.[0]?.role === 'ADMIN' ||
        device.account?.members?.[0]?.role === 'MEMBER';
      
      if (!hasPermission) {
        return json({
          success: false,
          error: 'Insufficient permissions',
          message: 'You do not have permission to apply rules to this device'
        }, { status: 403 });
      }
      
      // Use the rule engine to apply rules
      const ruleEngine = new PinRuleEngine(prisma);
      const result = await ruleEngine.applyRulesToDevice(deviceId, auth.user.id);
      
      // Broadcast rule application event
      pinSSEService.notifyRuleApplied(deviceId, '', result.appliedPins, result.removedPins);
      
      return json({
        success: true,
        data: {
          deviceId,
          rulesApplied: result.rulesApplied,
          pinsApplied: result.pinsApplied,
          pinsRemoved: result.pinsRemoved,
          appliedPins: result.appliedPins,
          removedPins: result.removedPins,
          matchingRules: result.matchingRules,
          message: `Applied ${result.rulesApplied} rules successfully`
        }
      });
      
    } catch (error) {
      logger.error('Failed to apply rules to device', {
        error: error instanceof Error ? error.message : String(error),
        deviceId: params.id,
        stack: error instanceof Error ? error.stack : undefined
      });
      
      return json({
        success: false,
        error: 'Failed to apply rules to device',
        message: error instanceof Error ? error.message : 'Unknown error'
      }, { status: 500 });
    }
  },
  ['ADMIN', 'USER']
);

