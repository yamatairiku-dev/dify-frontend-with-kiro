import {
  executeWorkflowWithPermissions,
  getAvailableWorkflowsForUser,
  validateWorkflowInputWithDetails,
  executeWorkflowChain,
  WorkflowExecutionMonitor,
  workflowExecutionMonitor,
  formatExecutionResultForDisplay,
  estimateWorkflowComplexity
} from '../workflowExecutionIntegration';
import { workflowExecutionService, WorkflowExecutionError } from '../../services/workflowExecutionService';
import { accessControlService } from '../../services/accessControlService';
import { difyApiClient } from '../../services/difyApiClient';
import type { User } from '../../types/auth';
import type { DifyWorkflow, ProcessedWorkflowResult } from '../../types/dify';

// Mock dependencies
jest.mock('../../services/workflowExecutionService');
jest.mock('../../services/accessControlService');
jest.mock('../../services/difyApiClient');

const mockWorkflowExecutionService = workflowExecutionService as jest.Mocked<typeof workflowExecutionService>;
const mockAccessControlService = accessControlService as jest.Mocked<typeof accessControlService>;
const mockDifyApiClient = difyApiClient as jest.Mocked<typeof difyApiClient>;

describe('Workflow Execution Integration', () => {
  const mockUser: User = {
    id: 'user-1',
    email: 'test@example.com',
    name: 'Test User',
    provider: 'azure',
    attributes: {
      domain: 'example.com',
      roles: ['user'],
      department: 'engineering'
    },
    permissions: [
      { resource: 'workflow:test-workflow', actions: ['execute'] },
      { resource: 'workflow:*', actions: ['read'] }
    ]
  };

  const mockWorkflow: DifyWorkflow = {
    id: 'test-workflow',
    name: 'Test Workflow',
    description: 'A test workflow',
    inputSchema: {
      type: 'object',
      properties: {
        message: { type: 'string' }
      },
      required: ['message']
    },
    outputSchema: {
      type: 'object',
      properties: {
        result: { type: 'string' }
      }
    },
    requiredPermissions: ['workflow:execute']
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('executeWorkflowWithPermissions', () => {
    it('should execute workflow successfully with proper permissions', async () => {
      const input = { message: 'Hello world' };
      const expectedResult: ProcessedWorkflowResult = {
        executionId: 'exec-1',
        workflowId: 'test-workflow',
        status: 'completed',
        result: {
          data: { result: 'Processed: Hello world' },
          displayFormat: 'json',
          summary: 'JSON object with 1 properties'
        },
        metadata: {
          executionTime: 1000,
          startedAt: new Date(),
          completedAt: new Date(),
          inputSize: JSON.stringify(input).length
        }
      };

      mockAccessControlService.checkAccess.mockReturnValue({
        allowed: true
      });
      mockDifyApiClient.getWorkflowMetadata.mockResolvedValue(mockWorkflow);
      mockWorkflowExecutionService.executeWorkflow.mockResolvedValue(expectedResult);

      const result = await executeWorkflowWithPermissions(
        mockUser,
        'test-workflow',
        input
      );

      expect(result).toEqual(expectedResult);
      expect(mockAccessControlService.checkAccess).toHaveBeenCalledWith(
        mockUser,
        'workflow:test-workflow',
        'execute'
      );
      expect(mockDifyApiClient.getWorkflowMetadata).toHaveBeenCalledWith('test-workflow');
      expect(mockWorkflowExecutionService.executeWorkflow).toHaveBeenCalledWith(
        'test-workflow',
        input,
        expect.objectContaining({
          userId: 'user-1',
          enableProgressTracking: true
        })
      );
    });

    it('should reject execution when user lacks access permissions', async () => {
      mockAccessControlService.checkAccess.mockReturnValue({
        allowed: false,
        reason: 'Insufficient permissions',
        requiredPermissions: ['workflow:execute']
      });

      await expect(
        executeWorkflowWithPermissions(mockUser, 'test-workflow', { message: 'test' })
      ).rejects.toThrow(WorkflowExecutionError);

      expect(mockDifyApiClient.getWorkflowMetadata).not.toHaveBeenCalled();
      expect(mockWorkflowExecutionService.executeWorkflow).not.toHaveBeenCalled();
    });

    it('should reject execution when user lacks workflow-specific permissions', async () => {
      const restrictedWorkflow = {
        ...mockWorkflow,
        requiredPermissions: ['admin:workflow:execute']
      };

      mockAccessControlService.checkAccess.mockReturnValue({ allowed: true });
      mockDifyApiClient.getWorkflowMetadata.mockResolvedValue(restrictedWorkflow);

      await expect(
        executeWorkflowWithPermissions(mockUser, 'test-workflow', { message: 'test' })
      ).rejects.toThrow(WorkflowExecutionError);

      expect(mockWorkflowExecutionService.executeWorkflow).not.toHaveBeenCalled();
    });

    it('should handle workflow execution errors', async () => {
      mockAccessControlService.checkAccess.mockReturnValue({ allowed: true });
      mockDifyApiClient.getWorkflowMetadata.mockResolvedValue(mockWorkflow);
      mockWorkflowExecutionService.executeWorkflow.mockRejectedValue(
        new Error('Network error')
      );

      await expect(
        executeWorkflowWithPermissions(mockUser, 'test-workflow', { message: 'test' })
      ).rejects.toThrow(WorkflowExecutionError);
    });

    it('should call progress callback during execution', async () => {
      const progressCallback = jest.fn();
      const expectedResult: ProcessedWorkflowResult = {
        executionId: 'exec-1',
        workflowId: 'test-workflow',
        status: 'completed',
        metadata: {
          executionTime: 1000,
          startedAt: new Date(),
          inputSize: 10
        }
      };

      mockAccessControlService.checkAccess.mockReturnValue({ allowed: true });
      mockDifyApiClient.getWorkflowMetadata.mockResolvedValue(mockWorkflow);
      mockWorkflowExecutionService.executeWorkflow.mockResolvedValue(expectedResult);

      await executeWorkflowWithPermissions(
        mockUser,
        'test-workflow',
        { message: 'test' },
        progressCallback
      );

      expect(mockWorkflowExecutionService.executeWorkflow).toHaveBeenCalledWith(
        'test-workflow',
        { message: 'test' },
        expect.objectContaining({
          onProgress: progressCallback
        })
      );
    });
  });

  describe('getAvailableWorkflowsForUser', () => {
    it('should return workflows user has access to', async () => {
      const allWorkflows = [
        mockWorkflow,
        {
          ...mockWorkflow,
          id: 'restricted-workflow',
          requiredPermissions: ['admin:workflow:execute']
        }
      ];

      mockDifyApiClient.getWorkflows.mockResolvedValue(allWorkflows);
      mockAccessControlService.checkAccess
        .mockReturnValueOnce({ allowed: true })  // test-workflow
        .mockReturnValueOnce({ allowed: false }); // restricted-workflow

      const availableWorkflows = await getAvailableWorkflowsForUser(mockUser);

      expect(availableWorkflows).toHaveLength(1);
      expect(availableWorkflows[0].id).toBe('test-workflow');
    });

    it('should handle API errors gracefully', async () => {
      mockDifyApiClient.getWorkflows.mockRejectedValue(new Error('API error'));

      const availableWorkflows = await getAvailableWorkflowsForUser(mockUser);

      expect(availableWorkflows).toEqual([]);
    });

    it('should filter workflows based on required permissions', async () => {
      const userWithLimitedPermissions: User = {
        ...mockUser,
        permissions: [
          { resource: 'workflow:basic', actions: ['execute'] }
        ]
      };

      const workflows = [
        {
          ...mockWorkflow,
          id: 'basic-workflow',
          requiredPermissions: ['workflow:execute']
        },
        {
          ...mockWorkflow,
          id: 'advanced-workflow',
          requiredPermissions: ['workflow:execute', 'advanced:feature']
        }
      ];

      mockDifyApiClient.getWorkflows.mockResolvedValue(workflows);
      mockAccessControlService.checkAccess.mockReturnValue({ allowed: true });

      const availableWorkflows = await getAvailableWorkflowsForUser(userWithLimitedPermissions);

      expect(availableWorkflows).toHaveLength(1);
      expect(availableWorkflows[0].id).toBe('basic-workflow');
    });
  });

  describe('validateWorkflowInputWithDetails', () => {
    it('should return detailed validation results', () => {
      const input = { message: 'Hello' };
      
      mockWorkflowExecutionService.validateWorkflowInput.mockReturnValue({
        valid: true,
        errors: []
      });

      const result = validateWorkflowInputWithDetails(input, mockWorkflow);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    it('should format validation errors properly', () => {
      const input = {};
      
      mockWorkflowExecutionService.validateWorkflowInput.mockReturnValue({
        valid: false,
        errors: [
          { field: 'message', message: 'Required field is missing' }
        ]
      });

      const result = validateWorkflowInputWithDetails(input, mockWorkflow);

      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(['message: Required field is missing']);
    });

    it('should generate performance warnings for large inputs', () => {
      const largeInput = { 
        message: 'x'.repeat(15000) // Large string
      };
      
      mockWorkflowExecutionService.validateWorkflowInput.mockReturnValue({
        valid: true,
        errors: []
      });

      const result = validateWorkflowInputWithDetails(largeInput, mockWorkflow);

      expect(result.valid).toBe(true);
      expect(result.warnings).toContain('message: Large text input may affect performance');
    });

    it('should generate warnings for large arrays', () => {
      const workflowWithArray: DifyWorkflow = {
        ...mockWorkflow,
        inputSchema: {
          type: 'object',
          properties: {
            items: { type: 'array', items: { type: 'string' } }
          }
        }
      };

      const largeArrayInput = { 
        items: new Array(1500).fill('item')
      };
      
      mockWorkflowExecutionService.validateWorkflowInput.mockReturnValue({
        valid: true,
        errors: []
      });

      const result = validateWorkflowInputWithDetails(largeArrayInput, workflowWithArray);

      expect(result.warnings).toContain('items: Large array input may affect performance');
    });
  });

  describe('executeWorkflowChain', () => {
    it('should execute workflow chain successfully', async () => {
      const workflowChain = [
        { workflowId: 'workflow-1', input: { message: 'Hello' } },
        { workflowId: 'workflow-2', input: { prefix: 'Processed:' } }
      ];

      const result1: ProcessedWorkflowResult = {
        executionId: 'exec-1',
        workflowId: 'workflow-1',
        status: 'completed',
        result: {
          data: { output: 'Hello World' },
          displayFormat: 'json'
        },
        metadata: {
          executionTime: 1000,
          startedAt: new Date(),
          inputSize: 10
        }
      };

      const result2: ProcessedWorkflowResult = {
        executionId: 'exec-2',
        workflowId: 'workflow-2',
        status: 'completed',
        result: {
          data: { final: 'Processed: Hello World' },
          displayFormat: 'json'
        },
        metadata: {
          executionTime: 1500,
          startedAt: new Date(),
          inputSize: 15
        }
      };

      mockAccessControlService.checkAccess.mockReturnValue({ allowed: true });
      mockDifyApiClient.getWorkflowMetadata.mockResolvedValue(mockWorkflow);
      mockWorkflowExecutionService.executeWorkflow
        .mockResolvedValueOnce(result1)
        .mockResolvedValueOnce(result2);

      const progressCallback = jest.fn();
      const chainResult = await executeWorkflowChain(
        mockUser,
        workflowChain,
        progressCallback
      );

      expect(chainResult.success).toBe(true);
      expect(chainResult.results).toHaveLength(2);
      expect(chainResult.errors).toHaveLength(0);
      expect(chainResult.completed).toBe(2);
      expect(chainResult.failed).toBe(0);
      expect(progressCallback).toHaveBeenCalled();
    });

    it('should stop chain execution on error', async () => {
      const workflowChain = [
        { workflowId: 'workflow-1', input: { message: 'Hello' } },
        { workflowId: 'workflow-2', input: { prefix: 'Processed:' } }
      ];

      mockAccessControlService.checkAccess.mockReturnValue({ allowed: true });
      mockDifyApiClient.getWorkflowMetadata.mockResolvedValue(mockWorkflow);
      mockWorkflowExecutionService.executeWorkflow
        .mockRejectedValueOnce(new WorkflowExecutionError('Failed', 'execution', 'FAILED'));

      const chainResult = await executeWorkflowChain(mockUser, workflowChain);

      expect(chainResult.success).toBe(false);
      expect(chainResult.results).toHaveLength(0);
      expect(chainResult.errors).toHaveLength(1);
      expect(chainResult.completed).toBe(0);
      expect(chainResult.failed).toBe(1);
    });

    it('should pass output from previous workflow as input to next', async () => {
      const workflowChain = [
        { workflowId: 'workflow-1', input: { message: 'Hello' } },
        { workflowId: 'workflow-2', input: { prefix: 'Processed:' } }
      ];

      const result1: ProcessedWorkflowResult = {
        executionId: 'exec-1',
        workflowId: 'workflow-1',
        status: 'completed',
        result: {
          data: { output: 'Hello World' },
          displayFormat: 'json'
        },
        metadata: {
          executionTime: 1000,
          startedAt: new Date(),
          inputSize: 10
        }
      };

      mockAccessControlService.checkAccess.mockReturnValue({ allowed: true });
      mockDifyApiClient.getWorkflowMetadata.mockResolvedValue(mockWorkflow);
      mockWorkflowExecutionService.executeWorkflow
        .mockResolvedValueOnce(result1)
        .mockResolvedValueOnce({
          ...result1,
          executionId: 'exec-2',
          workflowId: 'workflow-2'
        });

      await executeWorkflowChain(mockUser, workflowChain);

      // Check that second workflow received merged input
      expect(mockWorkflowExecutionService.executeWorkflow).toHaveBeenNthCalledWith(
        2,
        'workflow-2',
        expect.objectContaining({
          prefix: 'Processed:',
          output: 'Hello World' // From previous workflow result
        }),
        expect.any(Object)
      );
    });
  });

  describe('WorkflowExecutionMonitor', () => {
    let monitor: WorkflowExecutionMonitor;

    beforeEach(() => {
      monitor = new WorkflowExecutionMonitor();
      jest.useFakeTimers();
    });

    afterEach(() => {
      monitor.cleanup();
      jest.useRealTimers();
    });

    it('should start monitoring execution', async () => {
      const listener = jest.fn();
      monitor.addListener(listener);

      mockDifyApiClient.getWorkflowStatus.mockResolvedValue({
        executionId: 'exec-1',
        status: 'completed',
        result: { output: 'Done' }
      });

      await monitor.startMonitoring('exec-1', 'workflow-1', 'user-1');

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'started',
          execution: expect.objectContaining({
            executionId: 'exec-1',
            workflowId: 'workflow-1',
            userId: 'user-1'
          })
        })
      );

      // Advance timers to trigger polling
      jest.advanceTimersByTime(2000);
      await Promise.resolve(); // Allow promises to resolve

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'completed'
        })
      );
    });

    it('should handle monitoring errors', async () => {
      const listener = jest.fn();
      monitor.addListener(listener);

      mockDifyApiClient.getWorkflowStatus.mockRejectedValue(new Error('API Error'));

      await monitor.startMonitoring('exec-1', 'workflow-1', 'user-1');

      jest.advanceTimersByTime(2000);
      await Promise.resolve();

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error'
        })
      );
    });

    it('should cancel execution', async () => {
      mockWorkflowExecutionService.cancelExecution.mockResolvedValue(true);

      await monitor.startMonitoring('exec-1', 'workflow-1', 'user-1');
      const result = await monitor.cancelExecution('exec-1');

      expect(result).toBe(true);
      expect(mockWorkflowExecutionService.cancelExecution).toHaveBeenCalledWith('exec-1');
    });

    it('should manage listeners correctly', () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();

      monitor.addListener(listener1);
      monitor.addListener(listener2);
      monitor.removeListener(listener1);

      expect(monitor['listeners'].size).toBe(1);
      expect(monitor['listeners'].has(listener2)).toBe(true);
    });
  });

  describe('Utility Functions', () => {
    describe('formatExecutionResultForDisplay', () => {
      it('should format completed result', () => {
        const result: ProcessedWorkflowResult = {
          executionId: 'exec-1',
          workflowId: 'workflow-1',
          status: 'completed',
          result: {
            data: { output: 'Success' },
            displayFormat: 'json',
            summary: 'Operation completed'
          },
          metadata: {
            executionTime: 2500,
            startedAt: new Date(),
            inputSize: 10
          }
        };

        const formatted = formatExecutionResultForDisplay(result);

        expect(formatted).toBe('✅ Completed in 2.5s - Operation completed');
      });

      it('should format failed result', () => {
        const result: ProcessedWorkflowResult = {
          executionId: 'exec-1',
          workflowId: 'workflow-1',
          status: 'failed',
          error: new WorkflowExecutionError('Test error', 'execution', 'TEST_ERROR'),
          metadata: {
            executionTime: 1000,
            startedAt: new Date(),
            inputSize: 10
          }
        };

        const formatted = formatExecutionResultForDisplay(result);

        expect(formatted).toBe('❌ Execution failed: Test error');
      });

      it('should format cancelled result', () => {
        const result: ProcessedWorkflowResult = {
          executionId: 'exec-1',
          workflowId: 'workflow-1',
          status: 'cancelled',
          metadata: {
            executionTime: 500,
            startedAt: new Date(),
            inputSize: 10
          }
        };

        const formatted = formatExecutionResultForDisplay(result);

        expect(formatted).toBe('⏹️ Execution was cancelled');
      });

      it('should format running result', () => {
        const result: ProcessedWorkflowResult = {
          executionId: 'exec-1',
          workflowId: 'workflow-1',
          status: 'running',
          metadata: {
            executionTime: 1000,
            startedAt: new Date(),
            inputSize: 10
          }
        };

        const formatted = formatExecutionResultForDisplay(result);

        expect(formatted).toBe('⏳ Status: running');
      });
    });

    describe('estimateWorkflowComplexity', () => {
      it('should estimate basic workflow complexity', () => {
        const input = { message: 'Hello' };
        
        const estimate = estimateWorkflowComplexity(mockWorkflow, input);

        expect(estimate.complexity).toBeGreaterThan(0);
        expect(estimate.estimatedDuration).toBeGreaterThan(0);
        expect(estimate.riskLevel).toBe('low');
        expect(estimate.recommendations).toBeDefined();
      });

      it('should increase complexity for large inputs', () => {
        const largeInput = { message: 'x'.repeat(15000) };
        
        const estimate = estimateWorkflowComplexity(mockWorkflow, largeInput);

        expect(estimate.complexity).toBeGreaterThan(1);
        expect(estimate.estimatedDuration).toBeGreaterThan(5000);
      });

      it('should increase complexity for AI-intensive workflows', () => {
        const aiWorkflow: DifyWorkflow = {
          ...mockWorkflow,
          tags: ['ai-intensive']
        };
        
        const estimate = estimateWorkflowComplexity(aiWorkflow, { message: 'test' });

        expect(estimate.complexity).toBeGreaterThan(3);
        expect(estimate.riskLevel).toBe('medium');
      });

      it('should provide appropriate recommendations', () => {
        const complexWorkflow: DifyWorkflow = {
          ...mockWorkflow,
          tags: ['ai-intensive', 'data-processing'],
          requiredPermissions: ['perm1', 'perm2', 'perm3', 'perm4', 'perm5']
        };
        
        const estimate = estimateWorkflowComplexity(complexWorkflow, { message: 'test' });

        expect(estimate.riskLevel).toBe('high');
        expect(estimate.recommendations).toContain('Consider breaking this into smaller workflows');
      });
    });
  });
});