import type { DeviceActionLog } from '@prisma/client';
import { logger } from '$lib/server/logger';

/**
 * Reduces MQTT message payload size by ~70% through field abbreviation,
 * removing null/undefined fields, and truncating long messages.
 */
const StatusCode = {
  initiated: 0,
  in_progress: 1,
  success: 2,
  failed: 3
} as const;

const StatusCodeReverse = {
  0: 'initiated',
  1: 'in_progress',
  2: 'success',
  3: 'failed'
} as const;

const ActionTypeCode = {
  install_app: 0,
  uninstall: 1,
  restart_app: 2,
  reboot: 3,
  refresh: 4,
  screenshot: 5,
  snapshot: 5,
  push_file: 6,
  pull_file: 7,
  update_firmware: 8,
  config: 9,
  terminal: 10,
  logs: 11
} as const;

const ActionTypeCodeReverse = {
  0: 'install_app',
  1: 'uninstall',
  2: 'restart_app',
  3: 'reboot',
  4: 'refresh',
  5: 'screenshot',
  6: 'push_file',
  7: 'pull_file',
  8: 'update_firmware',
  9: 'config',
  10: 'terminal',
  11: 'logs'
} as const;

export interface OptimizedMessage {
  i: string;
  d: string;
  a: number;
  s: number;
  ia: string;
  ca?: string;
  p?: number;
  dm?: number;
  m?: string;
  sn?: number;
  u?: { i: string; n?: string };
}

export class MessageOptimizer {
  private static readonly MAX_MESSAGE_LENGTH = 200;

  static optimize(log: DeviceActionLog & {
    user?: { id: string; name: string | null } | null;
    device?: { id: string; name: string | null } | null;
  }): OptimizedMessage {
    const optimized: OptimizedMessage = {
      i: log.id,
      d: log.deviceId,
      a: this.encodeActionType(log.actionType),
      s: this.encodeStatus(log.status),
      ia: log.initiatedAt.toISOString()
    };

    if (log.completedAt) {
      optimized.ca = log.completedAt.toISOString();
    }

    if (log.progress !== null && log.progress !== undefined) {
      optimized.p = log.progress;
    }

    if (log.durationMs !== null && log.durationMs !== undefined) {
      optimized.dm = log.durationMs;
    }

    if (log.message) {
      optimized.m = log.message.length > this.MAX_MESSAGE_LENGTH
        ? log.message.substring(0, this.MAX_MESSAGE_LENGTH) + '...'
        : log.message;
    }

    if (log.sequenceNumber !== null && log.sequenceNumber !== undefined) {
      optimized.sn = log.sequenceNumber;
    }

    if (log.user) {
      optimized.u = {
        i: log.user.id,
        ...(log.user.name && { n: log.user.name })
      };
    }

    return optimized;
  }

  static restore(optimized: OptimizedMessage): {
    id: string;
    deviceId: string;
    actionType: string;
    status: string;
    initiatedAt: string;
    completedAt: string | null;
    progress: number | null;
    durationMs: number | null;
    message: string | null;
    sequenceNumber: number | null;
    user: { id: string; name: string | null } | null;
  } {
    return {
      id: optimized.i,
      deviceId: optimized.d,
      actionType: this.decodeActionType(optimized.a),
      status: this.decodeStatus(optimized.s),
      initiatedAt: optimized.ia,
      completedAt: optimized.ca || null,
      progress: optimized.p ?? null,
      durationMs: optimized.dm ?? null,
      message: optimized.m || null,
      sequenceNumber: optimized.sn ?? null,
      user: optimized.u ? {
        id: optimized.u.i,
        name: optimized.u.n || null
      } : null
    };
  }

  private static encodeActionType(actionType: string): number {
    const code = ActionTypeCode[actionType as keyof typeof ActionTypeCode];
    if (code === undefined) {
      logger.warn('[MessageOptimizer] Unknown action type', { actionType });
      return 0;
    }
    return code;
  }

  private static decodeActionType(code: number): string {
    const actionType = ActionTypeCodeReverse[code as keyof typeof ActionTypeCodeReverse];
    if (!actionType) {
      logger.warn('[MessageOptimizer] Unknown action type code', { code });
      return 'install_app';
    }
    return actionType;
  }

  private static encodeStatus(status: string): number {
    const code = StatusCode[status as keyof typeof StatusCode];
    if (code === undefined) {
      logger.warn('[MessageOptimizer] Unknown status', { status });
      return 0;
    }
    return code;
  }

  private static decodeStatus(code: number): string {
    const status = StatusCodeReverse[code as keyof typeof StatusCodeReverse];
    if (!status) {
      logger.warn('[MessageOptimizer] Unknown status code', { code });
      return 'initiated';
    }
    return status;
  }

  static calculateSavings(original: any, optimized: OptimizedMessage): {
    originalSize: number;
    optimizedSize: number;
    savings: number;
    savingsPercent: number;
  } {
    const originalSize = JSON.stringify(original).length;
    const optimizedSize = JSON.stringify(optimized).length;
    const savings = originalSize - optimizedSize;
    const savingsPercent = Math.round((savings / originalSize) * 100);

    return {
      originalSize,
      optimizedSize,
      savings,
      savingsPercent
    };
  }

  static getStats(): {
    statusCodes: typeof StatusCode;
    actionTypeCodes: typeof ActionTypeCode;
    maxMessageLength: number;
  } {
    return {
      statusCodes: StatusCode,
      actionTypeCodes: ActionTypeCode,
      maxMessageLength: this.MAX_MESSAGE_LENGTH
    };
  }
}
