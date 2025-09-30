import { json } from '@sveltejs/kit';
import { logger } from '$lib/server/logger';
import { restrict } from '$lib/server/security/guards';
import { pinSSEService } from '$lib/server/pin-management/sseService';
import type { RequestHandler } from './$types';

// GET /api/devices/[id]/pins - Get current pins for a device
export const GET = restrict(
  async ({ params, locals, auth }: any) => {
    try {
      const { prisma } = locals;
      const { id: deviceId } = params;
      
      // Get device pins with rule information
      const pins = await prisma.deviceAppPin.findMany({
        where: { deviceId },
        include: {
          rule: {
            select: {
              id: true,
              name: true,
              ruleType: true,
              createdBy: true,
              createdByUser: {
                select: {
                  name: true,
                  email: true
                }
              }
            }
          }
        },
        orderBy: {
          pinnedAt: 'desc'
        }
      });
      
      // Get device information
      const device = await prisma.device.findUnique({
        where: { id: deviceId },
        select: {
          id: true,
          name: true,
          status: true,
          accountId: true,
          account: {
            select: {
              name: true
            }
          }
        }
      });
      
      if (!device) {
        return json({
          success: false,
          error: 'Device not found',
          message: 'The requested device does not exist'
        }, { status: 404 });
      }
      
      logger.info(`Retrieved ${pins.length} pins for device ${deviceId}`, {
        deviceId,
        userId: auth.user.id,
        pinCount: pins.length
      });
      
      return json({
        success: true,
        data: {
          device,
          pins,
          total: pins.length,
          timestamp: new Date().toISOString()
        }
      });
      
    } catch (error) {
      logger.error('Failed to retrieve device pins', {
        error: error instanceof Error ? error.message : String(error),
        deviceId: params.id,
        stack: error instanceof Error ? error.stack : undefined
      });
      
      return json({
        success: false,
        error: 'Failed to retrieve device pins',
        message: error instanceof Error ? error.message : 'Unknown error'
      }, { status: 500 });
    }
  },
  ['ADMIN', 'USER']
);

// POST /api/devices/[id]/pins - Pin/unpin an app on a device
export const POST = restrict(
  async ({ params, request, locals, auth }: any) => {
    try {
      const { prisma } = locals;
      const { id: deviceId } = params;
      const body = await request.json();
      
      const { packageName, action } = body;
      
      // Validate required fields
      if (!packageName || !action) {
        return json({
          success: false,
          error: 'Missing required fields',
          message: 'packageName and action are required'
        }, { status: 400 });
      }
      
      // Validate action
      if (!['pin', 'unpin'].includes(action)) {
        return json({
          success: false,
          error: 'Invalid action',
          message: 'action must be either "pin" or "unpin"'
        }, { status: 400 });
      }
      
      // Check if device exists and user has access
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
          }
        }
      });
      
      if (!device) {
        return json({
          success: false,
          error: 'Device not found',
          message: 'The requested device does not exist'
        }, { status: 404 });
      }
      
      // Check if user has permission to manage pins on this device
      const hasPermission = 
        auth.user.systemRole === 'ADMIN' ||
        device.account?.members?.[0]?.role === 'ADMIN' ||
        device.account?.members?.[0]?.role === 'MEMBER';
      
      if (!hasPermission) {
        return json({
          success: false,
          error: 'Insufficient permissions',
          message: 'You do not have permission to manage pins on this device'
        }, { status: 403 });
      }
      
      if (action === 'pin') {
        // Pin the app
        const existingPin = await prisma.deviceAppPin.findUnique({
          where: {
            device_id_package_name: {
              deviceId,
              packageName
            }
          }
        });
        
        if (existingPin) {
          return json({
            success: false,
            error: 'App already pinned',
            message: 'This app is already pinned on the device'
          }, { status: 409 });
        }
        
        const newPin = await prisma.deviceAppPin.create({
          data: {
            deviceId,
            packageName,
            pinnedByRuleId: null, // Manual pin (not from rule)
            pinnedAt: new Date()
          },
          include: {
            rule: {
              select: {
                id: true,
                name: true,
                ruleType: true
              }
            }
          }
        });
        
        // Record user action
        await prisma.userAppAction.create({
          data: {
            userId: auth.user.id,
            deviceId,
            action: 'pin',
            packageName,
            ruleId: null // Manual action
          }
        });
        
        logger.info(`Pinned app ${packageName} on device ${deviceId}`, {
          deviceId,
          packageName,
          userId: auth.user.id,
          pinId: newPin.id
        });
        
        // Broadcast pin status update
        pinSSEService.notifyPinStatusUpdate(deviceId, [{
          packageName,
          ruleId: newPin.rule?.id,
          ruleName: newPin.rule?.name || 'Manual',
          pinnedAt: newPin.pinnedAt
        }]);
        
        return json({
          success: true,
          data: {
            pin: newPin,
            message: 'App pinned successfully'
          }
        });
        
      } else if (action === 'unpin') {
        // Unpin the app
        const existingPin = await prisma.deviceAppPin.findUnique({
          where: {
            device_id_package_name: {
              deviceId,
              packageName
            }
          }
        });
        
        if (!existingPin) {
          return json({
            success: false,
            error: 'App not pinned',
            message: 'This app is not currently pinned on the device'
          }, { status: 404 });
        }
        
        await prisma.deviceAppPin.delete({
          where: {
            device_id_package_name: {
              deviceId,
              packageName
            }
          }
        });
        
        // Record user action
        await prisma.userAppAction.create({
          data: {
            userId: auth.user.id,
            deviceId,
            action: 'unpin',
            packageName,
            ruleId: existingPin.pinnedByRuleId
          }
        });
        
        logger.info(`Unpinned app ${packageName} from device ${deviceId}`, {
          deviceId,
          packageName,
          userId: auth.user.id,
          previousRuleId: existingPin.pinnedByRuleId
        });
        
        // Broadcast pin status update
        pinSSEService.notifyPinStatusUpdate(deviceId, []);
        
        return json({
          success: true,
          data: {
            message: 'App unpinned successfully'
          }
        });
      }
      
    } catch (error) {
      logger.error('Failed to manage device pin', {
        error: error instanceof Error ? error.message : String(error),
        deviceId: params.id,
        stack: error instanceof Error ? error.stack : undefined
      });
      
      return json({
        success: false,
        error: 'Failed to manage device pin',
        message: error instanceof Error ? error.message : 'Unknown error'
      }, { status: 500 });
    }
  },
  ['ADMIN', 'USER']
);
