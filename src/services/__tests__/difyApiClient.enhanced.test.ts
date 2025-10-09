/**
 * Enhanced unit tests for Dify API client
 * Task 9.1: Add tests for Dify API client
 */

import { DifyApiClient } from '../difyApiClient';
import { TokenManager } from '../tokenManager';
import { AccessControlService } from '../accessControlService';
import {
  DifyApiConfig,
  DifyWorkflow,
  WorkflowInput,
  WorkflowResult,
  WorkflowExecutionStatus,
  GetWorkflowsRequest,
  RateLimitInfo,
} from '../../types/dify';

// Mock dependencies
jest.mock('../tokenManager');
jest.mock('../accessControlService');

// Mock fetch
global.fetch = jest.fn();

describe('Dify API Client - Enhanced Tests', () => {
  let difyApiClient: DifyApiClient;
  const mockTokenManager = TokenManager as jest.Mocked<typeof TokenManager>;
  const mockAccessControlService = AccessControlService as jest.Mocked<typeof AccessControlService>;
  const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

  const defaultConfig: DifyApiConfig = {
    baseUrl: 'https://api.dify.test',
    apiKey: 'test-api-key',
    timeout: 30000,
    retryAttempts: 3,
    retryDelay: 1000,
    enableRequestSigning: true,
    signingSecret: 'test-signing-secret',
  };

  const mockWorkflow: DifyWorkflow = {
    id: 'workflow-1',
    name: 'Test Workflow',
    description: 'A test workflow',
    inputSchema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
      },
      required: ['message'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        result: { type: 'string' },
      },
    },
    requiredPermissions: ['workflow:execute'],
    version: '1.0.0',
    tags: ['test', 'demo'],
    category: 'testing',
    isActive: true,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    difyApiClient = new DifyApiClient(defaultConfig);
    
    // Setup default mocks
    mockTokenManager.getValidAccessToken.mockReturnValue('valid-token');
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: new Headers(),
      json: jest.fn().mockResolvedValue({}),
    } as any);
  });

  describe('Configuration Management', () => {
    it('should initialize with provided configuration', () => {
      expect(difyApiClient).toBeDefined();
      expect(difyApiClient.getRateLimitInfo()).toBeNull();
    });

    it('should update configuration dynamically', () => {
      const newConfig: Partial<DifyApiConfig> = {
        timeout: 60000,
        retryAttempts: 5,
      };

      difyApiClient.updateConfig(newConfig);
      
      // Configuration should be updated (we can't directly test private properties,
      // but we can test behavior that depends on them)
      expect(() => difyApiClient.updateConfig(newConfig)).not.toThrow();
    });

    it('should validate configuration parameters', () => {
      expect(() => new DifyApiClient({
        ...defaultConfig,
        timeout: -1,
      })).toThrow('Invalid timeout value');

      expect(() => new DifyApiClient({
        ...defaultConfig,
        retryAttempts: -1,
      })).toThrow('Invalid retry attempts value');
    });
  });

  describe('Workflow Operations', () => {
    describe('getWorkflows', () => {
      it('should fetch workflows successfully', async () => {
        const mockResponse = {
          workflows: [mockWorkflow],
          total: 1,
          page: 1,
          pageSize: 10,
        };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue(mockResponse),
          headers: new Headers(),
        } as any);

        const result = await difyApiClient.getWorkflows();
        
        expect(result).toEqual([mockWorkflow]);
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/workflows'),
          expect.objectContaining({
            method: 'GET',
            headers: expect.objectContaining({
              'Authorization': 'Bearer valid-token',
              'Content-Type': 'application/json',
            }),
          })
        );
      });

      it('should handle workflow filtering and pagination', async () => {
        const request: GetWorkflowsRequest = {
          page: 2,
          pageSize: 5,
          category: 'testing',
          tags: ['test'],
          isActive: true,
        };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue({ workflows: [], total: 0 }),
          headers: new Headers(),
        } as any);

        await difyApiClient.getWorkflows(request);
        
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('page=2'),
          expect.any(Object)
        );
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('pageSize=5'),
          expect.any(Object)
        );
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('category=testing'),
          expect.any(Object)
        );
      });

      it('should handle API errors gracefully', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
          json: jest.fn().mockResolvedValue({ error: 'Server error' }),
          headers: new Headers(),
        } as any);

        await expect(difyApiClient.getWorkflows()).rejects.toThrow('Server error');
      });
    });

    describe('executeWorkflow', () => {
      const workflowInput: WorkflowInput = {
        message: 'Hello, world!',
      };

      it('should execute workflow successfully', async () => {
        const mockResult: WorkflowResult = {
          executionId: 'exec-1',
          status: 'completed',
          result: { output: 'Hello, world! processed' },
          startedAt: '2024-01-01T00:00:00Z',
          completedAt: '2024-01-01T00:01:00Z',
          duration: 60000,
        };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue(mockResult),
          headers: new Headers(),
        } as any);

        const result = await difyApiClient.executeWorkflow('workflow-1', workflowInput, 'user-1');
        
        expect(result).toEqual(mockResult);
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/workflows/workflow-1/execute'),
          expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({
              input: workflowInput,
              userId: 'user-1',
            }),
          })
        );
      });

      it('should validate workflow input against schema', async () => {
        // Mock getWorkflowMetadata to return workflow with schema
        mockFetch
          .mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: jest.fn().mockResolvedValue(mockWorkflow),
            headers: new Headers(),
          } as any)
          .mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: jest.fn().mockResolvedValue({
              executionId: 'exec-1',
              status: 'running',
            }),
            headers: new Headers(),
          } as any);

        const invalidInput = {}; // Missing required 'message' field

        await expect(
          difyApiClient.executeWorkflow('workflow-1', invalidInput)
        ).rejects.toThrow('Invalid workflow input');
      });

      it('should handle workflow execution timeout', async () => {
        mockFetch.mockImplementationOnce(() => 
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Request timeout')), 100)
          )
        );

        await expect(
          difyApiClient.executeWorkflow('workflow-1', workflowInput)
        ).rejects.toThrow('Request timeout');
      });
    });

    describe('getWorkflowStatus', () => {
      it('should get workflow execution status', async () => {
        const mockStatus: WorkflowResult = {
          executionId: 'exec-1',
          status: 'running',
          startedAt: '2024-01-01T00:00:00Z',
        };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue(mockStatus),
          headers: new Headers(),
        } as any);

        const result = await difyApiClient.getWorkflowStatus('exec-1');
        
        expect(result).toEqual(mockStatus);
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/executions/exec-1'),
          expect.objectContaining({ method: 'GET' })
        );
      });

      it('should handle non-existent execution ID', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 404,
          statusText: 'Not Found',
          json: jest.fn().mockResolvedValue({ error: 'Execution not found' }),
          headers: new Headers(),
        } as any);

        await expect(
          difyApiClient.getWorkflowStatus('non-existent')
        ).rejects.toThrow('Execution not found');
      });
    });

    describe('cancelWorkflowExecution', () => {
      it('should cancel workflow execution successfully', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue({ cancelled: true }),
          headers: new Headers(),
        } as any);

        const result = await difyApiClient.cancelWorkflowExecution('exec-1');
        
        expect(result).toBe(true);
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/executions/exec-1/cancel'),
          expect.objectContaining({ method: 'POST' })
        );
      });

      it('should handle cancellation failure', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 400,
          statusText: 'Bad Request',
          json: jest.fn().mockResolvedValue({ error: 'Cannot cancel completed execution' }),
          headers: new Headers(),
        } as any);

        await expect(
          difyApiClient.cancelWorkflowExecution('exec-1')
        ).rejects.toThrow('Cannot cancel completed execution');
      });
    });
  });

  describe('Authentication and Security', () => {
    it('should include authentication token in requests', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({ workflows: [] }),
        headers: new Headers(),
      } as any);

      await difyApiClient.getWorkflows();
      
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer valid-token',
          }),
        })
      );
    });

    it('should handle authentication failure', async () => {
      mockTokenManager.getValidAccessToken.mockReturnValue(null);

      await expect(difyApiClient.getWorkflows()).rejects.toThrow('No valid access token available');
    });

    it('should sign requests when signing is enabled', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({ workflows: [] }),
        headers: new Headers(),
      } as any);

      await difyApiClient.getWorkflows();
      
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Signature': expect.any(String),
            'X-Timestamp': expect.any(String),
            'X-Nonce': expect.any(String),
          }),
        })
      );
    });
  });

  describe('Rate Limiting', () => {
    it('should track rate limit information from response headers', async () => {
      const rateLimitHeaders = new Headers({
        'X-RateLimit-Limit': '100',
        'X-RateLimit-Remaining': '95',
        'X-RateLimit-Reset': '1640995200',
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({ workflows: [] }),
        headers: rateLimitHeaders,
      } as any);

      await difyApiClient.getWorkflows();
      
      const rateLimitInfo = difyApiClient.getRateLimitInfo();
      expect(rateLimitInfo).toEqual({
        limit: 100,
        remaining: 95,
        resetTime: new Date(1640995200 * 1000),
      });
    });

    it('should handle rate limit exceeded error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        json: jest.fn().mockResolvedValue({ error: 'Rate limit exceeded' }),
        headers: new Headers({
          'Retry-After': '60',
        }),
      } as any);

      await expect(difyApiClient.getWorkflows()).rejects.toThrow('Rate limit exceeded');
    });
  });

  describe('Error Handling and Retry Logic', () => {
    it('should retry failed requests with exponential backoff', async () => {
      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue({ workflows: [] }),
          headers: new Headers(),
        } as any);

      const result = await difyApiClient.getWorkflows();
      
      expect(mockFetch).toHaveBeenCalledTimes(3);
      expect(result).toEqual([]);
    });

    it('should not retry non-retryable errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: jest.fn().mockResolvedValue({ error: 'Invalid request' }),
        headers: new Headers(),
      } as any);

      await expect(difyApiClient.getWorkflows()).rejects.toThrow('Invalid request');
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should respect maximum retry attempts', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(difyApiClient.getWorkflows()).rejects.toThrow('Network error');
      expect(mockFetch).toHaveBeenCalledTimes(4); // Initial + 3 retries
    });
  });

  describe('Access Control Integration', () => {
    it('should filter workflows based on user permissions', async () => {
      const allWorkflows = [mockWorkflow, { ...mockWorkflow, id: 'workflow-2' }];
      const accessibleWorkflows = [mockWorkflow];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({ workflows: allWorkflows }),
        headers: new Headers(),
      } as any);

      // Mock access control to only allow access to workflow-1
      jest.spyOn(difyApiClient as any, 'filterWorkflowsByPermissions')
        .mockReturnValue(accessibleWorkflows);

      const result = await difyApiClient.getWorkflows();
      
      expect(result).toEqual(accessibleWorkflows);
    });

    it('should check permissions before workflow execution', async () => {
      // Mock access control to deny access
      jest.spyOn(difyApiClient as any, 'checkWorkflowExecutePermission')
        .mockReturnValue(false);

      await expect(
        difyApiClient.executeWorkflow('workflow-1', { message: 'test' })
      ).rejects.toThrow('Insufficient permissions to execute workflow');
    });
  });

  describe('Performance and Monitoring', () => {
    it('should track request timing', async () => {
      mockFetch.mockImplementationOnce(() => 
        new Promise(resolve => 
          setTimeout(() => resolve({
            ok: true,
            status: 200,
            json: jest.fn().mockResolvedValue({ workflows: [] }),
            headers: new Headers(),
          } as any), 100)
        )
      );

      const startTime = Date.now();
      await difyApiClient.getWorkflows();
      const endTime = Date.now();

      expect(endTime - startTime).toBeGreaterThanOrEqual(100);
    });

    it('should handle concurrent requests efficiently', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({ workflows: [] }),
        headers: new Headers(),
      } as any);

      const promises = Array.from({ length: 10 }, () => difyApiClient.getWorkflows());
      const results = await Promise.all(promises);

      expect(results).toHaveLength(10);
      expect(mockFetch).toHaveBeenCalledTimes(10);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty response gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue(null),
        headers: new Headers(),
      } as any);

      const result = await difyApiClient.getWorkflows();
      expect(result).toEqual([]);
    });

    it('should handle malformed JSON response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockRejectedValue(new Error('Invalid JSON')),
        headers: new Headers(),
      } as any);

      await expect(difyApiClient.getWorkflows()).rejects.toThrow('Invalid JSON');
    });

    it('should handle network connectivity issues', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Failed to fetch'));

      await expect(difyApiClient.getWorkflows()).rejects.toThrow('Failed to fetch');
    });
  });
});