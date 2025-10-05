declare module 'redlock' {
  export interface Lock {
    release(): Promise<void>;
    resources?: string[];
  }

  export default class Redlock {
    constructor(clients: any[], options?: {
      driftFactor?: number;
      retryCount?: number;
      retryDelay?: number;
      retryJitter?: number;
    });

    acquire(resources: string[], ttl: number): Promise<Lock>;
  }
}


