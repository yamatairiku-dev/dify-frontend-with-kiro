import {
  getUserAvailableWorkflows,
  executeWorkflowWithPermissions,
  monitorWorkflowExecution,
  cancelWorkflowExecution,
  getUserWorkflowCategories,
  searchUserWorkflows,
  difyApiExamples,
} from '../difyApiIntegration';
import { difyApiClient } from '../../services/difyApiClient';
import { accessControlService } from '../../services/accessControlService';
import type { User } from '../../types/auth';
import type { DifyWorkflow, WorkflowResult } from '../../types/dify';

// Mock dependencies
jest.mock('../../services/difyApiClient');
jest.mock('../../services/accessControlService');

describe('Dify API Integration', () => {
  const mockDifyApiClient = difyApiClient as jest.Mocked<typeof difyApiClient>;
  const mockAccessControlService = accessControlService as jest.Mocked<typeof accessControlService>;

  const mockUser: User = {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
    provider: 'azure',
    attributes: {
      domain: 'example.com',
      roles: ['user'],
      department: 'engineering',
    },
    permissions: [
      {
        resource: 'workflow:*',
        actions: ['read', 'execute'],
      },
    ],
  };

  const mockWorkflows: DifyWorkflow[] = [
    {
      id: 'workflow-1',
      name: 'Data Processor',
      description: 'Process data files',
      category: 'data',
      inputSchema: {
        type: 'object',
        properties: {
          data: { type: 'array' },
          format: { type: 'string' },
        },
        required: ['data'],
      },
      outputSchema: { type: 'object', properties: {} },
      requiredPermissions: ['workflow:execute'],
      tags: ['data', 'processing'],
    },
    {
      id: 'workflow-2',
      name: 'Text Analyzer',
      description: 'Analyze text content',
      category: 'ai',
      inputSchema: {
        type: 'object',
        properties: {
          text: { type: 'string', minLength: 1 },
          language: { type: 'string' },
        },
        required: ['text'],
      },
      outputSchema: { type: 'object', properties: {} },
      requiredPermissions: ['workflow:execute'],
      tags: ['ai', 'text'],
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getUserAvailableWorkflows', () => {
    it('should return workflows available to user', async () => {
      mockDifyApiClient.getWorkflows.mockResolvedValue(mockWorkflows);
      mockAccessControlService.getAvailableWorkflows.mockReturnValue(mockWorkflows);

      const result = await getUserAvailableWorkflows(mockUser);

      expect(result).toEqual(mockWorkflows);
      expect(mockDifyApiClient.getWorkflows).toHaveBeenCalled();
      expect(mockAccessControlService.getAvailableWorkflows).toHaveBeenCalledWith(mockUser);
    });

    it('should filter workflows based on user permissions', async () => {
      mockDifyApiClient.getWorkflows.mockResolvedValue(mockWorkflows);
      mockAccessControlService.getAvailableWorkflows.mockReturnValue([mockWorkflows[0]]);

      const result = await getUserAvailableWorkflows(mockUser);

      expect(result).toEqual([mockWorkflows[0]]);
    });

    it('should handle API errors gracefully', async () => {
      mockDifyApiClient.getWorkflows.mockRejectedValue(new Error('API Error'));

      await expect(getUserAvailableWorkflows(mockUser)).rejects.toThrow(
        'Unable to retrieve available workflows'
      );
    });
  });

  describe('executeWorkflowWithPermissions', () => {
    const mockWorkflowResult: WorkflowResult = {
      executionId: 'exec-123',
      status: 'pending',
    };

    it('should execute workflow when user has permissions', async () => {
      mockAccessControlService.checkAccess.mockReturnValue({
        allowed: true,
      });
      mockDifyApiClient.getWorkflowMetadata.mockResolvedValue(mockWorkflows[0]);
      mockDifyApiClient.executeWorkflow.mockResolvedValue(mockWorkflowResult);

      const result = await executeWorkflowWithPermissions(
        mockUser,
        'workflow-1',
        { data: [1, 2, 3], format: 'json' }
      );

      expect(result).toEqual(mockWorkflowResult);
      expect(mockAccessControlService.checkAccess).toHaveBeenCalledWith(
        mockUser,
        'workflow:workflow-1',
        'execute'
      );
      expect(mockDifyApiClient.executeWorkflow).toHaveBeenCalledWith(
        'workflow-1',
        { data: [1, 2, 3], format: 'json' },
        mockUser.id
      );
    });

    it('should deny execution when user lacks permissions', async () => {
      mockAccessControlService.checkAccess.mockReturnValue({
        allowed: false,
        reason: 'Insufficient permissions',
      });

      await expect(
        executeWorkflowWithPermissions(mockUser, 'workflow-1', { data: [] })
      ).rejects.toThrow('Access denied: Insufficient permissions');

      expect(mockDifyApiClient.executeWorkflow).not.toHaveBeenCalled();
    });

    it('should validate input against workflow schema', async () => {
      mockAccessControlService.checkAccess.mockReturnValue({ allowed: true });
      mockDifyApiClient.getWorkflowMetadata.mockResolvedValue(mockWorkflows[0]);

      await expect(
        executeWorkflowWithPermissions(mockUser, 'workflow-1', { format: 'json' }) // missing required 'data'
      ).rejects.toThrow("Invalid input: Required field 'data' is missing");

      expect(mockDifyApiClient.executeWorkflow).not.toHaveBeenCalled();
    });

    it('should handle workflow execution errors', async () => {
      mockAccessControlService.checkAccess.mockReturnValue({ allowed: true });
      mockDifyApiClient.getWorkflowMetadata.mockResolvedValue(mockWorkflows[0]);
      mockDifyApiClient.executeWorkflow.mockRejectedValue(new Error('Execution failed'));

      await expect(
        executeWorkflowWithPermissions(mockUser, 'workflow-1', { data: [] })
      ).rejects.toThrow('Execution failed');
    });
  });

  describe('monitorWorkflowExecution', () => {
    const mockExecutionResult: WorkflowResult = {
      executionId: 'exec-123',
      status: 'completed',
      result: { output: 'Success' },
      completedAt: '2023-01-01T00:01:00Z',
    };

    it('should monitor execution when user has permissions', async () => {
      mockAccessControlService.checkAccess.mockReturnValue({ allowed: true });
      mockDifyApiClient.getWorkflowStatus.mockResolvedValue(mockExecutionResult);

      const result = await monitorWorkflowExecution(mockUser, 'exec-123');

      expect(result).toEqual(mockExecutionResult);
      expect(mockAccessControlService.checkAccess).toHaveBeenCalledWith(
        mockUser,
        'workflow:execution',
        'read'
      );
      expect(mockDifyApiClient.getWorkflowStatus).toHaveBeenCalledWith('exec-123');
    });

    it('should deny monitoring when user lacks permissions', async () => {
      mockAccessControlService.checkAccess.mockReturnValue({
        allowed: false,
        reason: 'Cannot monitor executions',
      });

      await expect(
        monitorWorkflowExecution(mockUser, 'exec-123')
      ).rejects.toThrow('Access denied: Cannot monitor executions');

      expect(mockDifyApiClient.getWorkflowStatus).not.toHaveBeenCalled();
    });
  });

  describe('cancelWorkflowExecution', () => {
    it('should cancel execution when user has permissions', async () => {
      mockAccessControlService.checkAccess.mockReturnValue({ allowed: true });
      mockDifyApiClient.cancelWorkflowExecution.mockResolvedValue(true);

      const result = await cancelWorkflowExecution(mockUser, 'exec-123');

      expect(result).toBe(true);
      expect(mockAccessControlService.checkAccess).toHaveBeenCalledWith(
        mockUser,
        'workflow:execution',
        'cancel'
      );
      expect(mockDifyApiClient.cancelWorkflowExecution).toHaveBeenCalledWith('exec-123');
    });

    it('should deny cancellation when user lacks permissions', async () => {
      mockAccessControlService.checkAccess.mockReturnValue({
        allowed: false,
        reason: 'Cannot cancel executions',
      });

      await expect(
        cancelWorkflowExecution(mockUser, 'exec-123')
      ).rejects.toThrow('Access denied: Cannot cancel executions');

      expect(mockDifyApiClient.cancelWorkflowExecution).not.toHaveBeenCalled();
    });

    it('should handle cancellation failures', async () => {
      mockAccessControlService.checkAccess.mockReturnValue({ allowed: true });
      mockDifyApiClient.cancelWorkflowExecution.mockResolvedValue(false);

      const result = await cancelWorkflowExecution(mockUser, 'exec-123');

      expect(result).toBe(false);
    });
  });

  describe('getUserWorkflowCategories', () => {
    it('should return unique categories from available workflows', async () => {
      mockDifyApiClient.getWorkflows.mockResolvedValue(mockWorkflows);
      mockAccessControlService.getAvailableWorkflows.mockReturnValue(mockWorkflows);

      const result = await getUserWorkflowCategories(mockUser);

      expect(result).toEqual(['ai', 'data']);
    });

    it('should handle workflows without categories', async () => {
      const workflowsWithoutCategory = [
        { ...mockWorkflows[0], category: undefined },
        mockWorkflows[1],
      ];
      mockDifyApiClient.getWorkflows.mockResolvedValue(workflowsWithoutCategory);
      mockAccessControlService.getAvailableWorkflows.mockReturnValue(workflowsWithoutCategory);

      const result = await getUserWorkflowCategories(mockUser);

      expect(result).toEqual(['ai']);
    });

    it('should return empty array on error', async () => {
      mockDifyApiClient.getWorkflows.mockRejectedValue(new Error('API Error'));

      const result = await getUserWorkflowCategories(mockUser);

      expect(result).toEqual([]);
    });
  });

  describe('searchUserWorkflows', () => {
    beforeEach(() => {
      mockDifyApiClient.getWorkflows.mockResolvedValue(mockWorkflows);
      mockAccessControlService.getAvailableWorkflows.mockReturnValue(mockWorkflows);
    });

    it('should search workflows by name', async () => {
      const result = await searchUserWorkflows(mockUser, 'data');

      expect(result).toEqual([mockWorkflows[0]]);
    });

    it('should search workflows by description', async () => {
      const result = await searchUserWorkflows(mockUser, 'analyze');

      expect(result).toEqual([mockWorkflows[1]]);
    });

    it('should search workflows by tags', async () => {
      const result = await searchUserWorkflows(mockUser, 'processing');

      expect(result).toEqual([mockWorkflows[0]]);
    });

    it('should filter by category', async () => {
      const result = await searchUserWorkflows(mockUser, '', 'ai');

      expect(result).toEqual([mockWorkflows[1]]);
    });

    it('should combine search query and category filter', async () => {
      const result = await searchUserWorkflows(mockUser, 'text', 'ai');

      expect(result).toEqual([mockWorkflows[1]]);
    });

    it('should return empty array when no matches found', async () => {
      const result = await searchUserWorkflows(mockUser, 'nonexistent');

      expect(result).toEqual([]);
    });
  });

  describe('difyApiExamples', () => {
    beforeEach(() => {
      mockAccessControlService.checkAccess.mockReturnValue({ allowed: true });
      mockDifyApiClient.getWorkflowMetadata.mockImplementation(async (id) => {
        return mockWorkflows.find(w => w.id === id) || mockWorkflows[0];
      });
    });

    describe('processDataWorkflow', () => {
      it('should process data workflow successfully', async () => {
        const mockResult: WorkflowResult = {
          executionId: 'exec-data',
          status: 'completed',
          result: { processed: true },
        };
        mockDifyApiClient.executeWorkflow.mockResolvedValue(mockResult);

        const result = await difyApiExamples.processDataWorkflow(mockUser, [1, 2, 3]);

        expect(result).toEqual(mockResult);
        expect(mockDifyApiClient.executeWorkflow).toHaveBeenCalledWith(
          'data-processor',
          {
            data: [1, 2, 3],
            format: 'json',
            options: {
              validate: true,
              transform: true,
            },
          },
          mockUser.id
        );
      });
    });

    describe('analyzeText', () => {
      it('should analyze text successfully', async () => {
        const mockResult: WorkflowResult = {
          executionId: 'exec-text',
          status: 'completed',
          result: { sentiment: 'positive' },
        };
        mockDifyApiClient.executeWorkflow.mockResolvedValue(mockResult);

        const result = await difyApiExamples.analyzeText(mockUser, 'Hello world');

        expect(result).toEqual(mockResult);
        expect(mockDifyApiClient.executeWorkflow).toHaveBeenCalledWith(
          'text-analyzer',
          {
            text: 'Hello world',
            language: 'en',
            features: ['sentiment', 'entities', 'keywords'],
          },
          mockUser.id
        );
      });

      it('should use custom language parameter', async () => {
        const mockResult: WorkflowResult = {
          executionId: 'exec-text',
          status: 'completed',
        };
        mockDifyApiClient.executeWorkflow.mockResolvedValue(mockResult);

        await difyApiExamples.analyzeText(mockUser, 'Bonjour monde', 'fr');

        expect(mockDifyApiClient.executeWorkflow).toHaveBeenCalledWith(
          'text-analyzer',
          expect.objectContaining({
            language: 'fr',
          }),
          mockUser.id
        );
      });
    });

    describe('processImage', () => {
      it('should process image successfully', async () => {
        const mockResult: WorkflowResult = {
          executionId: 'exec-image',
          status: 'completed',
          result: { processedUrl: 'https://example.com/processed.png' },
        };
        mockDifyApiClient.executeWorkflow.mockResolvedValue(mockResult);

        const result = await difyApiExamples.processImage(
          mockUser,
          'https://example.com/image.jpg',
          ['resize', 'compress']
        );

        expect(result).toEqual(mockResult);
        expect(mockDifyApiClient.executeWorkflow).toHaveBeenCalledWith(
          'image-processor',
          {
            imageUrl: 'https://example.com/image.jpg',
            operations: ['resize', 'compress'],
            outputFormat: 'png',
            quality: 90,
          },
          mockUser.id
        );
      });
    });

    describe('processBatch', () => {
      it('should process batch items successfully', async () => {
        const mockResults: WorkflowResult[] = [
          { executionId: 'exec-1', status: 'completed' },
          { executionId: 'exec-2', status: 'completed' },
        ];

        mockDifyApiClient.executeWorkflow
          .mockResolvedValueOnce(mockResults[0])
          .mockResolvedValueOnce(mockResults[1]);

        const items = ['item1', 'item2'];
        const results = await difyApiExamples.processBatch(mockUser, items);

        expect(results).toEqual(mockResults);
        expect(mockDifyApiClient.executeWorkflow).toHaveBeenCalledTimes(2);
      });

      it('should continue processing on individual item failures', async () => {
        const mockResult: WorkflowResult = {
          executionId: 'exec-2',
          status: 'completed',
        };

        mockDifyApiClient.executeWorkflow
          .mockRejectedValueOnce(new Error('Item 1 failed'))
          .mockResolvedValueOnce(mockResult);

        const items = ['item1', 'item2'];
        const results = await difyApiExamples.processBatch(mockUser, items);

        expect(results).toEqual([mockResult]);
        expect(mockDifyApiClient.executeWorkflow).toHaveBeenCalledTimes(2);
      });

      it('should monitor pending executions', async () => {
        const pendingResult: WorkflowResult = {
          executionId: 'exec-pending',
          status: 'pending',
        };
        const completedResult: WorkflowResult = {
          executionId: 'exec-pending',
          status: 'completed',
        };

        mockDifyApiClient.executeWorkflow.mockResolvedValue(pendingResult);
        mockAccessControlService.checkAccess.mockReturnValue({ allowed: true });
        mockDifyApiClient.getWorkflowStatus.mockResolvedValue(completedResult);

        const items = ['item1'];
        const results = await difyApiExamples.processBatch(mockUser, items);

        expect(results).toEqual([pendingResult]);
        expect(mockDifyApiClient.getWorkflowStatus).toHaveBeenCalledWith('exec-pending');
      });
    });
  });

  describe('input validation', () => {
    it('should validate string fields correctly', async () => {
      mockAccessControlService.checkAccess.mockReturnValue({ allowed: true });
      mockDifyApiClient.getWorkflowMetadata.mockResolvedValue({
        ...mockWorkflows[1],
        inputSchema: {
          type: 'object',
          properties: {
            text: { type: 'string', minLength: 5, maxLength: 100 },
          },
          required: ['text'],
        },
      });

      // Test too short
      await expect(
        executeWorkflowWithPermissions(mockUser, 'workflow-2', { text: 'hi' })
      ).rejects.toThrow("Field 'text' must be at least 5 characters");

      // Test non-string
      await expect(
        executeWorkflowWithPermissions(mockUser, 'workflow-2', { text: 123 })
      ).rejects.toThrow("Field 'text' must be a string");
    });

    it('should validate number fields correctly', async () => {
      mockAccessControlService.checkAccess.mockReturnValue({ allowed: true });
      mockDifyApiClient.getWorkflowMetadata.mockResolvedValue({
        ...mockWorkflows[0],
        inputSchema: {
          type: 'object',
          properties: {
            count: { type: 'number', minimum: 1, maximum: 100 },
          },
          required: ['count'],
        },
      });

      // Test below minimum
      await expect(
        executeWorkflowWithPermissions(mockUser, 'workflow-1', { count: 0 })
      ).rejects.toThrow("Field 'count' must be at least 1");

      // Test above maximum
      await expect(
        executeWorkflowWithPermissions(mockUser, 'workflow-1', { count: 101 })
      ).rejects.toThrow("Field 'count' must be at most 100");
    });

    it('should validate array and object fields', async () => {
      mockAccessControlService.checkAccess.mockReturnValue({ allowed: true });
      mockDifyApiClient.getWorkflowMetadata.mockResolvedValue({
        ...mockWorkflows[0],
        inputSchema: {
          type: 'object',
          properties: {
            items: { type: 'array' },
            config: { type: 'object' },
            enabled: { type: 'boolean' },
          },
          required: ['items', 'config', 'enabled'],
        },
      });

      await expect(
        executeWorkflowWithPermissions(mockUser, 'workflow-1', {
          items: 'not-array',
          config: 'not-object',
          enabled: 'not-boolean',
        })
      ).rejects.toThrow(/must be a/);
    });
  });
});