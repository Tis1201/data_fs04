import { logger } from '$lib/server/logger';
import { sseManager } from '$lib/server/sse';

export interface PinUpdateEvent {
  type: 'pins_updated' | 'rule_applied' | 'rule_created' | 'rule_updated' | 'rule_deleted';
  deviceId?: string;
  ruleId?: string;
  data: {
    pinnedApps?: Array<{
      packageName: string;
      ruleId: string;
      ruleName: string;
      pinnedAt: Date;
    }>;
    appliedPins?: Array<{
      packageName: string;
      ruleId: string;
      ruleName: string;
    }>;
    removedPins?: Array<{
      packageName: string;
      previousRuleId: string;
    }>;
    rule?: {
      id: string;
      name: string;
      ruleType: string;
      apps: string[];
    };
    statistics?: {
      totalPinned: number;
      pinnedByRule: number;
      manualPins: number;
    };
  };
  timestamp: Date;
}

export class PinSSEService {
  /**
   * Broadcast pin status updates to device detail pages
   */
  static broadcastDevicePinUpdate(deviceId: string, event: PinUpdateEvent) {
    try {
      const channel = `device-${deviceId}-detail`;
      
      logger.debug(`Broadcasting pin update to device ${deviceId}`, {
        deviceId,
        eventType: event.type,
        channel
      });

      sseManager.broadcast(channel, {
        type: event.type,
        data: event.data,
        timestamp: event.timestamp
      });

    } catch (error) {
      logger.error('Failed to broadcast device pin update', {
        error: error instanceof Error ? error.message : String(error),
        deviceId,
        eventType: event.type,
        stack: error instanceof Error ? error.stack : undefined
      });
    }
  }

  /**
   * Broadcast rule updates to rule management pages
   */
  static broadcastRuleUpdate(accountId: string, event: PinUpdateEvent) {
    try {
      const channel = `account-${accountId}-pin-rules`;
      
      logger.debug(`Broadcasting rule update to account ${accountId}`, {
        accountId,
        eventType: event.type,
        channel
      });

      sseManager.broadcast(channel, {
        type: event.type,
        data: event.data,
        timestamp: event.timestamp
      });

    } catch (error) {
      logger.error('Failed to broadcast rule update', {
        error: error instanceof Error ? error.message : String(error),
        accountId,
        eventType: event.type,
        stack: error instanceof Error ? error.stack : undefined
      });
    }
  }

  /**
   * Broadcast global pin rule updates to admin users
   */
  static broadcastGlobalRuleUpdate(event: PinUpdateEvent) {
    try {
      const channel = 'admin-pin-rules';
      
      logger.debug('Broadcasting global rule update', {
        eventType: event.type,
        channel
      });

      sseManager.broadcast(channel, {
        type: event.type,
        data: event.data,
        timestamp: event.timestamp
      });

    } catch (error) {
      logger.error('Failed to broadcast global rule update', {
        error: error instanceof Error ? error.message : String(error),
        eventType: event.type,
        stack: error instanceof Error ? error.stack : undefined
      });
    }
  }

  /**
   * Notify about successful rule application
   */
  static notifyRuleApplied(deviceId: string, ruleId: string, appliedPins: any[], removedPins: any[]) {
    const event: PinUpdateEvent = {
      type: 'rule_applied',
      deviceId,
      ruleId,
      data: {
        appliedPins,
        removedPins
      },
      timestamp: new Date()
    };

    this.broadcastDevicePinUpdate(deviceId, event);
  }

  /**
   * Notify about pin status changes
   */
  static notifyPinStatusUpdate(deviceId: string, pinnedApps: any[]) {
    const event: PinUpdateEvent = {
      type: 'pins_updated',
      deviceId,
      data: {
        pinnedApps
      },
      timestamp: new Date()
    };

    this.broadcastDevicePinUpdate(deviceId, event);
  }

  /**
   * Notify about rule creation
   */
  static notifyRuleCreated(accountId: string, rule: any) {
    const event: PinUpdateEvent = {
      type: 'rule_created',
      ruleId: rule.id,
      data: {
        rule: {
          id: rule.id,
          name: rule.name,
          ruleType: rule.ruleType,
          apps: rule.apps
        }
      },
      timestamp: new Date()
    };

    if (rule.ruleType === 'admin_default') {
      this.broadcastGlobalRuleUpdate(event);
    } else {
      this.broadcastRuleUpdate(accountId, event);
    }
  }

  /**
   * Notify about rule updates
   */
  static notifyRuleUpdated(accountId: string, rule: any) {
    const event: PinUpdateEvent = {
      type: 'rule_updated',
      ruleId: rule.id,
      data: {
        rule: {
          id: rule.id,
          name: rule.name,
          ruleType: rule.ruleType,
          apps: rule.apps
        }
      },
      timestamp: new Date()
    };

    if (rule.ruleType === 'admin_default') {
      this.broadcastGlobalRuleUpdate(event);
    } else {
      this.broadcastRuleUpdate(accountId, event);
    }
  }

  /**
   * Notify about rule deletion
   */
  static notifyRuleDeleted(accountId: string, ruleId: string, ruleType: string) {
    const event: PinUpdateEvent = {
      type: 'rule_deleted',
      ruleId,
      data: {
        rule: {
          id: ruleId,
          name: '',
          ruleType,
          apps: []
        }
      },
      timestamp: new Date()
    };

    if (ruleType === 'admin_default') {
      this.broadcastGlobalRuleUpdate(event);
    } else {
      this.broadcastRuleUpdate(accountId, event);
    }
  }
}

// Export singleton instance
export const pinSSEService = PinSSEService;
