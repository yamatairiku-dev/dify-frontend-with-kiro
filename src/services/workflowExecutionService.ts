import { difyApiClient } from './difyApiClient';
import type {
  DifyWorkflow,
  WorkflowInput,
  WorkflowResult,
  WorkflowExecutionStatus,
  JSONSchema,
  DifyApiError,
} from '../types/dify';

/**
 * Workflow Execution Service
 * 
 * Provides comprehensive workflow execution capabilities including:
 * - JSON Schema-based input validation
 * - Progress tracking and status monitoring
 * - Result processing and formatting
 * - Error handling for Dify API failures
 */

// Validation result types
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

export interface ValidationError {
  field: string;
  message: string;
  value?: any;
  expectedType?: string;
}

// Progress tracking types
export interface WorkflowProgress {
  executionId: string;
  workflowId: string;
  status: WorkflowExecutionStatus;
  progress: number; // 0-100
  currentStep?: string;
  estimatedTimeRemaining?: number;
  startedAt: Date;
  lastUpdated: Date;
}

// Execution options
export interface WorkflowExecutionOptions {
  userId?: string;
  timeout?: number;
  pollInterval?: number;
  enableProgressTracking?: boolean;
  onProgress?: (progress: WorkflowProgress) => void;
  onError?: (error: WorkflowExecutionError) => void;
}

// Enhanced result types
export interface ProcessedWorkflowResult {
  executionId: string;
  workflowId: string;
  status: WorkflowExecutionStatus;
  result?: FormattedResult;
  error?: WorkflowExecutionError;
  metadata: ResultMetadata;
}

export interface FormattedResult {
  data: any;
  displayFormat: 'text' | 'json' | 'table' | 'chart' | 'image' | 'html';
  summary?: string;
  downloadUrl?: string;
}

export interface ResultMetadata {
  executionTime: number;
  startedAt: Date;
  completedAt?: Date;
  inputSize: number;
  outputSize?: number;
  steps?: ExecutionStep[];
}

export interface ExecutionStep {
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt?: Date;
  completedAt?: Date;
  duration?: number;
  output?: any;
}

// Error types
export class WorkflowExecutionError extends Error {
  public readonly type: 'validation' | 'execution' | 'timeout' | 'network' | 'permission';
  public readonly code: string;
  public readonly details?: any;
  public readonly retryable: boolean;

  constructor(
    message: string,
    type: WorkflowExecutionError['type'],
    code: string,
    details?: any,
    retryable = false
  ) {
    super(message);
    this.name = 'WorkflowExecutionError';
    this.type = type;
    this.code = code;
    this.details = details;
    this.retryable = retryable;
  }
}

export class WorkflowExecutionService {
  private activeExecutions = new Map<string, WorkflowProgress>();
  private progressPollers = new Map<string, NodeJS.Timeout>();

  /**
   * Validate workflow input against JSON schema
   */
  validateWorkflowInput(input: WorkflowInput, schema: JSONSchema): ValidationResult {
    const errors: ValidationError[] = [];

    try {
      this.validateObject(input, schema, '', errors);
    } catch (error) {
      errors.push({
        field: 'root',
        message: `Schema validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Execute workflow with comprehensive progress tracking and error handling
   */
  async executeWorkflow(
    workflowId: string,
    input: WorkflowInput,
    options: WorkflowExecutionOptions = {}
  ): Promise<ProcessedWorkflowResult> {
    const startTime = Date.now();

    try {
      // Get workflow metadata for validation
      const workflow = await difyApiClient.getWorkflowMetadata(workflowId);
      
      // Validate input
      const validationResult = this.validateWorkflowInput(input, workflow.inputSchema);
      if (!validationResult.valid) {
        throw new WorkflowExecutionError(
          'Input validation failed',
          'validation',
          'INVALID_INPUT',
          { errors: validationResult.errors }
        );
      }

      // Start execution
      const executionResult = await difyApiClient.executeWorkflow(
        workflowId,
        input,
        options.userId
      );

      // Initialize progress tracking
      const progress: WorkflowProgress = {
        executionId: executionResult.executionId,
        workflowId,
        status: executionResult.status,
        progress: 0,
        startedAt: new Date(),
        lastUpdated: new Date(),
      };

      this.activeExecutions.set(executionResult.executionId, progress);

      // Start progress monitoring if enabled
      if (options.enableProgressTracking !== false) {
        this.startProgressMonitoring(
          executionResult.executionId,
          options.pollInterval || 2000,
          options.onProgress,
          options.onError
        );
      }

      // Wait for completion or timeout
      const finalResult = await this.waitForCompletion(
        executionResult.executionId,
        options.timeout || 300000 // 5 minutes default
      );

      // Process and format result
      return this.processResult(finalResult, workflow, startTime, input);

    } catch (error) {
      // Handle and categorize errors
      const workflowError = this.handleExecutionError(error);
      
      return {
        executionId: 'failed',
        workflowId,
        status: 'failed',
        error: workflowError,
        metadata: {
          executionTime: Date.now() - startTime,
          startedAt: new Date(startTime),
          inputSize: JSON.stringify(input).length,
        },
      };
    }
  }

  /**
   * Get current progress for an execution
   */
  getExecutionProgress(executionId: string): WorkflowProgress | null {
    return this.activeExecutions.get(executionId) || null;
  }

  /**
   * Cancel a running workflow execution
   */
  async cancelExecution(executionId: string): Promise<boolean> {
    try {
      // Stop progress monitoring
      this.stopProgressMonitoring(executionId);
      
      // Cancel on server
      const cancelled = await difyApiClient.cancelWorkflowExecution(executionId);
      
      // Update local state
      const progress = this.activeExecutions.get(executionId);
      if (progress) {
        progress.status = 'cancelled';
        progress.lastUpdated = new Date();
      }

      return cancelled;
    } catch (error) {
      console.error('Failed to cancel execution:', error);
      return false;
    }
  }

  /**
   * Private method to validate object against schema recursively
   */
  private validateObject(
    obj: any,
    schema: JSONSchema,
    path: string,
    errors: ValidationError[]
  ): void {
    // Check required fields
    if (schema.required) {
      for (const field of schema.required) {
        if (!(field in obj)) {
          errors.push({
            field: path ? `${path}.${field}` : field,
            message: `Required field '${field}' is missing`,
          });
        }
      }
    }

    // Validate properties
    if (schema.properties) {
      for (const [key, propSchema] of Object.entries(schema.properties)) {
        const fieldPath = path ? `${path}.${key}` : key;
        const value = obj[key];

        if (value !== undefined) {
          this.validateValue(value, propSchema, fieldPath, errors);
        }
      }
    }

    // Check additional properties
    if (schema.additionalProperties === false) {
      const allowedKeys = new Set(Object.keys(schema.properties || {}));
      for (const key of Object.keys(obj)) {
        if (!allowedKeys.has(key)) {
          const value = obj[key];
          errors.push({
            field: path ? `${path}.${key}` : key,
            message: `Additional property '${key}' is not allowed`,
            value,
          });
        }
      }
    }
  }

  /**
   * Private method to validate individual values
   */
  private validateValue(
    value: any,
    schema: any,
    path: string,
    errors: ValidationError[]
  ): void {
    // Type validation
    const actualType = Array.isArray(value) ? 'array' : typeof value;
    if (schema.type && schema.type !== actualType) {
      errors.push({
        field: path,
        message: `Expected type '${schema.type}' but got '${actualType}'`,
        value,
        expectedType: schema.type,
      });
      return;
    }

    // String validations
    if (schema.type === 'string' && typeof value === 'string') {
      if (schema.minLength && value.length < schema.minLength) {
        errors.push({
          field: path,
          message: `String must be at least ${schema.minLength} characters long`,
          value,
        });
      }
      if (schema.maxLength && value.length > schema.maxLength) {
        errors.push({
          field: path,
          message: `String must be at most ${schema.maxLength} characters long`,
          value,
        });
      }
      if (schema.pattern && !new RegExp(schema.pattern).test(value)) {
        errors.push({
          field: path,
          message: `String does not match required pattern: ${schema.pattern}`,
          value,
        });
      }
    }

    // Number validations
    if (schema.type === 'number' && typeof value === 'number') {
      if (schema.minimum !== undefined && value < schema.minimum) {
        errors.push({
          field: path,
          message: `Number must be at least ${schema.minimum}`,
          value,
        });
      }
      if (schema.maximum !== undefined && value > schema.maximum) {
        errors.push({
          field: path,
          message: `Number must be at most ${schema.maximum}`,
          value,
        });
      }
    }

    // Enum validation
    if (schema.enum && !schema.enum.includes(value)) {
      errors.push({
        field: path,
        message: `Value must be one of: ${schema.enum.join(', ')}`,
        value,
      });
    }

    // Array validation
    if (schema.type === 'array' && Array.isArray(value)) {
      if (schema.items) {
        value.forEach((item, index) => {
          this.validateValue(item, schema.items, `${path}[${index}]`, errors);
        });
      }
    }

    // Object validation
    if (schema.type === 'object' && typeof value === 'object' && value !== null) {
      this.validateObject(value, schema, path, errors);
    }
  }  /**

   * Private method to start progress monitoring
   */
  private startProgressMonitoring(
    executionId: string,
    pollInterval: number,
    onProgress?: (progress: WorkflowProgress) => void,
    onError?: (error: WorkflowExecutionError) => void
  ): void {
    const poller = setInterval(async () => {
      try {
        const status = await difyApiClient.getWorkflowStatus(executionId);
        const progress = this.activeExecutions.get(executionId);
        
        if (progress) {
          progress.status = status.status;
          progress.lastUpdated = new Date();
          
          // Calculate progress percentage based on status
          switch (status.status) {
            case 'pending':
              progress.progress = 0;
              break;
            case 'running':
              progress.progress = Math.min(50 + (Date.now() - progress.startedAt.getTime()) / 1000, 90);
              break;
            case 'completed':
            case 'failed':
            case 'cancelled':
              progress.progress = 100;
              this.stopProgressMonitoring(executionId);
              break;
          }

          // Estimate remaining time
          if (status.status === 'running' && progress.progress > 10) {
            const elapsed = Date.now() - progress.startedAt.getTime();
            const estimatedTotal = (elapsed / progress.progress) * 100;
            progress.estimatedTimeRemaining = Math.max(0, estimatedTotal - elapsed);
          }

          onProgress?.(progress);
        }

        // Stop monitoring if execution is complete
        if (['completed', 'failed', 'cancelled'].includes(status.status)) {
          this.stopProgressMonitoring(executionId);
        }
      } catch (error) {
        const workflowError = this.handleExecutionError(error);
        onError?.(workflowError);
        
        // Stop monitoring on persistent errors
        if (!workflowError.retryable) {
          this.stopProgressMonitoring(executionId);
        }
      }
    }, pollInterval);

    this.progressPollers.set(executionId, poller);
  }

  /**
   * Private method to stop progress monitoring
   */
  private stopProgressMonitoring(executionId: string): void {
    const poller = this.progressPollers.get(executionId);
    if (poller) {
      clearInterval(poller);
      this.progressPollers.delete(executionId);
    }
    this.activeExecutions.delete(executionId);
  }

  /**
   * Private method to wait for execution completion
   */
  private async waitForCompletion(
    executionId: string,
    timeout: number
  ): Promise<WorkflowResult> {
    const startTime = Date.now();
    
    return new Promise((resolve, reject) => {
      const checkStatus = async () => {
        try {
          const status = await difyApiClient.getWorkflowStatus(executionId);
          
          if (['completed', 'failed', 'cancelled'].includes(status.status)) {
            resolve(status);
            return;
          }

          // Check timeout
          if (Date.now() - startTime > timeout) {
            reject(new WorkflowExecutionError(
              'Workflow execution timed out',
              'timeout',
              'EXECUTION_TIMEOUT',
              { executionId, timeout },
              true
            ));
            return;
          }

          // Continue polling
          setTimeout(checkStatus, 2000);
        } catch (error) {
          reject(this.handleExecutionError(error));
        }
      };

      checkStatus();
    });
  }

  /**
   * Private method to process and format execution results
   */
  private processResult(
    result: WorkflowResult,
    workflow: DifyWorkflow,
    startTime: number,
    input: WorkflowInput
  ): ProcessedWorkflowResult {
    const completedAt = new Date();
    const executionTime = completedAt.getTime() - startTime;

    let formattedResult: FormattedResult | undefined;
    
    if (result.result) {
      formattedResult = this.formatResult(result.result, workflow.outputSchema);
    }

    return {
      executionId: result.executionId,
      workflowId: workflow.id,
      status: result.status,
      result: formattedResult,
      error: result.error ? new WorkflowExecutionError(
        result.error,
        'execution',
        'WORKFLOW_ERROR',
        result
      ) : undefined,
      metadata: {
        executionTime,
        startedAt: new Date(startTime),
        completedAt: result.status === 'completed' ? completedAt : undefined,
        inputSize: JSON.stringify(input).length,
        outputSize: result.result ? JSON.stringify(result.result).length : undefined,
        steps: this.extractExecutionSteps(result),
      },
    };
  }

  /**
   * Private method to format results based on output schema and content type
   */
  private formatResult(data: any, outputSchema: JSONSchema): FormattedResult {
    // Determine display format based on data type and schema
    let displayFormat: FormattedResult['displayFormat'] = 'json';
    let summary: string | undefined;

    // Analyze data structure to determine best display format
    if (typeof data === 'string') {
      // Check if it's HTML
      if (data.trim().startsWith('<') && data.trim().endsWith('>')) {
        displayFormat = 'html';
      } else if (data.length > 1000) {
        displayFormat = 'text';
        summary = `Text output (${data.length} characters)`;
      } else {
        displayFormat = 'text';
      }
    } else if (Array.isArray(data)) {
      // Check if it's tabular data
      if (data.length > 0 && typeof data[0] === 'object' && !Array.isArray(data[0])) {
        displayFormat = 'table';
        summary = `Table with ${data.length} rows`;
      } else {
        displayFormat = 'json';
      }
    } else if (typeof data === 'object' && data !== null) {
      // Check for specific data patterns
      if (data.type === 'image' || data.imageUrl || data.base64Image) {
        displayFormat = 'image';
        summary = 'Generated image';
      } else if (data.chartData || data.plotData) {
        displayFormat = 'chart';
        summary = 'Chart visualization';
      } else {
        displayFormat = 'json';
      }
    }

    // Generate summary if not already set
    if (!summary) {
      if (displayFormat === 'json') {
        const keys = Object.keys(data || {});
        summary = `JSON object with ${keys.length} properties`;
      }
    }

    return {
      data,
      displayFormat,
      summary,
    };
  }

  /**
   * Private method to extract execution steps from result
   */
  private extractExecutionSteps(result: WorkflowResult): ExecutionStep[] {
    // This would typically come from the Dify API response
    // For now, we'll create basic steps based on the execution status
    const steps: ExecutionStep[] = [
      {
        name: 'Input Validation',
        status: 'completed',
        startedAt: result.startedAt ? new Date(result.startedAt) : undefined,
        completedAt: result.startedAt ? new Date(result.startedAt) : undefined,
        duration: 100,
      },
      {
        name: 'Workflow Execution',
        status: result.status === 'completed' ? 'completed' : 
               result.status === 'failed' ? 'failed' : 'running',
        startedAt: result.startedAt ? new Date(result.startedAt) : undefined,
        completedAt: result.completedAt ? new Date(result.completedAt) : undefined,
        duration: result.duration,
      },
    ];

    if (result.status === 'completed') {
      steps.push({
        name: 'Result Processing',
        status: 'completed',
        completedAt: result.completedAt ? new Date(result.completedAt) : undefined,
        duration: 50,
      });
    }

    return steps;
  }

  /**
   * Private method to handle and categorize execution errors
   */
  private handleExecutionError(error: any): WorkflowExecutionError {
    if (error instanceof WorkflowExecutionError) {
      return error;
    }

    // Handle Dify API errors
    if (error && typeof error === 'object' && 'type' in error) {
      const difyError = error as DifyApiError;
      
      switch (difyError.type) {
        case 'validation':
          return new WorkflowExecutionError(
            difyError.message,
            'validation',
            difyError.code,
            difyError.details
          );
        case 'authentication':
        case 'authorization':
          return new WorkflowExecutionError(
            difyError.message,
            'permission',
            difyError.code,
            difyError.details
          );
        case 'network':
        case 'rate_limit':
          return new WorkflowExecutionError(
            difyError.message,
            'network',
            difyError.code,
            difyError.details,
            true // retryable
          );
        default:
          return new WorkflowExecutionError(
            difyError.message,
            'execution',
            difyError.code,
            difyError.details,
            difyError.type === 'server_error'
          );
      }
    }

    // Handle generic errors
    const message = error instanceof Error ? error.message : 'Unknown execution error';
    return new WorkflowExecutionError(
      message,
      'execution',
      'UNKNOWN_ERROR',
      error,
      false
    );
  }

  /**
   * Clean up resources
   */
  cleanup(): void {
    // Stop all active pollers
    for (const [executionId] of this.progressPollers) {
      this.stopProgressMonitoring(executionId);
    }
  }
}

// Export singleton instance
export const workflowExecutionService = new WorkflowExecutionService();

// Export utility functions for standalone use
export function validateWorkflowInput(input: WorkflowInput, schema: JSONSchema): ValidationResult {
  return workflowExecutionService.validateWorkflowInput(input, schema);
}

export function formatWorkflowResult(data: any, outputSchema: JSONSchema): FormattedResult {
  return workflowExecutionService['formatResult'](data, outputSchema);
}