import { logger } from '$lib/server/logger';

/**
 * Circuit breaker pattern to prevent cascading failures.
 * Stops operations when a service is unhealthy.
 */
export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN'
}

export interface CircuitBreakerOptions {
  failureThreshold: number;
  successThreshold: number;
  timeout: number;
  resetTimeout: number;
  name: string;
}

export class CircuitBreaker<T = any> {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private successCount = 0;
  private nextAttempt = 0;
  private stateChangeTime = Date.now();

  constructor(
    private readonly action: () => Promise<T>,
    private readonly options: CircuitBreakerOptions
  ) {
    logger.debug('[CircuitBreaker] Initialized', {
      name: options.name,
      failureThreshold: options.failureThreshold,
      resetTimeout: options.resetTimeout
    });
  }

  async execute(): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (Date.now() < this.nextAttempt) {
        throw new Error(
          `[CircuitBreaker:${this.options.name}] Circuit is OPEN. Service unavailable. ` +
          `Next retry in ${Math.ceil((this.nextAttempt - Date.now()) / 1000)}s`
        );
      }
      
      this.toHalfOpen();
    }

    try {
      const result = await this.executeWithTimeout();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private async executeWithTimeout(): Promise<T> {
    return Promise.race([
      this.action(),
      new Promise<T>((_, reject) => 
        setTimeout(
          () => reject(new Error('Operation timeout')),
          this.options.timeout
        )
      )
    ]);
  }

  private onSuccess(): void {
    this.failureCount = 0;

    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;
      
      if (this.successCount >= this.options.successThreshold) {
        this.toClosed();
      }
    }
  }

  private onFailure(): void {
    this.failureCount++;
    this.successCount = 0;

    logger.warn('[CircuitBreaker] Failure recorded', {
      name: this.options.name,
      failureCount: this.failureCount,
      threshold: this.options.failureThreshold,
      state: this.state
    });

    if (this.state === CircuitState.HALF_OPEN) {
      this.toOpen();
    } else if (this.failureCount >= this.options.failureThreshold) {
      this.toOpen();
    }
  }

  private toOpen(): void {
    this.state = CircuitState.OPEN;
    this.stateChangeTime = Date.now();
    this.nextAttempt = Date.now() + this.options.resetTimeout;

    logger.error('[CircuitBreaker] Circuit OPENED', {
      name: this.options.name,
      failureCount: this.failureCount,
      resetTimeout: this.options.resetTimeout,
      nextAttemptIn: Math.ceil(this.options.resetTimeout / 1000) + 's'
    });

    this.emitStateChange();
  }

  private toHalfOpen(): void {
    this.state = CircuitState.HALF_OPEN;
    this.stateChangeTime = Date.now();
    this.successCount = 0;

    logger.info('[CircuitBreaker] Circuit HALF_OPEN (testing recovery)', {
      name: this.options.name
    });

    this.emitStateChange();
  }

  private toClosed(): void {
    this.state = CircuitState.CLOSED;
    this.stateChangeTime = Date.now();
    this.failureCount = 0;
    this.successCount = 0;

    logger.info('[CircuitBreaker] Circuit CLOSED (service recovered)', {
      name: this.options.name
    });

    this.emitStateChange();
  }

  private emitStateChange(): void {
    logger.debug('[CircuitBreaker] State changed', {
      name: this.options.name,
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      timeSinceChange: Date.now() - this.stateChangeTime
    });
  }

  getState(): CircuitState {
    return this.state;
  }

  getStats() {
    return {
      name: this.options.name,
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      stateChangeTime: this.stateChangeTime,
      timeSinceChange: Date.now() - this.stateChangeTime,
      nextAttempt: this.nextAttempt,
      timeUntilNextAttempt: Math.max(0, this.nextAttempt - Date.now())
    };
  }

  forceOpen(): void {
    logger.warn('[CircuitBreaker] Manually forcing circuit OPEN', {
      name: this.options.name
    });
    this.toOpen();
  }

  forceClose(): void {
    logger.warn('[CircuitBreaker] Manually forcing circuit CLOSED', {
      name: this.options.name
    });
    this.toClosed();
  }

  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.stateChangeTime = Date.now();
    this.nextAttempt = 0;

    logger.info('[CircuitBreaker] Circuit reset', {
      name: this.options.name
    });
  }
}

/**
 * Factory for creating pre-configured circuit breakers
 */
export class CircuitBreakerFactory {
  static createDatabaseCircuitBreaker<T>(
    action: () => Promise<T>
  ): CircuitBreaker<T> {
    return new CircuitBreaker(action, {
      name: 'database',
      failureThreshold: 5,
      successThreshold: 2,
      timeout: 3000,
      resetTimeout: 30000
    });
  }

  static createMQTTCircuitBreaker<T>(
    action: () => Promise<T>
  ): CircuitBreaker<T> {
    return new CircuitBreaker(action, {
      name: 'mqtt',
      failureThreshold: 3,
      successThreshold: 1,
      timeout: 5000,
      resetTimeout: 10000
    });
  }

  static createAPICircuitBreaker<T>(
    action: () => Promise<T>,
    apiName: string
  ): CircuitBreaker<T> {
    return new CircuitBreaker(action, {
      name: `api:${apiName}`,
      failureThreshold: 5,
      successThreshold: 2,
      timeout: 10000,
      resetTimeout: 60000
    });
  }
}
