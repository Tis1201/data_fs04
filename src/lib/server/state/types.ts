export enum BundleProcessingState {
  ACTIVE = 'ACTIVE',
  TIMEOUT_PENDING = 'TIMEOUT_PENDING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED'
}

export interface BundleProcessingStateData {
  bundleId: string;
  state: BundleProcessingState;
  timeoutAt: Date | null;
  gracePeriodHours: number;
  lastDeviceResponse: Date | null;
  updatedAt: Date;
}

export interface BundleStates {
  [bundleId: string]: BundleProcessingStateData;
}

export interface StateManager {
  getBundleState(bundleId: string): Promise<BundleProcessingStateData | null>;
  setBundleState(bundleId: string, state: BundleProcessingStateData): Promise<void>;
  deleteBundleState(bundleId: string): Promise<void>;
  getProcessableBundles(): Promise<string[]>;
  cleanupExpiredStates(): Promise<void>;
  initialize(): Promise<void>;
  close(): Promise<void>;
}
