import { DifyApiClient } from '../difyApiClient';
import { TokenManager } from '../tokenManager';
import type { DifyWorkflow, WorkflowInput } from '../../types/dify';

// Mock dependencies
jest.mock('../tokenManager');
jest.mock('../../config/environment', () => ({
  config: {
    difyApiUrl: 'http://localhost:8080',
  },
}));

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock crypto.subtle for HMAC signing
const mockCryptoSubtle = {
  importKey: jest.fn(),
  sign: jest.fn(),
};
Object.defineProperty(global, 'crypto', {
  value: {
    subtle: mockCryptoSubtle,
    getRandomValues: jest.fn((array: Uint8Array) => {
      for (let i = 0; i < array.length; i++) {
        array[i] = Math.floor(Math.random() * 256);
      }
      return array;
    }),
  },
});

describe('DifyApiClient', () => {
  let client: DifyApiClient;
  const mockTokenManager = TokenManager as jest.Mocked<typeof TokenManager>;

  // Helper function to create mock response
  const createMockResponse = (options: {
    ok?: boolean;
    status?: number;
    data?: any;
    headers?: Record<string, string>;
  } = {}) => ({
    ok: options.ok ?? true,
    status: options.status ?? 200,
    headers: {
      get: jest.fn((key: string) => {
        const defaultHeaders = {
          'x-request-id': 'test-request-id',
          'x-api-version': '1.0',
          ...options.headers,
        };
        return (defaultHeaders as Record<string, string>)[key] || null;
      }),
    },
    json: jest.fn().mockResolvedValue(options.data ?? { success: true }),
  });

  beforeEach(() => {
    client = new DifyApiClient();
    jest.clearAllMocks();
    
    // Setup default token manager mock
    mockTokenManager.getValidAccessToken.mockReturnValue('mock-access-token');
    
    // Setup default fetch mock
    mockFetch.mockResolvedValue(createMockResponse());
  });

  describe('constructor', () => {
    it('should initialize with default configuration', () => {
      const defaultClient = new DifyApiClient();
      expect(defaultClient).toBeInstanceOf(DifyApiClient);
    });

    it('should accept custom configuration', () => {
      const customClient = new DifyApiClient({
        timeout: 60000,
        retryAttempts: 5,
      });
      expect(customClient).toBeInstanceOf(DifyApiClient);
    });
  });

  describe('getWorkflows', () => {
    it('should fetch workflows successfully', async () => {
      const mockWorkflows: DifyWorkflow[] = [
        {
          id: 'workflow-1',
          name: 'Test Workflow',
          description: 'A test workflow',
          inputSchema: { type: 'object', properties: {} },
          outputSchema: { type: 'object', properties: {} },
          requiredPermissions: ['workflow:read'],
        },
      ];

      mockFetch.mockResolvedValueOnce(createMockResponse({
        data: {
          workflows: mockWorkflows,
          total: 1,
          limit: 10,
          offset: 0,
        },
      }));

      const result = await client.getWorkflows();

      expect(result).toEqual(mockWorkflows);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8080/api/v1/workflows',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            Authorization: 'Bearer mock-access-token',
          }),
        })
      );
    });

    it('should handle empty workflows response', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({
        data: {},
      }));

      const result = await client.getWorkflows();

      expect(result).toEqual([]);
    });

    it('should include query parameters for filtered requests', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Map(),
        json: jest.fn().mockResolvedValue({ workflows: [] }),
      });

      await client.getWorkflows({
        category: 'ai',
        isActive: true,
        limit: 5,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8080/api/v1/workflows?category=ai&isActive=true&limit=5',
        expect.any(Object)
      );
    });
  });

  describe('executeWorkflow', () => {
    it('should execute workflow successfully', async () => {
      const workflowId = 'workflow-1';
      const input: WorkflowInput = { message: 'Hello, World!' };
      const mockResponse = {
        executionId: 'exec-123',
        status: 'pending' as const,
      };

      mockFetch.mockResolvedValueOnce(createMockResponse({
        data: mockResponse,
      }));

      const result = await client.executeWorkflow(workflowId, input);

      expect(result).toEqual({
        executionId: 'exec-123',
        status: 'pending',
      });

      expect(mockFetch).toHaveBeenCalledWith(
        `http://localhost:8080/api/v1/workflows/${workflowId}/execute`,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            Authorization: 'Bearer mock-access-token',
          }),
          body: expect.stringContaining(JSON.stringify(input)),
        })
      );
    });

    it('should include user ID and metadata in request', async () => {
      const workflowId = 'workflow-1';
      const input: WorkflowInput = { message: 'Hello' };
      const userId = 'user-123';

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Map(),
        json: jest.fn().mockResolvedValue({
          executionId: 'exec-123',
          status: 'pending',
        }),
      });

      await client.executeWorkflow(workflowId, input, userId);

      const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(requestBody).toMatchObject({
        workflowId,
        input,
        userId,
        metadata: expect.objectContaining({
          userAgent: expect.any(String),
          sessionId: expect.any(String),
          requestId: expect.any(String),
        }),
      });
    });

    it('should throw error for invalid response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Map(),
        json: jest.fn().mockResolvedValue(null),
      });

      await expect(
        client.executeWorkflow('workflow-1', {})
      ).rejects.toThrow('Invalid response from Dify API');
    });
  });

  describe('getWorkflowStatus', () => {
    it('should get workflow status successfully', async () => {
      const executionId = 'exec-123';
      const mockStatus = {
        executionId,
        status: 'completed' as const,
        result: { output: 'Success!' },
        startedAt: '2023-01-01T00:00:00Z',
        completedAt: '2023-01-01T00:01:00Z',
        duration: 60000,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Map(),
        json: jest.fn().mockResolvedValue(mockStatus),
      });

      const result = await client.getWorkflowStatus(executionId);

      expect(result).toEqual(mockStatus);
      expect(mockFetch).toHaveBeenCalledWith(
        `http://localhost:8080/api/v1/executions/${executionId}/status`,
        expect.objectContaining({
          method: 'GET',
        })
      );
    });

    it('should throw error for invalid status response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Map(),
        json: jest.fn().mockResolvedValue(null),
      });

      await expect(
        client.getWorkflowStatus('exec-123')
      ).rejects.toThrow('Invalid response from Dify API');
    });
  });

  describe('getWorkflowMetadata', () => {
    it('should get workflow metadata successfully', async () => {
      const workflowId = 'workflow-1';
      const mockWorkflow: DifyWorkflow = {
        id: workflowId,
        name: 'Test Workflow',
        description: 'A test workflow',
        inputSchema: { type: 'object', properties: {} },
        outputSchema: { type: 'object', properties: {} },
        requiredPermissions: ['workflow:read'],
        version: '1.0.0',
        tags: ['ai', 'test'],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Map(),
        json: jest.fn().mockResolvedValue(mockWorkflow),
      });

      const result = await client.getWorkflowMetadata(workflowId);

      expect(result).toEqual(mockWorkflow);
      expect(mockFetch).toHaveBeenCalledWith(
        `http://localhost:8080/api/v1/workflows/${workflowId}`,
        expect.objectContaining({
          method: 'GET',
        })
      );
    });

    it('should throw error when workflow not found', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Map(),
        json: jest.fn().mockResolvedValue(null),
      });

      await expect(
        client.getWorkflowMetadata('nonexistent')
      ).rejects.toThrow('Workflow not found');
    });
  });

  describe('cancelWorkflowExecution', () => {
    it('should cancel workflow execution successfully', async () => {
      const executionId = 'exec-123';

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Map(),
        json: jest.fn().mockResolvedValue({ success: true }),
      });

      const result = await client.cancelWorkflowExecution(executionId);

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        `http://localhost:8080/api/v1/executions/${executionId}/cancel`,
        expect.objectContaining({
          method: 'POST',
        })
      );
    });

    it('should return false when cancellation fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Map(),
        json: jest.fn().mockResolvedValue({ success: false }),
      });

      const result = await client.cancelWorkflowExecution('exec-123');

      expect(result).toBe(false);
    });
  });

  describe('authentication', () => {
    it('should throw error when no access token available', async () => {
      mockTokenManager.getValidAccessToken.mockReturnValue(null);

      await expect(client.getWorkflows()).rejects.toMatchObject({
        code: 'HTTP_401',
        message: 'No valid access token available',
        type: 'authentication',
      });
    });

    it('should include authorization header in requests', async () => {
      mockTokenManager.getValidAccessToken.mockReturnValue('test-token');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Map(),
        json: jest.fn().mockResolvedValue({ workflows: [] }),
      });

      await client.getWorkflows();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token',
          }),
        })
      );
    });
  });

  describe('error handling', () => {
    it('should handle HTTP error responses', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: false,
        status: 404,
        data: {
          code: 'WORKFLOW_NOT_FOUND',
          message: 'Workflow not found',
        },
      }));

      await expect(client.getWorkflows()).rejects.toMatchObject({
        code: 'WORKFLOW_NOT_FOUND',
        message: 'Workflow not found',
        type: 'not_found',
      });
    });

    it('should handle network timeouts', async () => {
      const client = new DifyApiClient({ timeout: 100 });

      mockFetch.mockImplementation(() => {
        return new Promise((resolve, reject) => {
          setTimeout(() => {
            const error = new Error('The operation was aborted');
            error.name = 'AbortError';
            reject(error);
          }, 50);
        });
      });

      await expect(client.getWorkflows()).rejects.toMatchObject({
        code: 'HTTP_408',
        message: 'Request timeout',
        type: 'server_error',
      });
    });

    it('should map 400 status to validation error', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: false,
        status: 400,
        data: { message: 'Bad request' },
      }));

      await expect(client.getWorkflows()).rejects.toMatchObject({
        type: 'validation',
        code: 'HTTP_400',
      });
    });

    it('should map 401 status to authentication error', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: false,
        status: 401,
        data: { message: 'Unauthorized' },
      }));

      await expect(client.getWorkflows()).rejects.toMatchObject({
        type: 'authentication',
        code: 'HTTP_401',
      });
    });

    it('should map 404 status to not_found error', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: false,
        status: 404,
        data: { message: 'Not found' },
      }));

      await expect(client.getWorkflows()).rejects.toMatchObject({
        type: 'not_found',
        code: 'HTTP_404',
      });
    });
  });

  describe('retry mechanism', () => {
    it('should retry on retryable errors', async () => {
      const client = new DifyApiClient({ retryAttempts: 2, retryDelay: 10 });

      // First call fails with 500, second succeeds
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          headers: new Map(),
          json: jest.fn().mockResolvedValue({ message: 'Server error' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Map(),
          json: jest.fn().mockResolvedValue({ workflows: [] }),
        });

      const result = await client.getWorkflows();

      expect(result).toEqual([]);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should not retry on non-retryable errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        headers: new Map(),
        json: jest.fn().mockResolvedValue({ message: 'Bad request' }),
      });

      await expect(client.getWorkflows()).rejects.toMatchObject({
        type: 'validation',
      });

      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should give up after max retry attempts', async () => {
      const client = new DifyApiClient({ retryAttempts: 2, retryDelay: 10 });

      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        headers: new Map(),
        json: jest.fn().mockResolvedValue({ message: 'Server error' }),
      });

      await expect(client.getWorkflows()).rejects.toMatchObject({
        type: 'server_error',
      });

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('request signing', () => {
    beforeEach(() => {
      // Mock crypto.subtle methods
      mockCryptoSubtle.importKey.mockResolvedValue({} as CryptoKey);
      mockCryptoSubtle.sign.mockResolvedValue(new ArrayBuffer(32));
    });

    it('should sign requests when signing is enabled', async () => {
      const client = new DifyApiClient({
        enableRequestSigning: true,
        signingSecret: 'test-secret',
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Map(),
        json: jest.fn().mockResolvedValue({ workflows: [] }),
      });

      await client.getWorkflows();

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

    it('should not sign requests when signing is disabled', async () => {
      const client = new DifyApiClient({
        enableRequestSigning: false,
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Map(),
        json: jest.fn().mockResolvedValue({ workflows: [] }),
      });

      await client.getWorkflows();

      const headers = mockFetch.mock.calls[0][1].headers;
      expect(headers).not.toHaveProperty('X-Signature');
      expect(headers).not.toHaveProperty('X-Timestamp');
      expect(headers).not.toHaveProperty('X-Nonce');
    });

    it('should handle signing errors gracefully', async () => {
      const client = new DifyApiClient({
        enableRequestSigning: true,
        signingSecret: 'test-secret',
      });

      mockCryptoSubtle.importKey.mockRejectedValue(new Error('Crypto error'));

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Map(),
        json: jest.fn().mockResolvedValue({ workflows: [] }),
      });

      // Should not throw error, just proceed without signing
      const result = await client.getWorkflows();
      expect(result).toEqual([]);
    });
  });

  describe('configuration management', () => {
    it('should update configuration', () => {
      const client = new DifyApiClient();
      
      client.updateConfig({
        timeout: 60000,
        retryAttempts: 5,
      });

      // Configuration update should not throw
      expect(() => client.updateConfig({})).not.toThrow();
    });

    it('should get rate limit information', () => {
      const client = new DifyApiClient();
      
      const rateLimitInfo = client.getRateLimitInfo();
      expect(rateLimitInfo).toBeNull(); // Initially null
    });
  });
});