import { logger } from '$lib/server/logger';
import { prisma } from '$lib/server/prisma';
import { sseService } from '../sse/sseService';

export interface ErrorContext {
  sessionId: string;
  batchId?: string;
  deviceId?: string;
  bundleId?: string;
  errorType: 'DEVICE' | 'BATCH' | 'SESSION' | 'NETWORK' | 'TIMEOUT' | 'VALIDATION';
  errorCode: string;
  errorMessage: string;
  retryCount: number;
  maxRetries: number;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface RetryStrategy {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  jitter: boolean;
}

export interface CircuitBreakerConfig {
  failureThreshold: number;
  recoveryTimeout: number;
  halfOpenMaxRequests: number;
}

class BundleInstallErrorHandler {
  private readonly DEFAULT_RETRY_STRATEGY: RetryStrategy = {
    maxRetries: 3,
    baseDelay: 1000, // 1 second
    maxDelay: 30000, // 30 seconds
    backoffMultiplier: 2,
    jitter: true
  };

  private readonly DEFAULT_CIRCUIT_BREAKER: CircuitBreakerConfig = {
    failureThreshold: 5,
    recoveryTimeout: 60000, // 1 minute
    halfOpenMaxRequests: 3
  };

  private circuitBreakers: Map<string, CircuitBreakerState> = new Map();

  async handleError(error: Error, context: ErrorContext): Promise<boolean> {
    logger.error('Bundle install error occurred', {
      error: error.message,
      context
    });

    // Log error to database
    await this.logError(error, context);

    // Determine recovery strategy based on error type
    switch (context.errorType) {
      case 'DEVICE':
        return await this.handleDeviceError(error, context);
      
      case 'BATCH':
        return await this.handleBatchError(error, context);
      
      case 'SESSION':
        return await this.handleSessionError(error, context);
      
      case 'NETWORK':
        return await this.handleNetworkError(error, context);
      
      case 'TIMEOUT':
        return await this.handleTimeoutError(error, context);
      
      case 'VALIDATION':
        return await this.handleValidationError(error, context);
      
      default:
        return await this.handleGenericError(error, context);
    }
  }

  private async handleDeviceError(error: Error, context: ErrorContext): Promise<boolean> {
    const { deviceId, sessionId, batchId } = context;

    if (!deviceId) {
      logger.error('Device error without device ID', { context });
      return false;
    }

    // Check circuit breaker for device
    const circuitKey = `device:${deviceId}`;
    if (this.isCircuitBreakerOpen(circuitKey)) {
      logger.warn(`Circuit breaker open for device ${deviceId}`, { context });
      return false;
    }

    // Update device status to failed
    await prisma.bundleInstallDevice.updateMany({
      where: { sessionId, batchId, deviceId },
      data: {
        status: 'FAILED',
        error: error.message,
        completedAt: new Date()
      }
    });

    // Record failure in circuit breaker
    this.recordFailure(circuitKey);

    // Attempt retry if within limits
    if (context.retryCount < context.maxRetries) {
      return await this.retryDeviceOperation(context);
    }

    // Mark device as permanently failed
    await this.markDevicePermanentlyFailed(deviceId, sessionId, batchId, error.message);
    return false;
  }

  private async handleBatchError(error: Error, context: ErrorContext): Promise<boolean> {
    const { batchId, sessionId } = context;

    if (!batchId) {
      logger.error('Batch error without batch ID', { context });
      return false;
    }

    // Update batch status
    await prisma.bundleInstallBatch.update({
      where: { id: batchId },
      data: {
        status: 'FAILED',
        error: error.message,
        completedAt: new Date()
      }
    });

    // Check if we should retry the batch
    if (context.retryCount < context.maxRetries) {
      return await this.retryBatchOperation(context);
    }

    // Mark batch as permanently failed
    await this.markBatchPermanentlyFailed(batchId, error.message);
    return false;
  }

  private async handleSessionError(error: Error, context: ErrorContext): Promise<boolean> {
    const { sessionId } = context;

    // Update session status
    await prisma.bundleInstallSession.update({
      where: { id: sessionId },
      data: {
        status: 'FAILED',
        completedAt: new Date()
      }
    });

    // Broadcast session failure
    await sseService.broadcast({
      type: 'session:failed',
      payload: {
        sessionId,
        error: error.message,
        timestamp: new Date()
      }
    });

    logger.error(`Session ${sessionId} failed permanently`, { context });
    return false;
  }

  private async handleNetworkError(error: Error, context: ErrorContext): Promise<boolean> {
    // Network errors are transient, retry with exponential backoff
    if (context.retryCount < context.maxRetries) {
      const delay = this.calculateRetryDelay(context.retryCount);
      
      logger.info(`Retrying network operation after ${delay}ms`, { context });
      
      setTimeout(async () => {
        await this.retryOperation(context);
      }, delay);
      
      return true; // Indicate retry is scheduled
    }

    // If max retries exceeded, treat as permanent failure
    return await this.handleGenericError(error, context);
  }

  private async handleTimeoutError(error: Error, context: ErrorContext): Promise<boolean> {
    // Timeout errors might be due to slow devices, increase timeout for retry
    if (context.retryCount < context.maxRetries) {
      const delay = this.calculateRetryDelay(context.retryCount);
      
      logger.info(`Retrying timeout operation after ${delay}ms`, { context });
      
      setTimeout(async () => {
        await this.retryOperation(context);
      }, delay);
      
      return true;
    }

    return await this.handleGenericError(error, context);
  }

  private async handleValidationError(error: Error, context: ErrorContext): Promise<boolean> {
    // Validation errors are usually permanent, no retry
    logger.error('Validation error - no retry attempted', { context });
    return false;
  }

  private async handleGenericError(error: Error, context: ErrorContext): Promise<boolean> {
    logger.error('Generic error handled', { context });
    
    // Log the error and mark as failed
    await this.logError(error, context);
    return false;
  }

  private async retryDeviceOperation(context: ErrorContext): Promise<boolean> {
    const { deviceId, sessionId, batchId, retryCount } = context;
    
    const delay = this.calculateRetryDelay(retryCount);
    
    logger.info(`Retrying device operation for ${deviceId} after ${delay}ms`, {
      sessionId,
      batchId,
      retryCount
    });

    setTimeout(async () => {
      try {
        // Reset device status to pending for retry
        await prisma.bundleInstallDevice.updateMany({
          where: { sessionId, batchId, deviceId },
          data: {
            status: 'PENDING',
            error: null,
            progress: 0
          }
        });

        // Trigger retry logic in bundle install service
        // This would typically involve re-sending the command to the device
        logger.info(`Device ${deviceId} retry initiated`, { sessionId, batchId });
        
      } catch (retryError) {
        logger.error(`Device retry failed for ${deviceId}`, { 
          sessionId, 
          batchId, 
          error: retryError.message 
        });
      }
    }, delay);

    return true;
  }

  private async retryBatchOperation(context: ErrorContext): Promise<boolean> {
    const { batchId, sessionId, retryCount } = context;
    
    const delay = this.calculateRetryDelay(retryCount);
    
    logger.info(`Retrying batch operation for ${batchId} after ${delay}ms`, {
      sessionId,
      retryCount
    });

    setTimeout(async () => {
      try {
        // Reset batch status to pending for retry
        await prisma.bundleInstallBatch.update({
          where: { id: batchId },
          data: {
            status: 'PENDING',
            error: null
          }
        });

        // Trigger batch retry logic
        logger.info(`Batch ${batchId} retry initiated`, { sessionId });
        
      } catch (retryError) {
        logger.error(`Batch retry failed for ${batchId}`, { 
          sessionId, 
          error: retryError.message 
        });
      }
    }, delay);

    return true;
  }

  private async retryOperation(context: ErrorContext): Promise<void> {
    // Generic retry logic
    const newContext = {
      ...context,
      retryCount: context.retryCount + 1
    };

    logger.info(`Retrying operation`, { newContext });
    
    // This would trigger the appropriate retry logic based on context
    // Implementation depends on the specific operation being retried
  }

  private calculateRetryDelay(retryCount: number): number {
    const { baseDelay, maxDelay, backoffMultiplier, jitter } = this.DEFAULT_RETRY_STRATEGY;
    
    let delay = baseDelay * Math.pow(backoffMultiplier, retryCount);
    
    if (delay > maxDelay) {
      delay = maxDelay;
    }
    
    if (jitter) {
      // Add random jitter to prevent thundering herd
      const jitterAmount = delay * 0.1;
      delay += Math.random() * jitterAmount;
    }
    
    return Math.floor(delay);
  }

  private async logError(error: Error, context: ErrorContext): Promise<void> {
    try {
      await prisma.bundleInstallError.create({
        data: {
          sessionId: context.sessionId,
          batchId: context.batchId,
          deviceId: context.deviceId,
          bundleId: context.bundleId,
          errorType: context.errorType,
          errorCode: context.errorCode,
          errorMessage: context.errorMessage,
          retryCount: context.retryCount,
          maxRetries: context.maxRetries,
          timestamp: context.timestamp,
          metadata: context.metadata || {}
        }
      });
    } catch (logError) {
      logger.error('Failed to log error to database', { 
        originalError: error.message,
        logError: logError.message 
      });
    }
  }

  private async markDevicePermanentlyFailed(
    deviceId: string, 
    sessionId: string, 
    batchId: string, 
    errorMessage: string
  ): Promise<void> {
    await prisma.bundleInstallDevice.updateMany({
      where: { sessionId, batchId, deviceId },
      data: {
        status: 'FAILED',
        error: `Permanent failure: ${errorMessage}`,
        completedAt: new Date()
      }
    });

    logger.error(`Device ${deviceId} marked as permanently failed`, {
      sessionId,
      batchId,
      errorMessage
    });
  }

  private async markBatchPermanentlyFailed(batchId: string, errorMessage: string): Promise<void> {
    await prisma.bundleInstallBatch.update({
      where: { id: batchId },
      data: {
        status: 'FAILED',
        error: `Permanent failure: ${errorMessage}`,
        completedAt: new Date()
      }
    });

    logger.error(`Batch ${batchId} marked as permanently failed`, { errorMessage });
  }

  // Circuit Breaker Implementation
  private isCircuitBreakerOpen(key: string): boolean {
    const state = this.circuitBreakers.get(key);
    if (!state) return false;

    const now = Date.now();

    switch (state.status) {
      case 'OPEN':
        if (now - state.lastFailureTime > this.DEFAULT_CIRCUIT_BREAKER.recoveryTimeout) {
          state.status = 'HALF_OPEN';
          state.halfOpenRequests = 0;
          return false;
        }
        return true;

      case 'HALF_OPEN':
        if (state.halfOpenRequests >= this.DEFAULT_CIRCUIT_BREAKER.halfOpenMaxRequests) {
          state.status = 'OPEN';
          return true;
        }
        return false;

      case 'CLOSED':
      default:
        return false;
    }
  }

  private recordFailure(key: string): void {
    let state = this.circuitBreakers.get(key);
    
    if (!state) {
      state = {
        status: 'CLOSED',
        failureCount: 0,
        lastFailureTime: 0,
        halfOpenRequests: 0
      };
    }

    state.failureCount++;
    state.lastFailureTime = Date.now();

    if (state.failureCount >= this.DEFAULT_CIRCUIT_BREAKER.failureThreshold) {
      state.status = 'OPEN';
    }

    this.circuitBreakers.set(key, state);
  }

  private recordSuccess(key: string): void {
    const state = this.circuitBreakers.get(key);
    if (state) {
      state.status = 'CLOSED';
      state.failureCount = 0;
      state.halfOpenRequests = 0;
      this.circuitBreakers.set(key, state);
    }
  }

  // Error Recovery Methods
  async recoverDevice(deviceId: string, sessionId: string): Promise<boolean> {
    try {
      // Reset device status and retry
      await prisma.bundleInstallDevice.updateMany({
        where: { sessionId, deviceId, status: 'FAILED' },
        data: {
          status: 'PENDING',
          error: null,
          progress: 0,
          retryCount: 0
        }
      });

      // Reset circuit breaker
      this.recordSuccess(`device:${deviceId}`);

      logger.info(`Device ${deviceId} recovered and ready for retry`, { sessionId });
      return true;

    } catch (error) {
      logger.error(`Failed to recover device ${deviceId}`, { sessionId, error: error.message });
      return false;
    }
  }

  async recoverBatch(batchId: string): Promise<boolean> {
    try {
      // Reset batch status and retry
      await prisma.bundleInstallBatch.update({
        where: { id: batchId },
        data: {
          status: 'PENDING',
          error: null
        }
      });

      logger.info(`Batch ${batchId} recovered and ready for retry`);
      return true;

    } catch (error) {
      logger.error(`Failed to recover batch ${batchId}`, { error: error.message });
      return false;
    }
  }

  // Error Analysis and Reporting
  async getErrorSummary(sessionId: string): Promise<any> {
    const errors = await prisma.bundleInstallError.findMany({
      where: { sessionId },
      orderBy: { timestamp: 'desc' }
    });

    const summary = {
      totalErrors: errors.length,
      byType: {} as Record<string, number>,
      byDevice: {} as Record<string, number>,
      byBatch: {} as Record<string, number>,
      recentErrors: errors.slice(0, 10)
    };

    errors.forEach(error => {
      summary.byType[error.errorType] = (summary.byType[error.errorType] || 0) + 1;
      
      if (error.deviceId) {
        summary.byDevice[error.deviceId] = (summary.byDevice[error.deviceId] || 0) + 1;
      }
      
      if (error.batchId) {
        summary.byBatch[error.batchId] = (summary.byBatch[error.batchId] || 0) + 1;
      }
    });

    return summary;
  }
}

interface CircuitBreakerState {
  status: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  failureCount: number;
  lastFailureTime: number;
  halfOpenRequests: number;
}

export const bundleInstallErrorHandler = new BundleInstallErrorHandler();
