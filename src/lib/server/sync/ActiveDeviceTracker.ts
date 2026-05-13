import { logger } from '$lib/server/logger';

/**
 * Tracks which devices users are actively viewing to enable lazy loading.
 * Only broadcasts action log updates to users who are viewing that device.
 */
interface ActiveDeviceEntry {
  userId: string;
  deviceId: string;
  lastSeen: number;
  sessionId: string;
}

export class ActiveDeviceTracker {
  private static entries = new Map<string, ActiveDeviceEntry>();
  private static deviceIndex = new Map<string, Set<string>>();
  private static cleanupTimer: NodeJS.Timeout | null = null;
  private static readonly INACTIVE_TIMEOUT_MS = 5 * 60 * 1000;

  static markActive(userId: string, deviceId: string, sessionId: string): void {
    const key = this.makeKey(userId, deviceId, sessionId);
    const now = Date.now();

    this.entries.set(key, {
      userId,
      deviceId,
      lastSeen: now,
      sessionId
    });

    if (!this.deviceIndex.has(deviceId)) {
      this.deviceIndex.set(deviceId, new Set());
    }
    this.deviceIndex.get(deviceId)!.add(`${userId}:${sessionId}`);

    if (!this.cleanupTimer) {
      this.startCleanup();
    }
  }

  static markInactive(userId: string, deviceId: string, sessionId: string): void {
    const key = this.makeKey(userId, deviceId, sessionId);
    
    this.entries.delete(key);

    const deviceUsers = this.deviceIndex.get(deviceId);
    if (deviceUsers) {
      deviceUsers.delete(`${userId}:${sessionId}`);
      if (deviceUsers.size === 0) {
        this.deviceIndex.delete(deviceId);
      }
    }
  }

  static getActiveUsers(deviceId: string): string[] {
    const deviceUsers = this.deviceIndex.get(deviceId);
    if (!deviceUsers || deviceUsers.size === 0) {
      return [];
    }

    const now = Date.now();
    const activeUsers = new Set<string>();

    for (const userSession of deviceUsers) {
      const [userId, sessionId] = userSession.split(':');
      const key = this.makeKey(userId, deviceId, sessionId);
      const entry = this.entries.get(key);

      if (entry && (now - entry.lastSeen) < this.INACTIVE_TIMEOUT_MS) {
        activeUsers.add(userId);
      }
    }

    return Array.from(activeUsers);
  }

  static hasActiveUsers(deviceId: string): boolean {
    return this.getActiveUsers(deviceId).length > 0;
  }

  /**
   * Check if device has users who were active within grace period (5 seconds).
   * Used to handle race conditions during page load.
   */
  static hasRecentlyActiveUsers(deviceId: string): boolean {
    const deviceUsers = this.deviceIndex.get(deviceId);
    if (!deviceUsers || deviceUsers.size === 0) {
      return false;
    }

    const now = Date.now();
    const GRACE_PERIOD_MS = 5000;

    for (const userSession of deviceUsers) {
      const [userId, sessionId] = userSession.split(':');
      const key = this.makeKey(userId, deviceId, sessionId);
      const entry = this.entries.get(key);

      if (entry && (now - entry.lastSeen) < GRACE_PERIOD_MS) {
        return true;
      }
    }

    return false;
  }

  static refreshActivity(userId: string, deviceId: string, sessionId: string): void {
    const key = this.makeKey(userId, deviceId, sessionId);
    const entry = this.entries.get(key);

    if (entry) {
      entry.lastSeen = Date.now();
    } else {
      this.markActive(userId, deviceId, sessionId);
    }
  }

  static getStats(): {
    totalActiveSessions: number;
    totalActiveDevices: number;
    devicesWithMultipleViewers: number;
    averageViewersPerDevice: number;
  } {
    const totalActiveSessions = this.entries.size;
    const totalActiveDevices = this.deviceIndex.size;
    
    let devicesWithMultipleViewers = 0;
    let totalViewers = 0;

    for (const deviceUsers of this.deviceIndex.values()) {
      const uniqueUsers = new Set(
        Array.from(deviceUsers).map(us => us.split(':')[0])
      );
      totalViewers += uniqueUsers.size;
      if (uniqueUsers.size > 1) {
        devicesWithMultipleViewers++;
      }
    }

    const averageViewersPerDevice = totalActiveDevices > 0 
      ? Math.round((totalViewers / totalActiveDevices) * 100) / 100 
      : 0;

    return {
      totalActiveSessions,
      totalActiveDevices,
      devicesWithMultipleViewers,
      averageViewersPerDevice
    };
  }

  private static startCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      const now = Date.now();
      let cleaned = 0;

      for (const [key, entry] of this.entries.entries()) {
        if (now - entry.lastSeen > this.INACTIVE_TIMEOUT_MS) {
          this.entries.delete(key);
          
          const deviceUsers = this.deviceIndex.get(entry.deviceId);
          if (deviceUsers) {
            deviceUsers.delete(`${entry.userId}:${entry.sessionId}`);
            if (deviceUsers.size === 0) {
              this.deviceIndex.delete(entry.deviceId);
            }
          }
          
          cleaned++;
        }
      }

      if (cleaned > 0) {
        logger.debug('[ActiveDeviceTracker] Cleaned up stale entries', {
          cleaned,
          remaining: this.entries.size
        });
      }

      if (this.entries.size === 0 && this.cleanupTimer) {
        clearInterval(this.cleanupTimer);
        this.cleanupTimer = null;
      }
    }, 60000);
  }

  static clear(): void {
    this.entries.clear();
    this.deviceIndex.clear();
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  private static makeKey(userId: string, deviceId: string, sessionId: string): string {
    return `${userId}:${deviceId}:${sessionId}`;
  }
}
