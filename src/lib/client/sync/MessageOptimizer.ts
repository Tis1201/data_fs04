/**
 * Client-side message optimizer for decoding optimized MQTT messages.
 */
const StatusCodeReverse = {
  0: 'initiated',
  1: 'in_progress',
  2: 'success',
  3: 'failed'
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

export class ClientMessageOptimizer {
  static isOptimized(message: any): message is OptimizedMessage {
    return message && typeof message.i === 'string' && typeof message.d === 'string' 
      && typeof message.a === 'number' && typeof message.s === 'number';
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

  private static decodeActionType(code: number): string {
    const actionType = ActionTypeCodeReverse[code as keyof typeof ActionTypeCodeReverse];
    if (!actionType) {
      console.warn('[ClientMessageOptimizer] Unknown action type code', { code });
      return 'install_app';
    }
    return actionType;
  }

  private static decodeStatus(code: number): string {
    const status = StatusCodeReverse[code as keyof typeof StatusCodeReverse];
    if (!status) {
      console.warn('[ClientMessageOptimizer] Unknown status code', { code });
      return 'initiated';
    }
    return status;
  }
}
