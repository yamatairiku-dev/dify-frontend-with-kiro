/**
 * Tests for Error Logging Service
 */

import {
  ErrorLoggingService,
} from '../errorLoggingService';
import {
  ErrorType,
  ErrorSeverity,
  ErrorLoggingConfig,
} from '../../types/error';
import { createError, createErrorContext } from '../../utils/errorUtils';

// Mock fetch
global.fetch = jest.fn();

// Mock console methods
const mockConsole = {
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  group: jest.fn(),
  groupEnd: jest.fn(),
};

Object.assign(console, mockConsole);

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
};

Object.defineProperty(global, 'localStorage', {
  value: mockLocalStorage,
  writable: true,
});

// Mock process.env
const originalEnv = process.env;

describe('ErrorLoggingService', () => {
  let service: ErrorLoggingService;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
    jest.useFakeTimers();
    
    // Reset process.env
    process.env = { ...originalEnv };
    
    service = new ErrorLoggingService();
  });

  afterEach(() => {
    jest.useRealTimers();
    process.env = originalEnv;
    if (service && typeof service.destroy === 'function') {
      service.destroy();
    }
  });

  describe('constructor', () => {
    it('should create service with default config', () => {
      const config = service.getConfig();
      
      expect(config.logLevel).toBe(ErrorSeverity.MEDIUM);
      expect(config.excludePersonalInfo).toBe(true);
      expect(config.maxStackTraceLength).toBe(2000);
    });

    it('should create service with custom config', () => {
      const customConfig: Partial<ErrorLoggingConfig> = {
        enableConsoleLogging: true,
        logLevel: ErrorSeverity.HIGH,
        maxStackTraceLength: 1000,
      };

      const customService = new ErrorLoggingService(customConfig);
      const config = customService.getConfig();

      expect(config.enableConsoleLogging).toBe(true);
      expect(config.logLevel).toBe(ErrorSeverity.HIGH);
      expect(config.maxStackTraceLength).toBe(1000);

      if (customService && typeof customService.destroy === 'function') {
        customService.destroy();
      }
    });
  });

  describe('logError', () => {
    it('should not log errors below threshold', async () => {
      const error = createError(ErrorType.VALIDATION_ERROR, 'Low severity', {
        severity: ErrorSeverity.LOW,
      });
      const context = createErrorContext();

      await service.logError(error, context);

      expect(mockConsole.group).not.toHaveBeenCalled();
    });

    it('should log errors to console when enabled', async () => {
      service.updateConfig({ enableConsoleLogging: true });

      const error = createError(ErrorType.NETWORK_ERROR, 'Network failed', {
        severity: ErrorSeverity.HIGH,
        code: 'NET_001',
        details: { status: 500 },
      });
      const context = createErrorContext('test-id', 'TestRoute');

      await service.logError(error, context);

      expect(mockConsole.group).toHaveBeenCalledWith(
        expect.stringContaining('NETWORK_ERROR [HIGH]')
      );
      expect(mockConsole.error).toHaveBeenCalledWith('Message:', 'Network failed');
      expect(mockConsole.error).toHaveBeenCalledWith('Error ID:', 'test-id');
      expect(mockConsole.error).toHaveBeenCalledWith('Route:', 'TestRoute');
      expect(mockConsole.error).toHaveBeenCalledWith('Code:', 'NET_001');
      expect(mockConsole.groupEnd).toHaveBeenCalled();
    });

    it('should handle logging errors gracefully', async () => {
      service.updateConfig({ enableConsoleLogging: true });
      
      // Mock console.group to throw an error
      mockConsole.group.mockImplementation(() => {
        throw new Error('Console error');
      });

      const error = createError(ErrorType.UNKNOWN_ERROR, 'Test error');
      const context = createErrorContext();

      // Should not throw
      await expect(service.logError(error, context)).resolves.toBeUndefined();
      
      expect(mockConsole.error).toHaveBeenCalledWith(
        'Error logging service failed:',
        expect.any(Error)
      );
    });
  });

  describe('configuration', () => {
    it('should update configuration', () => {
      const newConfig = {
        enableConsoleLogging: true,
        logLevel: ErrorSeverity.HIGH,
      };

      service.updateConfig(newConfig);
      const config = service.getConfig();

      expect(config.enableConsoleLogging).toBe(true);
      expect(config.logLevel).toBe(ErrorSeverity.HIGH);
      expect(config.excludePersonalInfo).toBe(true); // Should keep existing values
    });
  });

});