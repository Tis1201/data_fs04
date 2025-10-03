/**
 * Device App Data SSE Announcement Service
 * Handles real-time announcements for device app data changes
 */
import { sseManager } from './index';
import { logger } from '$lib/server/logger';

export interface DeviceAppAnnouncement {
  deviceId: string;
  accountId: string;
  action: 'apps_updated' | 'apps_synced' | 'apps_processed' | 'apps_error';
  appCount?: number;
  timestamp: Date;
  data?: {
    totalApps?: number;
    systemApps?: number;
    normalApps?: number;
    userApps?: number;
    lastAppSync?: Date;
    lastProcessedAt?: Date;
  };
  error?: string;
}

export class DeviceAppAnnouncer {
  /**
   * Announce device app data update
   */
  async announceAppUpdate(announcement: DeviceAppAnnouncement): Promise<void> {
    try {
      const eventData = {
        type: announcement.action,
        deviceId: announcement.deviceId,
        accountId: announcement.accountId,
        appCount: announcement.appCount,
        data: announcement.data,
        error: announcement.error,
        timestamp: announcement.timestamp
      };

      // Announce to device-specific subscribers
      await sseManager.broadcast(`device-${announcement.deviceId}-apps-changed`, eventData);
      
      // Announce to device detail page subscribers
      await sseManager.broadcast(`device-${announcement.deviceId}-detail`, eventData);
      
      // Announce to account-level subscribers
      await sseManager.broadcast(`account-${announcement.accountId}-device-apps-changed`, eventData);

      logger.debug(`Announced app update for device ${announcement.deviceId}`, {
        action: announcement.action,
        appCount: announcement.appCount
      });
    } catch (error) {
      logger.error('Failed to announce device app update', {
        error: error instanceof Error ? error.message : String(error),
        deviceId: announcement.deviceId
      });
    }
  }

  /**
   * Announce app data sync completion
   */
  async announceAppSync(deviceId: string, accountId: string, appCount: number): Promise<void> {
    await this.announceAppUpdate({
      deviceId,
      accountId,
      action: 'apps_synced',
      appCount,
      timestamp: new Date()
    });
  }

  /**
   * Announce app data processing completion
   */
  async announceAppProcessing(
    deviceId: string, 
    accountId: string, 
    data: DeviceAppAnnouncement['data']
  ): Promise<void> {
    await this.announceAppUpdate({
      deviceId,
      accountId,
      action: 'apps_processed',
      data,
      timestamp: new Date()
    });
  }

  /**
   * Announce app data processing error
   */
  async announceAppError(deviceId: string, accountId: string, error: string): Promise<void> {
    await this.announceAppUpdate({
      deviceId,
      accountId,
      action: 'apps_error',
      error,
      timestamp: new Date()
    });
  }

  /**
   * Announce bulk app updates for multiple devices
   */
  async announceBulkAppUpdates(announcements: DeviceAppAnnouncement[]): Promise<void> {
    try {
      // Group announcements by account for efficient broadcasting
      const accountGroups = new Map<string, DeviceAppAnnouncement[]>();
      
      for (const announcement of announcements) {
        if (!accountGroups.has(announcement.accountId)) {
          accountGroups.set(announcement.accountId, []);
        }
        accountGroups.get(announcement.accountId)!.push(announcement);
      }

      // Broadcast to each account
      for (const [accountId, accountAnnouncements] of accountGroups) {
        const eventData = {
          type: 'bulk_apps_updated',
          accountId,
          devices: accountAnnouncements.map(a => ({
            deviceId: a.deviceId,
            action: a.action,
            appCount: a.appCount,
            data: a.data,
            error: a.error,
            timestamp: a.timestamp
          })),
          timestamp: new Date()
        };

        await sseManager.broadcast(`account-${accountId}-device-apps-changed`, eventData);
      }

      logger.debug(`Announced bulk app updates for ${announcements.length} devices`, {
        accountCount: accountGroups.size
      });
    } catch (error) {
      logger.error('Failed to announce bulk app updates', {
        error: error instanceof Error ? error.message : String(error),
        deviceCount: announcements.length
      });
    }
  }

  /**
   * Subscribe to device app updates
   */
  async subscribeToDeviceApps(deviceId: string, connectionId: string): Promise<void> {
    try {
      // Subscribe to device-specific app updates
      await sseManager.addSubscription(`device-${deviceId}-apps-changed`, connectionId);
      await sseManager.addSubscription(`device-${deviceId}-detail`, connectionId);
      
      logger.debug(`Subscribed connection ${connectionId} to device ${deviceId} app updates`);
    } catch (error) {
      logger.error('Failed to subscribe to device app updates', {
        error: error instanceof Error ? error.message : String(error),
        deviceId,
        connectionId
      });
    }
  }

  /**
   * Subscribe to account device app updates
   */
  async subscribeToAccountDeviceApps(accountId: string, connectionId: string): Promise<void> {
    try {
      await sseManager.addSubscription(`account-${accountId}-device-apps-changed`, connectionId);
      
      logger.debug(`Subscribed connection ${connectionId} to account ${accountId} device app updates`);
    } catch (error) {
      logger.error('Failed to subscribe to account device app updates', {
        error: error instanceof Error ? error.message : String(error),
        accountId,
        connectionId
      });
    }
  }

  /**
   * Unsubscribe from device app updates
   */
  async unsubscribeFromDeviceApps(deviceId: string, connectionId: string): Promise<void> {
    try {
      await sseManager.removeSubscription(`device-${deviceId}-apps-changed`, connectionId);
      await sseManager.removeSubscription(`device-${deviceId}-detail`, connectionId);
      
      logger.debug(`Unsubscribed connection ${connectionId} from device ${deviceId} app updates`);
    } catch (error) {
      logger.error('Failed to unsubscribe from device app updates', {
        error: error instanceof Error ? error.message : String(error),
        deviceId,
        connectionId
      });
    }
  }

  /**
   * Unsubscribe from account device app updates
   */
  async unsubscribeFromAccountDeviceApps(accountId: string, connectionId: string): Promise<void> {
    try {
      await sseManager.removeSubscription(`account-${accountId}-device-apps-changed`, connectionId);
      
      logger.debug(`Unsubscribed connection ${connectionId} from account ${accountId} device app updates`);
    } catch (error) {
      logger.error('Failed to unsubscribe from account device app updates', {
        error: error instanceof Error ? error.message : String(error),
        accountId,
        connectionId
      });
    }
  }

  /**
   * Get active subscriptions for a device
   */
  async getDeviceSubscriptions(deviceId: string): Promise<string[]> {
    try {
      const subscriptions = await sseManager.getSubscriptions(`device-${deviceId}-apps-changed`);
      return subscriptions || [];
    } catch (error) {
      logger.error('Failed to get device subscriptions', {
        error: error instanceof Error ? error.message : String(error),
        deviceId
      });
      return [];
    }
  }

  /**
   * Get active subscriptions for an account
   */
  async getAccountSubscriptions(accountId: string): Promise<string[]> {
    try {
      const subscriptions = await sseManager.getSubscriptions(`account-${accountId}-device-apps-changed`);
      return subscriptions || [];
    } catch (error) {
      logger.error('Failed to get account subscriptions', {
        error: error instanceof Error ? error.message : String(error),
        accountId
      });
      return [];
    }
  }
}

// Export singleton instance
export const deviceAppAnnouncer = new DeviceAppAnnouncer();
