import { logger } from '$lib/server/logger';
import type { PrismaClient } from '@prisma/client';

// Define types locally since they might not be exported from @prisma/client
interface BundleInstallSession {
  id: string;
  name: string;
  description?: string;
  status: string;
  totalDevices: number;
  totalBundles: number;
  totalBatches: number;
  completedBatches: number;
  successfulDevices: number;
  failedDevices: number;
  pendingDevices: number;
  initiatedBy: string;
  initiatedAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  estimatedDuration?: number;
  actualDuration?: number;
  metadata?: any;
  batches?: BundleInstallBatch[];
}

interface BundleInstallBatch {
  id: string;
  sessionId: string;
  batchNumber: number;
  status: string;
  deviceCount: number;
  successfulDevices: number;
  failedDevices: number;
  pendingDevices: number;
  initiatedAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  duration?: number;
  error?: string;
  metadata?: any;
}

interface BundleInstallDevice {
  id: string;
  sessionId: string;
  batchId: string;
  deviceId: string;
  status: string;
  progress: number;
  currentBundle?: string;
  currentBundleIdx: number;
  totalBundles: number;
  successfulBundles: number;
  failedBundles: number;
  initiatedAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  duration?: number;
  error?: string;
  metadata?: any;
}

interface BundleInstallBundle {
  id: string;
  sessionId: string;
  batchId: string;
  deviceId: string;
  bundleId: string;
  status: string;
  progress: number;
  message?: string;
  error?: string;
  initiatedAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  duration?: number;
  metadata?: any;
}

export interface CreateSessionRequest {
  name: string;
  description?: string;
  deviceIds: string[];
  bundleIds: string[];
  batchSize?: number;
  metadata?: Record<string, any>;
}

export interface SessionStatus {
  id: string;
  name: string;
  status: string;
  totalDevices: number;
  totalBundles: number;
  totalBatches: number;
  completedBatches: number;
  successfulDevices: number;
  failedDevices: number;
  pendingDevices: number;
  progress: number;
  estimatedDuration?: number;
  actualDuration?: number;
  initiatedAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  batches: BatchStatus[];
}

export interface BatchStatus {
  id: string;
  batchNumber: number;
  status: string;
  deviceCount: number;
  successfulDevices: number;
  failedDevices: number;
  pendingDevices: number;
  progress: number;
  initiatedAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
}

export interface DeviceStatus {
  id: string;
  deviceId: string;
  deviceName: string;
  status: string;
  progress: number;
  currentBundle?: string;
  currentBundleIdx: number;
  totalBundles: number;
  successfulBundles: number;
  failedBundles: number;
  error?: string;
  bundles: BundleStatus[];
}

export interface BundleStatus {
  id: string;
  bundleId: string;
  bundleName: string;
  status: string;
  progress: number;
  message?: string;
  error?: string;
  startedAt?: Date;
  completedAt?: Date;
}

class BundleInstallService {
  private readonly MAX_BATCH_SIZE = 500;

  async createSession(request: CreateSessionRequest, userId: string, prisma: any): Promise<BundleInstallSession> {
    const { name, description, deviceIds, bundleIds, batchSize = this.MAX_BATCH_SIZE, metadata } = request;

    // Validate devices and bundles exist
    const [devices, bundles] = await Promise.all([
      prisma.device.findMany({ where: { id: { in: deviceIds } } }),
      prisma.bundle.findMany({ where: { id: { in: bundleIds } } })
    ]);

    if (devices.length !== deviceIds.length) {
      throw new Error(`Some devices not found. Expected ${deviceIds.length}, found ${devices.length}`);
    }

    if (bundles.length !== bundleIds.length) {
      throw new Error(`Some bundles not found. Expected ${bundleIds.length}, found ${bundles.length}`);
    }

    // Calculate batches
    const totalBatches = Math.ceil(deviceIds.length / batchSize);

    // Create session
    const session = await prisma.bundleInstallSession.create({
      data: {
        name,
        description,
        totalDevices: deviceIds.length,
        totalBundles: bundleIds.length,
        totalBatches,
        pendingDevices: deviceIds.length,
        initiatedBy: userId,
        metadata: metadata || {}
      }
    });

    // Create batches
    const batches: BundleInstallBatch[] = [];
    for (let i = 0; i < totalBatches; i++) {
      const startIdx = i * batchSize;
      const endIdx = Math.min(startIdx + batchSize, deviceIds.length);
      const batchDeviceIds = deviceIds.slice(startIdx, endIdx);

      const batch = await prisma.bundleInstallBatch.create({
        data: {
          sessionId: session.id,
          batchNumber: i + 1,
          deviceCount: batchDeviceIds.length,
          pendingDevices: batchDeviceIds.length
        }
      });

      batches.push(batch);

      // Create device records for this batch
      const deviceRecords = batchDeviceIds.map(deviceId => ({
        sessionId: session.id,
        batchId: batch.id,
        deviceId,
        totalBundles: bundleIds.length
      }));

      await prisma.bundleInstallDevice.createMany({
        data: deviceRecords
      });

      // Create bundle records for each device
      const bundleRecords = batchDeviceIds.flatMap(deviceId =>
        bundleIds.map((bundleId, idx) => ({
          sessionId: session.id,
          batchId: batch.id,
          deviceId,
          bundleId,
          order: idx + 1
        }))
      );

      await prisma.bundleInstallBundle.createMany({
        data: bundleRecords
      });
    }

    logger.info(`Created bundle install session ${session.id} with ${totalBatches} batches`, {
      sessionId: session.id,
      totalDevices: deviceIds.length,
      totalBundles: bundleIds.length,
      totalBatches
    });

    return session;
  }

  async getSessionStatus(sessionId: string, prisma: any): Promise<SessionStatus | null> {
    const session = await prisma.bundleInstallSession.findUnique({
      where: { id: sessionId },
      include: {
        batches: {
          orderBy: { batchNumber: 'asc' }
        }
      }
    });

    if (!session) return null;

    const progress = session.totalBatches > 0 
      ? Math.round((session.completedBatches / session.totalBatches) * 100)
      : 0;

    const batches: BatchStatus[] = session.batches.map(batch => {
      const batchProgress = batch.deviceCount > 0
        ? Math.round(((batch.successfulDevices + batch.failedDevices) / batch.deviceCount) * 100)
        : 0;

      return {
        id: batch.id,
        batchNumber: batch.batchNumber,
        status: batch.status,
        deviceCount: batch.deviceCount,
        successfulDevices: batch.successfulDevices,
        failedDevices: batch.failedDevices,
        pendingDevices: batch.pendingDevices,
        progress: batchProgress,
        initiatedAt: batch.initiatedAt,
        startedAt: batch.startedAt,
        completedAt: batch.completedAt,
        error: batch.error
      };
    });

    return {
      id: session.id,
      name: session.name,
      status: session.status,
      totalDevices: session.totalDevices,
      totalBundles: session.totalBundles,
      totalBatches: session.totalBatches,
      completedBatches: session.completedBatches,
      successfulDevices: session.successfulDevices,
      failedDevices: session.failedDevices,
      pendingDevices: session.pendingDevices,
      progress,
      estimatedDuration: session.estimatedDuration,
      actualDuration: session.actualDuration,
      initiatedAt: session.initiatedAt,
      startedAt: session.startedAt,
      completedAt: session.completedAt,
      batches
    };
  }

  async getSessionList(filters?: {
    status?: string;
    initiatedBy?: string;
    limit?: number;
    offset?: number;
  }, prisma?: any): Promise<{ sessions: SessionStatus[]; total: number }> {
    // For now, return mock data until we fix the Prisma client issue
    const mockSessions: SessionStatus[] = [
      {
        id: 'mock-session-1',
        name: 'Test Bundle Install',
        status: 'PENDING',
        totalDevices: 10,
        totalBundles: 2,
        totalBatches: 1,
        completedBatches: 0,
        successfulDevices: 0,
        failedDevices: 0,
        pendingDevices: 10,
        progress: 0,
        initiatedAt: new Date(),
        batches: []
      }
    ];

        return { sessions: mockSessions, total: mockSessions.length };
  }

  async startSession(sessionId: string): Promise<void> {
    const session = await prisma.bundleInstallSession.findUnique({
      where: { id: sessionId },
      include: { batches: { orderBy: { batchNumber: 'asc' } } }
    });

    if (!session) {
      throw new Error('Session not found');
    }

    if (session.status !== 'PENDING') {
      throw new Error(`Session is already ${session.status.toLowerCase()}`);
    }

    // Update session status
    await prisma.bundleInstallSession.update({
      where: { id: sessionId },
      data: {
        status: 'IN_PROGRESS',
        startedAt: new Date()
      }
    });

    // Start first batch
    if (session.batches.length > 0) {
      await this.startBatch(session.batches[0].id);
    }

    logger.info(`Started bundle install session ${sessionId}`);
  }

  async startBatch(batchId: string): Promise<void> {
    const batch = await prisma.bundleInstallBatch.findUnique({
      where: { id: batchId },
      include: {
        session: true,
        devices: {
          include: {
            device: true,
            bundles: {
              include: { bundle: true },
              orderBy: { order: 'asc' }
            }
          }
        }
      }
    });

    if (!batch) {
      throw new Error('Batch not found');
    }

    if (batch.status !== 'PENDING') {
      throw new Error(`Batch is already ${batch.status.toLowerCase()}`);
    }

    // Update batch status
    await prisma.bundleInstallBatch.update({
      where: { id: batchId },
      data: {
        status: 'IN_PROGRESS',
        startedAt: new Date()
      }
    });

    // Send commands to devices
    for (const deviceRecord of batch.devices) {
      await this.sendInstallCommand(deviceRecord);
    }

    logger.info(`Started batch ${batchId} with ${batch.devices.length} devices`);
  }

  private async sendInstallCommand(deviceRecord: any): Promise<void> {
    const { device, bundles } = deviceRecord;
    
    const command = {
      type: 'bundle_install',
      sessionId: deviceRecord.sessionId,
      batchId: deviceRecord.batchId,
      deviceId: device.id,
      bundles: bundles.map((b: any) => ({
        id: b.bundle.id,
        name: b.bundle.name,
        order: b.order
      })),
      options: {
        reboot: false,
        autoOpen: false
      }
    };

    // Send via SSE
    await sseService.sendToDevice(device.id, {
      type: 'device',
      scope: `subscription:device:${device.id}`,
      payload: command
    });

    logger.debug(`Sent install command to device ${device.id}`, { command });
  }

  async updateDeviceStatus(
    sessionId: string,
    batchId: string,
    deviceId: string,
    bundleId: string,
    status: string,
    progress: number,
    message?: string,
    error?: string
  ): Promise<void> {
    const updateData: any = {
      status,
      progress,
      message,
      error
    };

    if (status === 'STARTED' && !updateData.startedAt) {
      updateData.startedAt = new Date();
    } else if (status === 'COMPLETED' || status === 'FAILED') {
      updateData.completedAt = new Date();
    }

    // Update bundle status
    await prisma.bundleInstallBundle.updateMany({
      where: {
        sessionId,
        batchId,
        deviceId,
        bundleId
      },
      data: updateData
    });

    // Update device status
    const deviceRecord = await prisma.bundleInstallDevice.findFirst({
      where: { sessionId, batchId, deviceId },
      include: { bundles: true }
    });

    if (deviceRecord) {
      const successfulBundles = deviceRecord.bundles.filter(b => b.status === 'COMPLETED').length;
      const failedBundles = deviceRecord.bundles.filter(b => b.status === 'FAILED').length;
      const currentBundle = deviceRecord.bundles.find(b => b.status === 'IN_PROGRESS');
      
      await prisma.bundleInstallDevice.update({
        where: { id: deviceRecord.id },
        data: {
          successfulBundles,
          failedBundles,
          currentBundle: currentBundle?.bundleId,
          currentBundleIdx: currentBundle?.order || 0,
          progress: Math.round((successfulBundles / deviceRecord.totalBundles) * 100)
        }
      });
    }

    // Broadcast status update
    await sseService.broadcast({
      type: 'device:bundleStatus',
      payload: {
        sessionId,
        batchId,
        deviceId,
        bundleId,
        status,
        progress,
        message,
        error
      }
    });

    logger.debug(`Updated device status`, {
      sessionId,
      batchId,
      deviceId,
      bundleId,
      status,
      progress
    });
  }

  async cancelSession(sessionId: string): Promise<void> {
    await prisma.bundleInstallSession.update({
      where: { id: sessionId },
      data: {
        status: 'CANCELLED',
        completedAt: new Date()
      }
    });

    await prisma.bundleInstallBatch.updateMany({
      where: { sessionId },
      data: {
        status: 'CANCELLED',
        completedAt: new Date()
      }
    });

    logger.info(`Cancelled bundle install session ${sessionId}`);
  }

  async retryFailedDevices(sessionId: string, deviceIds: string[]): Promise<void> {
    // Reset failed devices to pending
    await prisma.bundleInstallDevice.updateMany({
      where: {
        sessionId,
        deviceId: { in: deviceIds },
        status: 'FAILED'
      },
      data: {
        status: 'PENDING',
        progress: 0,
        error: null
      }
    });

    await prisma.bundleInstallBundle.updateMany({
      where: {
        sessionId,
        deviceId: { in: deviceIds },
        status: 'FAILED'
      },
      data: {
        status: 'PENDING',
        progress: 0,
        error: null
      }
    });

    logger.info(`Retrying ${deviceIds.length} failed devices in session ${sessionId}`);
  }

  async getSessionDevices(sessionId: string): Promise<DeviceStatus[]> {
    const devices = await prisma.bundleInstallDevice.findMany({
      where: { sessionId },
      include: {
        device: true,
        bundles: {
          include: { bundle: true },
          orderBy: { order: 'asc' }
        }
      },
      orderBy: { initiatedAt: 'asc' }
    });

    return devices.map(device => ({
      id: device.id,
      deviceId: device.deviceId,
      deviceName: device.device.name,
      status: device.status,
      progress: device.progress,
      currentBundle: device.currentBundle,
      currentBundleIdx: device.currentBundleIdx,
      totalBundles: device.totalBundles,
      successfulBundles: device.successfulBundles,
      failedBundles: device.failedBundles,
      error: device.error,
      bundles: device.bundles.map(bundle => ({
        id: bundle.id,
        bundleId: bundle.bundleId,
        bundleName: bundle.bundle.name,
        status: bundle.status,
        progress: bundle.progress,
        message: bundle.message,
        error: bundle.error,
        startedAt: bundle.startedAt,
        completedAt: bundle.completedAt
      }))
    }));
  }

  async getSessionBatches(sessionId: string): Promise<BatchStatus[]> {
    const batches = await prisma.bundleInstallBatch.findMany({
      where: { sessionId },
      orderBy: { batchNumber: 'asc' }
    });

    return batches.map(batch => ({
      id: batch.id,
      batchNumber: batch.batchNumber,
      status: batch.status,
      deviceCount: batch.deviceCount,
      successfulDevices: batch.successfulDevices,
      failedDevices: batch.failedDevices,
      pendingDevices: batch.pendingDevices,
      progress: batch.deviceCount > 0
        ? Math.round(((batch.successfulDevices + batch.failedDevices) / batch.deviceCount) * 100)
        : 0,
      initiatedAt: batch.initiatedAt,
      startedAt: batch.startedAt,
      completedAt: batch.completedAt,
      error: batch.error
    }));
  }

  async getSessionLogs(sessionId: string): Promise<any[]> {
    // For now, return mock logs. In a real implementation, you'd have a separate logs table
    const session = await prisma.bundleInstallSession.findUnique({
      where: { id: sessionId }
    });

    if (!session) {
      return [];
    }

    // Mock logs based on session data
    const logs = [
      {
        id: '1',
        level: 'INFO',
        message: `Session "${session.name}" created`,
        timestamp: session.initiatedAt,
        deviceId: null,
        bundleId: null,
        details: `Created session with ${session.totalDevices} devices and ${session.totalBundles} bundles`
      }
    ];

    if (session.startedAt) {
      logs.push({
        id: '2',
        level: 'SUCCESS',
        message: 'Session started',
        timestamp: session.startedAt,
        deviceId: null,
        bundleId: null,
        details: 'Bundle installation process initiated'
      });
    }

    if (session.completedAt) {
      logs.push({
        id: '3',
        level: 'SUCCESS',
        message: 'Session completed',
        timestamp: session.completedAt,
        deviceId: null,
        bundleId: null,
        details: `Completed with ${session.successfulDevices} successful and ${session.failedDevices} failed devices`
      });
    }

    return logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }
}

export const bundleInstallService = new BundleInstallService();
