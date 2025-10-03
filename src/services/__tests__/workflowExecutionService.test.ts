import { workflowExecutionService, WorkflowExecutionService, WorkflowExecutionError, validateWorkflowInput } from '../workflowExecutionService';
import { difyApiClient } from '../difyApiClient';
import type { DifyWorkflow, WorkflowInput, WorkflowResult, JSONSchema } from '../../types/dify';

// Mock the difyApiClient
jest.mock('../difyApiClient', () => ({
  difyApiClient: {
    getWorkflowMetadata: jest.fn(),
    executeWorkflow: jest.fn(),
    getWorkflowStatus: jest.fn(),
    cancelWorkflowExecution: jest.fn(),
  },
}));

const mockDifyApiClient = difyApiClient as jest.Mocked<typeof difyApiClient>;

describe('WorkflowExecutionService', () => {
  let service: WorkflowExecutionService;

  beforeEach(() => {
    service = new WorkflowExecutionService();
    jest.clearAllMocks();
    jest.clearAllTimers();
    jest.useFakeTimers();
  });

  afterEach(() => {
    service.cleanup();
    jest.useRealTimers();
  });

  describe('validateWorkflowInput', () => {
    it('should validate simple string input successfully', () => {
      const input = { message: 'Hello world' };
      const schema: JSONSchema = {
        type: 'object',
        properties: {
          message: { type: 'string' }
        },
        required: ['message']
      };

      const result = service.validateWorkflowInput(input, schema);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect missing required fields', () => {
      const input = {};
      const schema: JSONSchema = {
        type: 'object',
        properties: {
          message: { type: 'string' }
        },
        required: ['message']
      };

      const result = service.validateWorkflowInput(input, schema);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].field).toBe('message');
      expect(result.errors[0].message).toContain('Required field');
    });

    it('should validate type mismatches', () => {
      const input = { message: 123 };
      const schema: JSONSchema = {
        type: 'object',
        properties: {
          message: { type: 'string' }
        }
      };

      const result = service.validateWorkflowInput(input, schema);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].field).toBe('message');
      expect(result.errors[0].message).toContain('Expected type');
    });

    it('should validate string length constraints', () => {
      const input = { message: 'Hi' };
      const schema: JSONSchema = {
        type: 'object',
        properties: {
          message: { 
            type: 'string',
            minLength: 5,
            maxLength: 100
          }
        }
      };

      const result = service.validateWorkflowInput(input, schema);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('at least 5 characters');
    });

    it('should validate string patterns', () => {
      const input = { email: 'invalid-email' };
      const schema: JSONSchema = {
        type: 'object',
        properties: {
          email: { 
            type: 'string',
            pattern: '^[^@]+@[^@]+\\.[^@]+$'
          }
        }
      };

      const result = service.validateWorkflowInput(input, schema);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('does not match required pattern');
    });

    it('should validate number constraints', () => {
      const input = { age: 150 };
      const schema: JSONSchema = {
        type: 'object',
        properties: {
          age: { 
            type: 'number',
            minimum: 0,
            maximum: 120
          }
        }
      };

      const result = service.validateWorkflowInput(input, schema);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('at most 120');
    });

    it('should validate enum values', () => {
      const input = { status: 'invalid' };
      const schema: JSONSchema = {
        type: 'object',
        properties: {
          status: { 
            type: 'string',
            enum: ['active', 'inactive', 'pending']
          }
        }
      };

      const result = service.validateWorkflowInput(input, schema);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('must be one of');
    });

    it('should validate array items', () => {
      const input = { tags: ['valid', 123, 'also-valid'] };
      const schema: JSONSchema = {
        type: 'object',
        properties: {
          tags: { 
            type: 'array',
            items: { type: 'string' }
          }
        }
      };

      const result = service.validateWorkflowInput(input, schema);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].field).toBe('tags[1]');
      expect(result.errors[0].message).toContain('Expected type');
    });

    it('should validate nested objects', () => {
      const input = { 
        user: { 
          name: 'John',
          age: 'thirty' // should be number
        }
      };
      const schema: JSONSchema = {
        type: 'object',
        properties: {
          user: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              age: { type: 'number' }
            }
          }
        }
      };

      const result = service.validateWorkflowInput(input, schema);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].field).toBe('user.age');
    });

    it('should reject additional properties when not allowed', () => {
      const input = { 
        message: 'Hello',
        extra: 'not allowed'
      };
      const schema: JSONSchema = {
        type: 'object',
        properties: {
          message: { type: 'string' }
        },
        additionalProperties: false
      };

      const result = service.validateWorkflowInput(input, schema);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].field).toBe('extra');
      expect(result.errors[0].message).toContain('Additional property');
    });

    it('should handle complex nested validation', () => {
      const input = {
        workflow: {
          name: 'Test Workflow',
          steps: [
            { id: 1, action: 'process' },
            { id: 'invalid', action: 'invalid-action' }
          ]
        }
      };
      const schema: JSONSchema = {
        type: 'object',
        properties: {
          workflow: {
            type: 'object',
            properties: {
              name: { type: 'string', minLength: 3 },
              steps: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'number' },
                    action: { type: 'string', enum: ['process', 'validate', 'transform'] }
                  },
                  required: ['id', 'action']
                }
              }
            }
          }
        }
      };

      const result = service.validateWorkflowInput(input, schema);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(2);
      
      const fieldErrors = result.errors.map(e => e.field);
      expect(fieldErrors).toContain('workflow.steps[1].id');
      expect(fieldErrors).toContain('workflow.steps[1].action');
    });
  });

  describe('executeWorkflow', () => {
    const mockWorkflow: DifyWorkflow = {
      id: 'workflow-1',
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
      mockDifyApiClient.getWorkflowMetadata.mockResolvedValue(mockWorkflow);
    });

    it('should execute workflow successfully', async () => {
      const input = { message: 'Hello world' };
      const executionResult = {
        executionId: 'exec-1',
        status: 'running' as const
      };
      const finalResult: WorkflowResult = {
        executionId: 'exec-1',
        status: 'completed',
        result: { result: 'Processed: Hello world' },
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        duration: 1000
      };

      mockDifyApiClient.executeWorkflow.mockResolvedValue(executionResult);
      mockDifyApiClient.getWorkflowStatus.mockResolvedValue(finalResult);

      const result = await service.executeWorkflow('workflow-1', input, {
        enableProgressTracking: false
      });

      expect(result.status).toBe('completed');
      expect(result.result?.data).toEqual({ result: 'Processed: Hello world' });
      expect(result.metadata.executionTime).toBeGreaterThan(0);
    });

    it('should handle validation errors', async () => {
      const input = {}; // missing required message field

      const result = await service.executeWorkflow('workflow-1', input);

      expect(result.status).toBe('failed');
      expect(result.error?.type).toBe('validation');
      expect(result.error?.code).toBe('INVALID_INPUT');
    });

    it('should handle execution timeout', async () => {
      const input = { message: 'Hello world' };
      const executionResult = {
        executionId: 'exec-1',
        status: 'running' as const
      };
      const runningResult: WorkflowResult = {
        executionId: 'exec-1',
        status: 'running'
      };

      mockDifyApiClient.executeWorkflow.mockResolvedValue(executionResult);
      mockDifyApiClient.getWorkflowStatus.mockResolvedValue(runningResult);

      const resultPromise = service.executeWorkflow('workflow-1', input, {
        timeout: 1000,
        enableProgressTracking: false
      });

      // Fast-forward time to trigger timeout
      jest.advanceTimersByTime(2000);

      const result = await resultPromise;

      expect(result.status).toBe('failed');
      expect(result.error?.type).toBe('timeout');
      expect(result.error?.code).toBe('EXECUTION_TIMEOUT');
    });

    it('should track progress during execution', async () => {
      const input = { message: 'Hello world' };
      const executionResult = {
        executionId: 'exec-1',
        status: 'running' as const
      };
      const progressUpdates: any[] = [];

      mockDifyApiClient.executeWorkflow.mockResolvedValue(executionResult);
      
      // Mock progressive status updates
      let callCount = 0;
      mockDifyApiClient.getWorkflowStatus.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            executionId: 'exec-1',
            status: 'running'
          });
        } else {
          return Promise.resolve({
            executionId: 'exec-1',
            status: 'completed',
            result: { result: 'Done' }
          });
        }
      });

      const resultPromise = service.executeWorkflow('workflow-1', input, {
        enableProgressTracking: true,
        pollInterval: 100,
        onProgress: (progress) => {
          progressUpdates.push(progress);
        }
      });

      // Advance timers to trigger progress polling
      jest.advanceTimersByTime(300);

      const result = await resultPromise;

      expect(result.status).toBe('completed');
      expect(progressUpdates.length).toBeGreaterThan(0);
      expect(progressUpdates[0].executionId).toBe('exec-1');
    });

    it('should handle API errors gracefully', async () => {
      const input = { message: 'Hello world' };
      
      mockDifyApiClient.executeWorkflow.mockRejectedValue({
        type: 'authentication',
        code: 'INVALID_TOKEN',
        message: 'Invalid authentication token'
      });

      const result = await service.executeWorkflow('workflow-1', input);

      expect(result.status).toBe('failed');
      expect(result.error?.type).toBe('permission');
      expect(result.error?.code).toBe('INVALID_TOKEN');
    });
  });

  describe('cancelExecution', () => {
    it('should cancel execution successfully', async () => {
      mockDifyApiClient.cancelWorkflowExecution.mockResolvedValue(true);

      const result = await service.cancelExecution('exec-1');

      expect(result).toBe(true);
      expect(mockDifyApiClient.cancelWorkflowExecution).toHaveBeenCalledWith('exec-1');
    });

    it('should handle cancellation failures', async () => {
      mockDifyApiClient.cancelWorkflowExecution.mockRejectedValue(new Error('Network error'));

      const result = await service.cancelExecution('exec-1');

      expect(result).toBe(false);
    });
  });

  describe('result formatting', () => {
    it('should format text results correctly', () => {
      const service = new WorkflowExecutionService();
      const data = 'This is a simple text result';
      const schema: JSONSchema = { type: 'string' };

      const formatted = service['formatResult'](data, schema);

      expect(formatted.displayFormat).toBe('text');
      expect(formatted.data).toBe(data);
    });

    it('should detect HTML content', () => {
      const service = new WorkflowExecutionService();
      const data = '<div>HTML content</div>';
      const schema: JSONSchema = { type: 'string' };

      const formatted = service['formatResult'](data, schema);

      expect(formatted.displayFormat).toBe('html');
    });

    it('should format tabular data', () => {
      const service = new WorkflowExecutionService();
      const data = [
        { name: 'John', age: 30 },
        { name: 'Jane', age: 25 }
      ];
      const schema: JSONSchema = { type: 'array' };

      const formatted = service['formatResult'](data, schema);

      expect(formatted.displayFormat).toBe('table');
      expect(formatted.summary).toContain('2 rows');
    });

    it('should detect image data', () => {
      const service = new WorkflowExecutionService();
      const data = { type: 'image', imageUrl: 'https://example.com/image.png' };
      const schema: JSONSchema = { type: 'object' };

      const formatted = service['formatResult'](data, schema);

      expect(formatted.displayFormat).toBe('image');
      expect(formatted.summary).toBe('Generated image');
    });

    it('should detect chart data', () => {
      const service = new WorkflowExecutionService();
      const data = { chartData: { labels: ['A', 'B'], values: [1, 2] } };
      const schema: JSONSchema = { type: 'object' };

      const formatted = service['formatResult'](data, schema);

      expect(formatted.displayFormat).toBe('chart');
      expect(formatted.summary).toBe('Chart visualization');
    });
  });

  describe('error handling', () => {
    it('should categorize different error types correctly', () => {
      const service = new WorkflowExecutionService();

      // Test validation error
      const validationError = service['handleExecutionError']({
        type: 'validation',
        code: 'INVALID_INPUT',
        message: 'Invalid input data'
      });
      expect(validationError.type).toBe('validation');

      // Test network error
      const networkError = service['handleExecutionError']({
        type: 'network',
        code: 'CONNECTION_FAILED',
        message: 'Network connection failed'
      });
      expect(networkError.type).toBe('network');
      expect(networkError.retryable).toBe(true);

      // Test generic error
      const genericError = service['handleExecutionError'](new Error('Something went wrong'));
      expect(genericError.type).toBe('execution');
      expect(genericError.code).toBe('UNKNOWN_ERROR');
    });

    it('should preserve WorkflowExecutionError instances', () => {
      const service = new WorkflowExecutionService();
      const originalError = new WorkflowExecutionError(
        'Test error',
        'validation',
        'TEST_ERROR'
      );

      const handledError = service['handleExecutionError'](originalError);

      expect(handledError).toBe(originalError);
    });
  });

  describe('cleanup', () => {
    it('should clean up all active resources', () => {
      const service = new WorkflowExecutionService();
      
      // Simulate active executions
      service['activeExecutions'].set('exec-1', {
        executionId: 'exec-1',
        workflowId: 'workflow-1',
        status: 'running',
        progress: 50,
        startedAt: new Date(),
        lastUpdated: new Date()
      });

      service.cleanup();

      expect(service['activeExecutions'].size).toBe(0);
      expect(service['progressPollers'].size).toBe(0);
    });
  });
});

describe('Utility Functions', () => {
  describe('validateWorkflowInput', () => {
    it('should work as standalone function', () => {
      const input = { message: 'Hello' };
      const schema: JSONSchema = {
        type: 'object',
        properties: {
          message: { type: 'string' }
        },
        required: ['message']
      };

      const result = validateWorkflowInput(input, schema);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });
});