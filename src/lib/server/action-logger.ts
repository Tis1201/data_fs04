import prisma, { getEnhancedPrisma } from '$lib/server/prisma';
import { logger } from '$lib/server/logger';
import { SequenceGenerator } from './sync/sequenceGenerator';

export type DeviceActionType =
  | 'screenshot'
  | 'terminal'
  | 'remote_desktop'
  | 'install_app'
  | 'firmware_update'
  | 'restart'
  | 'reboot'
  | 'snapshot'
  | 'ping'
  | 'status_check'
  | 'config_update'
  | 'logs'
  | 'pull_file'
  | 'push_file'
  | 'pin_apps'
  | 'unpin_app';

export type DeviceActionStatus =
  | 'initiated'
  | 'in_progress'
  | 'success'
  | 'failed'
  | 'cancelled'
  | 'timeout';

export interface CreateActionLogInput {
  deviceId: string;
  actionType: DeviceActionType;
  initiatedBy: string;
  requestId?: string;
  connectionId?: string;
  protocol?: string;
  metadata?: Record<string, unknown>;
  initialMessage?: string;
}

export interface UpdateActionLogInput {
  logId: string;
  status?: DeviceActionStatus;
  progress?: number;
  message?: string;
  error?: string;
  metadata?: Record<string, unknown>;
}

export const ActionLogger = {
  async createInitiated(input: CreateActionLogInput) {
    const { deviceId, actionType, initiatedBy, requestId, connectionId, protocol, metadata, initialMessage } = input;

    if (!deviceId || !actionType || !initiatedBy) {
      throw new Error('Missing required fields: deviceId, actionType, initiatedBy');
    }

    const data: any = {
      deviceId,
      actionType,
      status: 'initiated' as DeviceActionStatus,
      initiatedBy,
      requestId,
      connectionId,
      protocol,
      metadata: metadata ?? undefined,
      message: initialMessage ?? undefined
    };

    const created = await (prisma as any).deviceActionLog.create({ data });
    
    logger.info('[ActionLogger] Created action log', {
      logId: created.id,
      deviceId,
      actionType
    });
    
    return created;
  },

  async findByRequestId(deviceId: string, requestId: string) {
    if (!deviceId || !requestId) return null;
    const found = await (prisma as any).deviceActionLog.findFirst({ where: { deviceId, requestId } });
    return found ?? null;
  },

  async markInProgressByRequestId(deviceId: string, requestId: string, message?: string) {
    const existing = await (prisma as any).deviceActionLog.findFirst({ where: { deviceId, requestId } });
    if (!existing) return null;
    return (prisma as any).deviceActionLog.update({ where: { id: existing.id }, data: { status: 'in_progress', message } });
  },

  async finalizeByRequestId(
    deviceId: string,
    requestId: string,
    finalStatus: Exclude<DeviceActionStatus, 'initiated' | 'in_progress'>,
    message?: string,
    error?: string,
    progress?: number
  ) {
    const existing = await (prisma as any).deviceActionLog.findFirst({ where: { deviceId, requestId } });
    if (!existing) return null;
    return this.finalize(existing.id, finalStatus, message, error, progress);
  },

  async markInProgress(logId: string, message?: string) {
    const updated = await (prisma as any).deviceActionLog.update({
      where: { id: logId },
      data: { status: 'in_progress', message }
    });
    return updated;
  },

  async updateProgress(input: UpdateActionLogInput) {
    const { logId, status, progress, message, error, metadata } = input;

    if (progress !== undefined && (progress < 0 || progress > 100)) {
      throw new Error('Progress must be between 0 and 100');
    }

    const data: any = {};
    if (status) data.status = status;
    if (progress !== undefined) data.progress = Math.floor(progress);
    if (message !== undefined) data.message = message;
    if (error !== undefined) data.error = error;
    if (metadata) data.metadata = metadata;

    const updated = await (prisma as any).deviceActionLog.update({ where: { id: logId }, data });
    return updated;
  },

  async finalize(
    logId: string,
    finalStatus: Exclude<DeviceActionStatus, 'initiated' | 'in_progress'>,
    message?: string,
    error?: string,
    progress?: number
  ) {
    const existing = await (prisma as any).deviceActionLog.findUnique({ where: { id: logId } });
    if (!existing) throw new Error(`Action log not found: ${logId}`);

    const completedAt = new Date();
    const durationMs = existing.initiatedAt ? completedAt.getTime() - new Date(existing.initiatedAt).getTime() : null;

    const updateData: any = {
      status: finalStatus,
      completedAt,
      durationMs: durationMs ?? undefined,
      message: message ?? existing.message,
      error: error ?? existing.error
    };
    if (typeof progress === 'number') {
      updateData.progress = Math.max(0, Math.min(100, Math.floor(progress)));
    }

    const updated = await (prisma as any).deviceActionLog.update({
      where: { id: logId },
      data: updateData
    });
    return updated;
  }
};
