/**
 * Tests for Error Handling Integration Examples
 */

import {
  exampleAuthenticationErrorHandling,
  exampleNetworkErrorHandling,
  exampleDifyApiErrorHandling,
  exampleAuthorizationErrorHandling,
  exampleUnifiedErrorHandling,
} from '../errorHandlingIntegration';

// Mock the error handlers to avoid actual retries in tests
jest.mock('../../services/specificErrorHandlers', () => ({
  handleAuthenticationError: jest.fn(),
  handleAuthorizationError: jest.fn(),
  handleNetworkError: jest.fn(),
  handleDifyApiError: jest.fn(),
  handleError: jest.fn(),
}));

// Mock the integration utilities
jest.mock('../../utils/errorHandlingIntegration', () => ({
  authOperationWithErrorHandling: jest.fn(),
  fetchWithErrorHandling: jest.fn(),
  difyApiOperationWithErrorHandling: jest.fn(),
}));

const mockHandlers = require('../../services/specificErrorHandlers');
const mockIntegration = require('../../utils/errorHandlingIntegration');

// Mock Response for Node.js environment
global.Response = class MockResponse {
  private _body: string;
  private _status: number;
  private _headers: Record<string, string>;

  constructor(body: string = '', init: { status?: number; headers?: Record<string, string> } = {}) {
    this._body = body;
    this._status = init.status || 200;
    this._headers = init.headers || {};
  }

  get status() { return this._status; }
  get headers() { return this._headers; }

  async json() {
    return JSON.parse(this._body);
  }

  async text() {
    return this._body;
  }
} as any;

describe('Error Handling Integration Examples', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock console methods to avoid cluttering test output
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('exampleAuthenticationErrorHandling', () => {
    it('should demonstrate authentication error handling with retry', async () => {
      const mockResult = { accessToken: 'new-token', user: { id: '1', name: 'User' } };
      mockIntegration.authOperationWithErrorHandling.mockResolvedValue(mockResult);

      await exampleAuthenticationErrorHandling();

      expect(mockIntegration.authOperationWithErrorHandling).toHaveBeenCalledWith(
        expect.any(Function),
        { provider: 'azure', authStep: 'refresh' }
      );

      expect(console.log).toHaveBeenCalledWith('=== Authentication Error Handling Example ===');
      expect(console.log).toHaveBeenCalledWith('Token refresh successful:', mockResult);
    });

    it('should handle authentication error failure', async () => {
      const mockError = new Error('Authentication failed');
      mockIntegration.authOperationWithErrorHandling.mockRejectedValue(mockError);

      await exampleAuthenticationErrorHandling();

      expect(console.error).toHaveBeenCalledWith('Token refresh failed after retries:', mockError);
    });
  });

  describe('exampleNetworkErrorHandling', () => {
    it('should demonstrate network error handling with fetch', async () => {
      const mockResponse = new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
      mockIntegration.fetchWithErrorHandling.mockResolvedValue(mockResponse);

      await exampleNetworkErrorHandling();

      expect(mockIntegration.fetchWithErrorHandling).toHaveBeenCalledWith(
        '/api/test',
        { method: 'GET' },
        { endpoint: '/api/test' }
      );

      expect(console.log).toHaveBeenCalledWith('=== Network Error Handling Example ===');
      expect(console.log).toHaveBeenCalledWith('Network request successful:', { success: true });
    });

    it('should handle network error failure', async () => {
      const mockError = new Error('Network failed');
      mockIntegration.fetchWithErrorHandling.mockRejectedValue(mockError);

      await exampleNetworkErrorHandling();

      expect(console.error).toHaveBeenCalledWith('Network request failed after retries:', mockError);
    });
  });

  describe('exampleDifyApiErrorHandling', () => {
    it('should demonstrate Dify API error handling', async () => {
      const mockResult = {
        executionId: 'exec-456',
        status: 'completed',
        result: { output: 'Success!' }
      };
      mockIntegration.difyApiOperationWithErrorHandling.mockResolvedValue(mockResult);

      await exampleDifyApiErrorHandling();

      expect(mockIntegration.difyApiOperationWithErrorHandling).toHaveBeenCalledWith(
        expect.any(Function),
        {
          workflowId: 'workflow-123',
          workflowName: 'Example Workflow',
        }
      );

      expect(console.log).toHaveBeenCalledWith('=== Dify API Error Handling Example ===');
      expect(console.log).toHaveBeenCalledWith('Workflow execution successful:', mockResult);
    });

    it('should handle Dify API error failure', async () => {
      const mockError = new Error('Workflow failed');
      mockIntegration.difyApiOperationWithErrorHandling.mockRejectedValue(mockError);

      await exampleDifyApiErrorHandling();

      expect(console.error).toHaveBeenCalledWith('Workflow execution failed after retries:', mockError);
    });
  });

  describe('exampleAuthorizationErrorHandling', () => {
    it('should demonstrate authorization error handling', async () => {
      const mockError = {
        message: 'You do not have permission to execute workflows',
        details: {
          suggestions: ['Contact your administrator to request workflow access']
        }
      };
      mockHandlers.handleAuthorizationError.mockRejectedValue(mockError);

      await exampleAuthorizationErrorHandling();

      expect(mockHandlers.handleAuthorizationError).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'AUTHORIZATION_ERROR',
          resource: 'workflow',
          action: 'execute',
        }),
        expect.objectContaining({
          resource: 'workflow',
          action: 'execute',
          routeName: 'workflow-execution',
          userPermissions: ['workflow:read'],
        })
      );

      expect(console.log).toHaveBeenCalledWith('=== Authorization Error Handling Example ===');
      expect(console.log).toHaveBeenCalledWith('Authorization error handled:', mockError.message);
      expect(console.log).toHaveBeenCalledWith('Error details:', mockError.details.suggestions);
    });
  });

  describe('exampleUnifiedErrorHandling', () => {
    it('should demonstrate unified error handling for different error types', async () => {
      // Mock successful results for all error types
      mockHandlers.handleError
        .mockResolvedValueOnce('Success for NETWORK_ERROR')
        .mockResolvedValueOnce('Success for AUTHENTICATION_ERROR')
        .mockResolvedValueOnce('Success for DIFY_API_ERROR');

      await exampleUnifiedErrorHandling();

      expect(mockHandlers.handleError).toHaveBeenCalledTimes(3);
      
      // Check that different error types were handled
      expect(mockHandlers.handleError).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'NETWORK_ERROR' }),
        expect.any(Function)
      );
      
      expect(mockHandlers.handleError).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'AUTHENTICATION_ERROR' }),
        expect.any(Function)
      );
      
      expect(mockHandlers.handleError).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'DIFY_API_ERROR' }),
        expect.any(Function)
      );

      expect(console.log).toHaveBeenCalledWith('=== Unified Error Handling Example ===');
      expect(console.log).toHaveBeenCalledWith('  Result: Success for NETWORK_ERROR');
      expect(console.log).toHaveBeenCalledWith('  Result: Success for AUTHENTICATION_ERROR');
      expect(console.log).toHaveBeenCalledWith('  Result: Success for DIFY_API_ERROR');
    });

    it('should handle unified error handling failures', async () => {
      const mockErrors = [
        { message: 'Network error handled' },
        { message: 'Auth error handled' },
        { message: 'Dify error handled' },
      ];

      mockHandlers.handleError
        .mockRejectedValueOnce(mockErrors[0])
        .mockRejectedValueOnce(mockErrors[1])
        .mockRejectedValueOnce(mockErrors[2]);

      await exampleUnifiedErrorHandling();

      expect(console.log).toHaveBeenCalledWith('  Final error: Network error handled');
      expect(console.log).toHaveBeenCalledWith('  Final error: Auth error handled');
      expect(console.log).toHaveBeenCalledWith('  Final error: Dify error handled');
    });
  });

  describe('Integration test scenarios', () => {
    it('should handle mixed success and failure scenarios', async () => {
      // Test authentication success
      mockIntegration.authOperationWithErrorHandling.mockResolvedValue({ success: true });
      
      // Test network failure
      mockIntegration.fetchWithErrorHandling.mockRejectedValue(new Error('Network failed'));
      
      // Test Dify success
      mockIntegration.difyApiOperationWithErrorHandling.mockResolvedValue({ result: 'success' });

      await exampleAuthenticationErrorHandling();
      await exampleNetworkErrorHandling();
      await exampleDifyApiErrorHandling();

      // Verify mixed results
      expect(console.log).toHaveBeenCalledWith('Token refresh successful:', { success: true });
      expect(console.error).toHaveBeenCalledWith('Network request failed after retries:', expect.any(Error));
      expect(console.log).toHaveBeenCalledWith('Workflow execution successful:', { result: 'success' });
    });

    it('should demonstrate error handling patterns', async () => {
      // This test verifies that the examples demonstrate proper error handling patterns
      const examples = [
        exampleAuthenticationErrorHandling,
        exampleNetworkErrorHandling,
        exampleDifyApiErrorHandling,
        exampleAuthorizationErrorHandling,
        exampleUnifiedErrorHandling,
      ];

      // Mock all handlers to succeed
      mockIntegration.authOperationWithErrorHandling.mockResolvedValue({ success: true });
      mockIntegration.fetchWithErrorHandling.mockResolvedValue(new Response('{}'));
      mockIntegration.difyApiOperationWithErrorHandling.mockResolvedValue({ success: true });
      mockHandlers.handleAuthorizationError.mockRejectedValue({ message: 'Access denied' });
      mockHandlers.handleError.mockResolvedValue('Success');

      // Run all examples
      for (const example of examples) {
        await example();
      }

      // Verify that each example was executed (by checking console.log calls)
      expect(console.log).toHaveBeenCalledWith('=== Authentication Error Handling Example ===');
      expect(console.log).toHaveBeenCalledWith('=== Network Error Handling Example ===');
      expect(console.log).toHaveBeenCalledWith('=== Dify API Error Handling Example ===');
      expect(console.log).toHaveBeenCalledWith('=== Authorization Error Handling Example ===');
      expect(console.log).toHaveBeenCalledWith('=== Unified Error Handling Example ===');
    });
  });
});