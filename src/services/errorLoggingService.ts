/**
 * Error Logging Service with Privacy Controls
 */

import {
  AppError,
  ErrorContext,
  ErrorLoggingConfig,
  ErrorSeverity,
} from '../types/error';
import { shouldLogError, sanitizeError } from '../utils/errorUtils';

/**
 * Default error logging configuration
 */
const DEFAULT_CONFIG: ErrorLoggingConfig = {
  enableConsoleLogging: process.env.NODE_ENV === 'development',
  enableRemoteLogging: process.env.NODE_ENV === 'production',
  logLevel: ErrorSeverity.MEDIUM,
  excludePersonalInfo: true,
  maxStackTraceLength: 2000,
  remoteEndpoint: process.env.REACT_APP_ERROR_LOGGING_ENDPOINT,
  apiKey: process.env.REACT_APP_ERROR_LOGGING_API_KEY,
};

/**
 * Error logging service class
 */
class ErrorLoggingService {
  private config: ErrorLoggingConfig;
  private logQueue: Array<{ error: AppError; context: ErrorContext }> = [];
  private isProcessingQueue = false;
  private maxQueueSize = 100;
  private flushInterval = 5000; // 5 seconds
  private flushTimer: NodeJS.Timeout | null = null;

  constructor(config: Partial<ErrorLoggingConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.startQueueProcessor();
  }

  /**
   * Log an error with context
   */
  async logError(error: AppError, context: ErrorContext): Promise<void> {
    try {
      // Check if error should be logged
      if (!shouldLogError(error, this.config)) {
        return;
      }

      // Sanitize error if needed
      const sanitizedError = sanitizeError(error, this.config.excludePersonalInfo);

      // Truncate stack trace if too long
      if (sanitizedError.stack && sanitizedError.stack.length > this.config.maxStackTraceLength) {
        sanitizedError.stack = sanitizedError.stack.substring(0, this.config.maxStackTraceLength) + '... [truncated]';
      }

      // Console logging
      if (this.config.enableConsoleLogging) {
        this.logToConsole(sanitizedError, context);
      }

      // Remote logging
      if (this.config.enableRemoteLogging) {
        this.queueForRemoteLogging(sanitizedError, context);
      }

      // Store in local storage for debugging (development only)
      if (process.env.NODE_ENV === 'development') {
        this.storeLocalError(sanitizedError, context);
      }

    } catch (loggingError) {
      // Prevent logging errors from crashing the application
      console.error('Error logging service failed:', loggingError);
    }
  }

  /**
   * Log to console with proper formatting
   */
  private logToConsole(error: AppError, context: ErrorContext): void {
    const logLevel = this.getConsoleLogLevel(error.severity);
    const timestamp = new Date().toISOString();
    
    console.group(`🚨 ${error.type} [${error.severity}] - ${timestamp}`);
    console[logLevel]('Message:', error.message);
    console[logLevel]('Error ID:', context.errorId);
    console[logLevel]('URL:', context.url);
    
    if (context.routeName) {
      console[logLevel]('Route:', context.routeName);
    }
    
    if (error.code) {
      console[logLevel]('Code:', error.code);
    }
    
    if (error.details) {
      console[logLevel]('Details:', error.details);
    }
    
    if (error.stack) {
      console[logLevel]('Stack:', error.stack);
    }
    
    if (context.componentStack) {
      console[logLevel]('Component Stack:', context.componentStack);
    }
    
    console.groupEnd();
  }

  /**
   * Get appropriate console log level
   */
  private getConsoleLogLevel(severity: ErrorSeverity): 'log' | 'warn' | 'error' {
    switch (severity) {
      case ErrorSeverity.LOW:
        return 'log';
      case ErrorSeverity.MEDIUM:
        return 'warn';
      case ErrorSeverity.HIGH:
      case ErrorSeverity.CRITICAL:
        return 'error';
      default:
        return 'warn';
    }
  }

  /**
   * Queue error for remote logging
   */
  private queueForRemoteLogging(error: AppError, context: ErrorContext): void {
    // Add to queue
    this.logQueue.push({ error, context });

    // Limit queue size
    if (this.logQueue.length > this.maxQueueSize) {
      this.logQueue.shift(); // Remove oldest entry
    }

    // Start flush timer if not already running
    if (!this.flushTimer) {
      this.flushTimer = setTimeout(() => {
        this.flushQueue();
      }, this.flushInterval);
    }
  }

  /**
   * Start queue processor
   */
  private startQueueProcessor(): void {
    // Process queue on page unload
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        this.flushQueue();
      });

      // Process queue on visibility change (when tab becomes hidden)
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
          this.flushQueue();
        }
      });
    }
  }

  /**
   * Flush queue to remote logging service
   */
  private async flushQueue(): Promise<void> {
    if (this.isProcessingQueue || this.logQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    try {
      const errors = [...this.logQueue];
      this.logQueue = [];

      // Clear flush timer
      if (this.flushTimer) {
        clearTimeout(this.flushTimer);
        this.flushTimer = null;
      }

      await this.sendToRemoteService(errors);

    } catch (error) {
      console.error('Failed to flush error queue:', error);
      // Re-queue errors for retry (keep only recent ones)
      this.logQueue = [...this.logQueue.slice(-50)];
    } finally {
      this.isProcessingQueue = false;
    }
  }

  /**
   * Send errors to remote logging service
   */
  private async sendToRemoteService(
    errors: Array<{ error: AppError; context: ErrorContext }>
  ): Promise<void> {
    if (!this.config.remoteEndpoint) {
      return;
    }

    const payload = {
      errors: errors.map(({ error, context }) => ({
        ...error,
        context,
        timestamp: error.timestamp.toISOString(),
      })),
      metadata: {
        userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : undefined,
        url: typeof window !== 'undefined' ? window.location.href : undefined,
        timestamp: new Date().toISOString(),
        version: process.env.REACT_APP_VERSION || 'unknown',
      },
    };

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }

    const response = await fetch(this.config.remoteEndpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Remote logging failed: ${response.status} ${response.statusText}`);
    }
  }

  /**
   * Store error locally for debugging (development only)
   */
  private storeLocalError(error: AppError, context: ErrorContext): void {
    try {
      const key = `error-log-${context.errorId}`;
      const data = {
        error,
        context,
        timestamp: new Date().toISOString(),
      };

      localStorage.setItem(key, JSON.stringify(data));

      // Clean up old error logs (keep only last 50)
      const errorKeys = Object.keys(localStorage)
        .filter(key => key.startsWith('error-log-'))
        .sort()
        .reverse();

      if (errorKeys.length > 50) {
        errorKeys.slice(50).forEach(key => {
          localStorage.removeItem(key);
        });
      }

    } catch {
      // Ignore storage errors
    }
  }

  /**
   * Get stored error logs (development only)
   */
  getStoredErrors(): Array<{ error: AppError; context: ErrorContext; timestamp: string }> {
    if (process.env.NODE_ENV !== 'development') {
      return [];
    }

    const errors: Array<{ error: AppError; context: ErrorContext; timestamp: string }> = [];

    try {
      const errorKeys = Object.keys(localStorage)
        .filter(key => key.startsWith('error-log-'))
        .sort()
        .reverse();

      for (const key of errorKeys) {
        const data = localStorage.getItem(key);
        if (data) {
          const parsed = JSON.parse(data);
          errors.push(parsed);
        }
      }
    } catch {
      // Ignore parsing errors
    }

    return errors;
  }

  /**
   * Clear stored error logs
   */
  clearStoredErrors(): void {
    try {
      const errorKeys = Object.keys(localStorage)
        .filter(key => key.startsWith('error-log-'));

      errorKeys.forEach(key => {
        localStorage.removeItem(key);
      });
    } catch {
      // Ignore storage errors
    }
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<ErrorLoggingConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current configuration
   */
  getConfig(): ErrorLoggingConfig {
    return { ...this.config };
  }

  /**
   * Manually flush queue
   */
  async flush(): Promise<void> {
    await this.flushQueue();
  }

  /**
   * Destroy service and clean up resources
   */
  destroy(): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    // Flush remaining errors
    this.flushQueue();
  }
}

// Create singleton instance
export const errorLoggingService = new ErrorLoggingService();

// Export class for custom instances
export { ErrorLoggingService };

// Export convenience functions
export const logError = (error: AppError, context: ErrorContext): Promise<void> => {
  return errorLoggingService.logError(error, context);
};

export const configureErrorLogging = (config: Partial<ErrorLoggingConfig>): void => {
  errorLoggingService.updateConfig(config);
};

export const getStoredErrors = () => {
  return errorLoggingService.getStoredErrors();
};

export const clearStoredErrors = () => {
  errorLoggingService.clearStoredErrors();
};