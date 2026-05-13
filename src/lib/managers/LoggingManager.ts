/**
 * Centralized Logging Manager
 * 
 * Replaces the scattered logging systems (action-logger, audit-logger, etc.)
 * with a unified, comprehensive logging solution.
 */

import { browser } from '$app/environment';
import type { 
  UnifiedMessage, 
  SystemMessage, 
  ErrorMessage,
  MessageFactory 
} from '../types/unified';

// ============================================================================
// INTERFACES
// ============================================================================

export interface LogEntry {
  id: string;
  timestamp: number;
  level: LogLevel;
  category: LogCategory;
  message: string;
  details?: any;
  userId?: string;
  deviceId?: string;
  connectionId?: string;
  requestId?: string;
  stack?: string;
  metadata?: Record<string, any>;
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export type LogCategory = 
  | 'system'
  | 'communication'
  | 'webrtc'
  | 'terminal'
  | 'rdp'
  | 'device'
  | 'auth'
  | 'api'
  | 'database'
  | 'network'
  | 'security'
  | 'performance'
  | 'user-action'
  | 'error';

export interface LoggingConfig {
  level: LogLevel;
  enableConsole: boolean;
  enableStorage: boolean;
  enableRemote: boolean;
  maxStorageEntries: number;
  remoteEndpoint?: string;
  batchSize: number;
  flushInterval: number;
}

export interface ActionLogEntry {
  id: string;
  deviceId: string;
  actionType: 'webrtc' | 'terminal' | 'rdp' | 'device' | 'system';
  status: 'initiated' | 'in_progress' | 'success' | 'failed' | 'cancelled';
  initiatedBy: string;
  initiatedAt: number;
  completedAt?: number;
  durationMs?: number;
  message: string;
  error?: string;
  metadata?: Record<string, any>;
}

// ============================================================================
// LOGGING MANAGER CLASS
// ============================================================================

export class LoggingManagerClass {
  private config: LoggingConfig;
  private logs: LogEntry[] = [];
  private actionLogs: ActionLogEntry[] = [];
  private batchBuffer: LogEntry[] = [];
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private isInitialized = false;

  constructor(config: Partial<LoggingConfig> = {}) {
    this.config = {
      level: 'info',
      enableConsole: true,
      enableStorage: true,
      maxStorageEntries: 1000,
      enableRemote: false,
      batchSize: 10,
      flushInterval: 5000,
      ...config
    };
  }

  // ============================================================================
  // PUBLIC API
  // ============================================================================

  /**
   * Initialize the logging manager
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.warn('[LoggingManager] Already initialized');
      return;
    }

    try {
      // Load existing logs from storage
      if (this.config.enableStorage && browser) {
        await this.loadLogsFromStorage();
      }

      // Start batch flush timer
      this.startBatchFlush();

      this.isInitialized = true;
      this.log('info', 'system', 'LoggingManager initialized');
    } catch (error) {
      console.error('[LoggingManager] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Log a message
   */
  log(
    level: LogLevel,
    category: LogCategory,
    message: string,
    details?: any,
    metadata?: Record<string, any>
  ): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const entry: LogEntry = {
      id: this.generateId(),
      timestamp: Date.now(),
      level,
      category,
      message,
      details,
      metadata
    };

    this.addLogEntry(entry);
  }

  /**
   * Debug logging
   */
  debug(category: LogCategory, message: string, details?: any, metadata?: Record<string, any>): void {
    this.log('debug', category, message, details, metadata);
  }

  /**
   * Info logging
   */
  info(category: LogCategory, message: string, details?: any, metadata?: Record<string, any>): void {
    this.log('info', category, message, details, metadata);
  }

  /**
   * Warning logging
   */
  warn(category: LogCategory, message: string, details?: any, metadata?: Record<string, any>): void {
    this.log('warn', category, message, details, metadata);
  }

  /**
   * Error logging
   */
  error(category: LogCategory, message: string, details?: any, metadata?: Record<string, any>): void {
    this.log('error', category, message, details, metadata);
  }

  /**
   * Fatal logging
   */
  fatal(category: LogCategory, message: string, details?: any, metadata?: Record<string, any>): void {
    this.log('fatal', category, message, details, metadata);
  }

  /**
   * Log a user action
   */
  logUserAction(
    action: string,
    userId: string,
    deviceId?: string,
    details?: any,
    metadata?: Record<string, any>
  ): void {
    this.log('info', 'user-action', `User action: ${action}`, details, {
      userId,
      deviceId,
      ...metadata
    });
  }

  /**
   * Log a communication event
   */
  logCommunication(
    message: UnifiedMessage,
    direction: 'incoming' | 'outgoing',
    details?: any
  ): void {
    this.log('debug', 'communication', 
      `${direction} ${message.type}:${message.action}`, 
      details,
      {
        messageId: message.id,
        deviceId: message.deviceId,
        userId: message.userId,
        connectionId: message.connectionId,
        requestId: message.requestId
      }
    );
  }

  /**
   * Log a WebRTC event
   */
  logWebRTC(
    action: string,
    deviceId: string,
    details?: any,
    metadata?: Record<string, any>
  ): void {
    this.log('debug', 'webrtc', `WebRTC ${action}`, details, {
      deviceId,
      ...metadata
    });
  }

  /**
   * Log a Terminal event
   */
  logTerminal(
    action: string,
    deviceId: string,
    details?: any,
    metadata?: Record<string, any>
  ): void {
    this.log('debug', 'terminal', `Terminal ${action}`, details, {
      deviceId,
      ...metadata
    });
  }

  /**
   * Log an RDP event
   */
  logRDP(
    action: string,
    deviceId: string,
    details?: any,
    metadata?: Record<string, any>
  ): void {
    this.log('debug', 'rdp', `RDP ${action}`, details, {
      deviceId,
      ...metadata
    });
  }

  /**
   * Log a device event
   */
  logDevice(
    action: string,
    deviceId: string,
    details?: any,
    metadata?: Record<string, any>
  ): void {
    this.log('info', 'device', `Device ${action}`, details, {
      deviceId,
      ...metadata
    });
  }

  /**
   * Log an API request
   */
  logAPI(
    method: string,
    endpoint: string,
    statusCode: number,
    duration: number,
    details?: any,
    metadata?: Record<string, any>
  ): void {
    this.log('info', 'api', `API ${method} ${endpoint}`, details, {
      method,
      endpoint,
      statusCode,
      duration,
      ...metadata
    });
  }

  /**
   * Log a database operation
   */
  logDatabase(
    operation: string,
    table: string,
    duration: number,
    details?: any,
    metadata?: Record<string, any>
  ): void {
    this.log('debug', 'database', `DB ${operation} ${table}`, details, {
      operation,
      table,
      duration,
      ...metadata
    });
  }

  /**
   * Log a security event
   */
  logSecurity(
    event: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    details?: any,
    metadata?: Record<string, any>
  ): void {
    this.log('warn', 'security', `Security: ${event}`, details, {
      severity,
      ...metadata
    });
  }

  /**
   * Log a performance metric
   */
  logPerformance(
    metric: string,
    value: number,
    unit: string,
    details?: any,
    metadata?: Record<string, any>
  ): void {
    this.log('debug', 'performance', `Performance: ${metric}`, details, {
      metric,
      value,
      unit,
      ...metadata
    });
  }

  // ============================================================================
  // ACTION LOGGING
  // ============================================================================

  /**
   * Create an action log entry
   */
  createActionLog(
    deviceId: string,
    actionType: ActionLogEntry['actionType'],
    initiatedBy: string,
    message: string,
    metadata?: Record<string, any>
  ): string {
    const entry: ActionLogEntry = {
      id: this.generateId(),
      deviceId,
      actionType,
      status: 'initiated',
      initiatedBy,
      initiatedAt: Date.now(),
      message,
      metadata
    };

    this.actionLogs.push(entry);
    this.log('info', 'user-action', `Action initiated: ${actionType}`, { entry });
    
    return entry.id;
  }

  /**
   * Update action log status
   */
  updateActionLog(
    id: string,
    status: ActionLogEntry['status'],
    message?: string,
    error?: string
  ): void {
    const entry = this.actionLogs.find(log => log.id === id);
    if (!entry) {
      this.warn('system', `Action log not found: ${id}`);
      return;
    }

    entry.status = status;
    if (message) entry.message = message;
    if (error) entry.error = error;

    if (status === 'success' || status === 'failed' || status === 'cancelled') {
      entry.completedAt = Date.now();
      entry.durationMs = entry.completedAt - entry.initiatedAt;
    }

    this.log('info', 'user-action', `Action ${status}: ${entry.actionType}`, { entry });
  }

  /**
   * Get action logs for a device
   */
  getActionLogs(deviceId: string, limit: number = 50): ActionLogEntry[] {
    return this.actionLogs
      .filter(log => log.deviceId === deviceId)
      .sort((a, b) => b.initiatedAt - a.initiatedAt)
      .slice(0, limit);
  }

  // ============================================================================
  // LOG RETRIEVAL
  // ============================================================================

  /**
   * Get logs by category
   */
  getLogsByCategory(category: LogCategory, limit: number = 100): LogEntry[] {
    return this.logs
      .filter(log => log.category === category)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  /**
   * Get logs by level
   */
  getLogsByLevel(level: LogLevel, limit: number = 100): LogEntry[] {
    return this.logs
      .filter(log => log.level === level)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  /**
   * Get logs by device
   */
  getLogsByDevice(deviceId: string, limit: number = 100): LogEntry[] {
    return this.logs
      .filter(log => log.deviceId === deviceId)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  /**
   * Get all logs
   */
  getAllLogs(limit: number = 1000): LogEntry[] {
    return this.logs
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  /**
   * Clear logs
   */
  clearLogs(): void {
    this.logs = [];
    this.actionLogs = [];
    this.batchBuffer = [];
    
    if (this.config.enableStorage && browser) {
      localStorage.removeItem('logging_manager_logs');
      localStorage.removeItem('logging_manager_action_logs');
    }
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error', 'fatal'];
    const currentLevelIndex = levels.indexOf(this.config.level);
    const messageLevelIndex = levels.indexOf(level);
    return messageLevelIndex >= currentLevelIndex;
  }

  private addLogEntry(entry: LogEntry): void {
    // Add to main logs
    this.logs.push(entry);
    
    // Add to batch buffer
    this.batchBuffer.push(entry);

    // Console logging
    if (this.config.enableConsole) {
      this.logToConsole(entry);
    }

    // Storage logging
    if (this.config.enableStorage && browser) {
      this.saveLogsToStorage();
    }

    // Remote logging
    if (this.config.enableRemote && this.batchBuffer.length >= this.config.batchSize) {
      this.flushBatch();
    }

    // Trim logs if too many
    if (this.logs.length > this.config.maxStorageEntries) {
      this.logs = this.logs.slice(-this.config.maxStorageEntries);
    }
  }

  private logToConsole(entry: LogEntry): void {
    const timestamp = new Date(entry.timestamp).toISOString();
    const prefix = `[${timestamp}] [${entry.level.toUpperCase()}] [${entry.category}]`;
    
    const logMethod = entry.level === 'error' || entry.level === 'fatal' ? 'error' :
                     entry.level === 'warn' ? 'warn' : 'log';
    
    if (entry.details) {
      console[logMethod](`${prefix} ${entry.message}`, entry.details);
    } else {
      console[logMethod](`${prefix} ${entry.message}`);
    }
  }

  private async loadLogsFromStorage(): Promise<void> {
    try {
      const storedLogs = localStorage.getItem('logging_manager_logs');
      if (storedLogs) {
        this.logs = JSON.parse(storedLogs);
      }

      const storedActionLogs = localStorage.getItem('logging_manager_action_logs');
      if (storedActionLogs) {
        this.actionLogs = JSON.parse(storedActionLogs);
      }
    } catch (error) {
      console.warn('[LoggingManager] Failed to load logs from storage:', error);
    }
  }

  private saveLogsToStorage(): void {
    try {
      localStorage.setItem('logging_manager_logs', JSON.stringify(this.logs));
      localStorage.setItem('logging_manager_action_logs', JSON.stringify(this.actionLogs));
    } catch (error) {
      console.warn('[LoggingManager] Failed to save logs to storage:', error);
    }
  }

  private startBatchFlush(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }

    this.flushTimer = setInterval(() => {
      this.flushBatch();
    }, this.config.flushInterval);
  }

  private async flushBatch(): Promise<void> {
    if (this.batchBuffer.length === 0 || !this.config.enableRemote) {
      return;
    }

    try {
      const batch = [...this.batchBuffer];
      this.batchBuffer = [];

      if (this.config.remoteEndpoint) {
        await fetch(this.config.remoteEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ logs: batch })
        });
      }
    } catch (error) {
      console.warn('[LoggingManager] Failed to flush batch:', error);
      // Put logs back in buffer for retry
      this.batchBuffer.unshift(...this.batchBuffer);
    }
  }

  private generateId(): string {
    return `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let loggingManagerInstance: LoggingManagerClass | null = null;

export function createLoggingManager(config?: Partial<LoggingConfig>): LoggingManagerClass {
  if (loggingManagerInstance) {
    return loggingManagerInstance;
  }
  
  loggingManagerInstance = new LoggingManagerClass(config);
  return loggingManagerInstance;
}

export function getLoggingManager(): LoggingManagerClass | null {
  return loggingManagerInstance;
}

export function destroyLoggingManager(): void {
  if (loggingManagerInstance) {
    loggingManagerInstance.clearLogs();
    loggingManagerInstance = null;
  }
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

export async function initializeLogging(config?: Partial<LoggingConfig>): Promise<LoggingManagerClass> {
  const manager = createLoggingManager(config);
  await manager.initialize();
  return manager;
}

export function log(level: LogLevel, category: LogCategory, message: string, details?: any, metadata?: Record<string, any>): void {
  const manager = getLoggingManager();
  if (manager) {
    manager.log(level, category, message, details, metadata);
  } else {
    console.log(`[${level.toUpperCase()}] [${category}] ${message}`, details);
  }
}

export function logError(category: LogCategory, message: string, details?: any, metadata?: Record<string, any>): void {
  log('error', category, message, details, metadata);
}

export function logInfo(category: LogCategory, message: string, details?: any, metadata?: Record<string, any>): void {
  log('info', category, message, details, metadata);
}

export function logDebug(category: LogCategory, message: string, details?: any, metadata?: Record<string, any>): void {
  log('debug', category, message, details, metadata);
}
