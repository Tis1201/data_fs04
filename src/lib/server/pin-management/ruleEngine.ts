import { logger } from '$lib/server/logger';
import type { PrismaClient } from '@prisma/client';

export interface PinRule {
  id: string;
  ruleType: string;
  createdBy: string;
  accountId: string | null;
  name: string;
  description: string | null;
  apps: string[];
  targetType: string | null;
  targetValue: string[];
  priority: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Device {
  id: string;
  name: string;
  accountId: string | null;
  osVersion: string | null;
  tags?: Array<{ name: string }>;
}

export interface RuleApplicationResult {
  deviceId: string;
  rulesApplied: number;
  pinsApplied: number;
  pinsRemoved: number;
  appliedPins: Array<{
    packageName: string;
    ruleId: string;
    ruleName: string;
  }>;
  removedPins: Array<{
    packageName: string;
    previousRuleId: string;
  }>;
  matchingRules: Array<{
    id: string;
    name: string;
    ruleType: string;
    priority: number;
    apps: string[];
  }>;
}

export class PinRuleEngine {
  constructor(private prisma: PrismaClient) {}

  /**
   * Apply all applicable rules to a specific device
   */
  async applyRulesToDevice(deviceId: string, userId: string): Promise<RuleApplicationResult> {
    try {
      // Get device information
      const device = await this.prisma.device.findUnique({
        where: { id: deviceId },
        include: {
          tags: {
            select: {
              name: true
            }
          }
        }
      });

      if (!device) {
        throw new Error(`Device ${deviceId} not found`);
      }

      // Get all applicable rules for the device
      const applicableRules = await this.getApplicableRules(device, userId);

      // Filter rules that match the device
      const matchingRules = applicableRules.filter(rule => 
        this.ruleMatchesDevice(rule, device)
      );

      // Compute current pins based on matching rules only (no persistence)
      const currentPinMap = new Map<string, string | null>();

      // Apply rules in priority order
      const appliedPins = [];
      const removedPins = [];

      for (const rule of matchingRules) {
        for (const packageName of rule.apps) {
          const currentRuleId = currentPinMap.get(packageName) || null;
          if (currentRuleId !== rule.id) {
            if (currentRuleId) {
              removedPins.push({ packageName, previousRuleId: currentRuleId });
            }
            appliedPins.push({ packageName, ruleId: rule.id, ruleName: rule.name });
            // Record user action
            await this.prisma.userAppAction.create({
              data: { userId, deviceId, action: 'pin', packageName, ruleId: rule.id }
            });
            currentPinMap.set(packageName, rule.id);
          }
        }
      }

      logger.info(`Applied ${matchingRules.length} rules to device ${deviceId}`, {
        deviceId,
        userId,
        rulesApplied: matchingRules.length,
        pinsApplied: appliedPins.length,
        pinsRemoved: removedPins.length
      });

      return {
        deviceId,
        rulesApplied: matchingRules.length,
        pinsApplied: appliedPins.length,
        pinsRemoved: removedPins.length,
        appliedPins,
        removedPins,
        matchingRules: matchingRules.map(rule => ({
          id: rule.id,
          name: rule.name,
          ruleType: rule.ruleType,
          priority: rule.priority,
          apps: rule.apps
        }))
      };

    } catch (error) {
      logger.error('Failed to apply rules to device', {
        error: error instanceof Error ? error.message : String(error),
        deviceId,
        userId,
        stack: error instanceof Error ? error.stack : undefined
      });
      throw error;
    }
  }

  /**
   * Apply a specific rule to all matching devices
   */
  async applyRuleToDevices(ruleId: string, userId: string): Promise<{
    ruleId: string;
    devicesProcessed: number;
    pinsApplied: number;
    errors: string[];
  }> {
    try {
      const rule = await this.prisma.pinRule.findUnique({
        where: { id: ruleId }
      });

      if (!rule) {
        throw new Error(`Rule ${ruleId} not found`);
      }

      if (!rule.isActive) {
        throw new Error(`Rule ${ruleId} is not active`);
      }

      // Find all devices that match this rule
      const matchingDevices = await this.findMatchingDevices(rule);

      const results = {
        ruleId,
        devicesProcessed: 0,
        pinsApplied: 0,
        errors: [] as string[]
      };

      // Apply rule to each matching device
      for (const device of matchingDevices) {
        try {
          const result = await this.applyRulesToDevice(device.id, userId);
          results.devicesProcessed++;
          results.pinsApplied += result.pinsApplied;
        } catch (error) {
          const errorMsg = `Failed to apply rule to device ${device.id}: ${error instanceof Error ? error.message : String(error)}`;
          results.errors.push(errorMsg);
          logger.error(errorMsg, { ruleId, deviceId: device.id, error });
        }
      }

      logger.info(`Applied rule ${ruleId} to ${results.devicesProcessed} devices`, {
        ruleId,
        userId,
        devicesProcessed: results.devicesProcessed,
        pinsApplied: results.pinsApplied,
        errors: results.errors.length
      });

      return results;

    } catch (error) {
      logger.error('Failed to apply rule to devices', {
        error: error instanceof Error ? error.message : String(error),
        ruleId,
        userId,
        stack: error instanceof Error ? error.stack : undefined
      });
      throw error;
    }
  }

  /**
   * Get all applicable rules for a device based on user permissions
   */
  private async getApplicableRules(device: Device, userId: string): Promise<PinRule[]> {
    return await this.prisma.pinRule.findMany({
      where: {
        isActive: true,
        OR: [
          { ruleType: 'admin_custom' },
          { 
            ruleType: 'user_custom',
            accountId: device.accountId,
            createdBy: userId // Only current user's custom rules
          }
        ]
      },
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'desc' }
      ] // higher number has higher precedence; latest created wins on tie; 1 is lowest
    });
  }

  /**
   * Check if a rule matches a device based on targeting criteria
   */
  private ruleMatchesDevice(rule: PinRule, device: Device): boolean {
    if (rule.targetType === 'all') {
      return true;
    }

    if (rule.targetType === 'tags') {
      const deviceTags = device.tags?.map(tag => tag.name) || [];
      return rule.targetValue.some(targetTag => 
        deviceTags.includes(targetTag)
      );
    }

    if (rule.targetType === 'os') {
      const deviceOS = device.osVersion?.split('.')[0] || '';
      return rule.targetValue.some(targetOS => 
        deviceOS.includes(targetOS)
      );
    }

    if (rule.targetType === 'devices') {
      return rule.targetValue.includes(device.id);
    }

    return false;
  }

  /**
   * Find all devices that match a specific rule
   */
  private async findMatchingDevices(rule: PinRule): Promise<Device[]> {
    const whereClause: any = {};

    if (rule.targetType === 'all') {
      // All devices in the account (or all devices for admin rules)
      if (rule.accountId) {
        whereClause.accountId = rule.accountId;
      }
    } else if (rule.targetType === 'tags') {
      // Devices with specific tags
      whereClause.tags = {
        some: {
          name: {
            in: rule.targetValue
          }
        }
      };
      if (rule.accountId) {
        whereClause.accountId = rule.accountId;
      }
    } else if (rule.targetType === 'os') {
      // Devices with specific OS
      whereClause.osVersion = {
        startsWith: rule.targetValue[0] // Assuming first target is the OS
      };
      if (rule.accountId) {
        whereClause.accountId = rule.accountId;
      }
    } else if (rule.targetType === 'devices') {
      // Specific devices
      whereClause.id = {
        in: rule.targetValue
      };
    }

    return await this.prisma.device.findMany({
      where: whereClause,
      include: {
        tags: {
          select: {
            name: true
          }
        }
      }
    });
  }

  /**
   * Get rule statistics for a specific rule
   */
  async getRuleStatistics(ruleId: string): Promise<{
    ruleId: string;
    totalDevices: number;
    pinnedApps: number;
    lastApplied: Date | null;
    successRate: number;
  }> {
    try {
      const rule = await this.prisma.pinRule.findUnique({
        where: { id: ruleId }
      });

      if (!rule) {
        throw new Error(`Rule ${ruleId} not found`);
      }

      // Get matching devices count
      const matchingDevices = await this.findMatchingDevices(rule);
      const totalDevices = matchingDevices.length;

      // Estimate pinned apps count by counting user actions for this rule (best-effort)
      const pinnedApps = await this.prisma.userAppAction.count({
        where: { ruleId, action: 'pin' }
      });

      // Get last applied date
      const lastAction = await this.prisma.userAppAction.findFirst({
        where: {
          ruleId
        },
        orderBy: {
          createdAt: 'desc'
        },
        select: {
          createdAt: true
        }
      });

      // Calculate success rate (simplified - could be more sophisticated)
      const successRate = totalDevices > 0 ? (pinnedApps / (totalDevices * rule.apps.length)) * 100 : 0;

      return {
        ruleId,
        totalDevices,
        pinnedApps,
        lastApplied: lastAction?.createdAt || null,
        successRate: Math.min(successRate, 100)
      };

    } catch (error) {
      logger.error('Failed to get rule statistics', {
        error: error instanceof Error ? error.message : String(error),
        ruleId,
        stack: error instanceof Error ? error.stack : undefined
      });
      throw error;
    }
  }
}

// Export class - instance will be created with prisma instance
