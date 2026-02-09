/**
 * Centralized timeout configuration using environment variables
 * All timeout values are in milliseconds
 */

// Default timeout values (in milliseconds)
const DEFAULT_TIMEOUTS = {
  BUNDLE_WAVE: 1 * 10 * 1000, // 10 minutes
  BUNDLE_APP: 1 * 10 * 1000, // 10 minutes per app
  DEVICE_ACTION: 10 * 60 * 1000, // 10 minutes
  DEVICE_APP: 5 * 60 * 1000, // 5 minutes
  DEVICE_APP_MONITORING: 5 * 60 * 1000, // 5 minutes
  DEVICE_TERMINAL: 30 * 1000, // 30 seconds (terminal connect should be quick)
  DEVICE_RDP: 30 * 60 * 1000, // 30 minutes
  DEVICE_LOGS: 30 * 1000, // 30 seconds
  WHATSAPP_SCAN: 5 * 60 * 1000, // 5 minutes
  SSE_CONNECTION: 30 * 1000, // 30 seconds
  WEBSOCKET_CONNECTION: 30 * 1000, // 30 seconds
  DISTRIBUTED_LOCK: 30 * 1000, // 30 seconds
  BUNDLE_STATUS_SCHEDULER: 30 * 1000, // 30 seconds
} as const;

/**
 * Get timeout value from environment variable or use default
 */
function getTimeout(envVar: string, defaultValue: number): number {
  const value = process.env[envVar];
  if (value) {
    const parsed = parseInt(value, 10);
    if (!isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return defaultValue;
}

/**
 * Timeout configuration object
 */
export const TimeoutConfig = {
  // Bundle and wave timeouts
  BUNDLE_WAVE: getTimeout('BUNDLE_WAVE_TIMEOUT_MS', DEFAULT_TIMEOUTS.BUNDLE_WAVE),
  BUNDLE_APP: getTimeout('BUNDLE_APP_TIMEOUT_MS', DEFAULT_TIMEOUTS.BUNDLE_APP),
  
  // Device timeouts
  DEVICE_ACTION: getTimeout('DEVICE_ACTION_TIMEOUT_MS', DEFAULT_TIMEOUTS.DEVICE_ACTION),
  DEVICE_APP: getTimeout('DEVICE_APP_TIMEOUT_MS', DEFAULT_TIMEOUTS.DEVICE_APP),
  DEVICE_APP_MONITORING: getTimeout('DEVICE_APP_MONITORING_TIMEOUT_MS', DEFAULT_TIMEOUTS.DEVICE_APP_MONITORING),
  DEVICE_TERMINAL: getTimeout('DEVICE_TERMINAL_TIMEOUT_MS', DEFAULT_TIMEOUTS.DEVICE_TERMINAL),
  DEVICE_RDP: getTimeout('DEVICE_RDP_TIMEOUT_MS', DEFAULT_TIMEOUTS.DEVICE_RDP),
  DEVICE_LOGS: getTimeout('DEVICE_LOGS_TIMEOUT_MS', DEFAULT_TIMEOUTS.DEVICE_LOGS),
  
  // Connection timeouts
  SSE_CONNECTION: getTimeout('SSE_CONNECTION_TIMEOUT_MS', DEFAULT_TIMEOUTS.SSE_CONNECTION),
  WEBSOCKET_CONNECTION: getTimeout('WEBSOCKET_CONNECTION_TIMEOUT_MS', DEFAULT_TIMEOUTS.WEBSOCKET_CONNECTION),
  
  // System timeouts
  DISTRIBUTED_LOCK: getTimeout('DISTRIBUTED_LOCK_TIMEOUT_MS', DEFAULT_TIMEOUTS.DISTRIBUTED_LOCK),
  BUNDLE_STATUS_SCHEDULER: getTimeout('BUNDLE_STATUS_SCHEDULER_TIMEOUT_MS', DEFAULT_TIMEOUTS.BUNDLE_STATUS_SCHEDULER),
  WHATSAPP_SCAN: getTimeout('WHATSAPP_SCAN_TIMEOUT_MS', DEFAULT_TIMEOUTS.WHATSAPP_SCAN),
} as const;

/**
 * Helper function to calculate bundle timeout based on number of apps
 */
export function calculateBundleTimeout(numApps: number): number {
  return Math.max(TimeoutConfig.BUNDLE_WAVE, numApps * TimeoutConfig.BUNDLE_APP);
}

/**
 * Helper function to get timeout in seconds (for logging)
 */
export function getTimeoutSeconds(timeoutMs: number): number {
  return Math.round(timeoutMs / 1000);
}

/**
 * Helper function to get timeout in minutes (for logging)
 */
export function getTimeoutMinutes(timeoutMs: number): number {
  return Math.round(timeoutMs / (1000 * 60));
}
