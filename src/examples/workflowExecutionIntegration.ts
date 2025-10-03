/**
 * Workflow Execution Integration Examples
 * 
 * Demonstrates how to use the workflow execution system with access control
 * and Dify API integration for complete workflow management.
 */

import { workflowExecutionService, WorkflowExecutionError } from '../services/workflowExecutionService';
import { accessControlService } from '../services/accessControlService';
import { difyApiClient } from '../services/difyApiClient';
import type { User } from '../types/auth';
import type { 
  DifyWorkflow, 
  WorkflowInput, 
  ProcessedWorkflowResult,
  WorkflowProgress 
} from '../types/dify';

/**
 * Complete workflow execution with permission checking and progress tracking
 */
export async function executeWorkflowWithPermissions(
  user: User,
  workflowId: string,
  input: WorkflowInput,
  onProgress?: (progress: WorkflowProgress) => void
): Promise<ProcessedWorkflowResult> {
  try {
    // Step 1: Check user permissions
    const accessResult = accessControlService.checkAccess(
      user,
      `workflow:${workflowId}`,
      'execute'
    );

    if (!accessResult.allowed) {
      throw new WorkflowExecutionError(
        `Access denied: ${accessResult.reason}`,
        'permission',
        'ACCESS_DENIED',
        { 
          requiredPermissions: accessResult.requiredPermissions,
          missingConditions: accessResult.missingConditions 
        }
      );
    }

    // Step 2: Get workflow metadata to verify it exists and user has access
    const workflow = await difyApiClient.getWorkflowMetadata(workflowId);
    
    // Step 3: Verify user has required permissions for this specific workflow
    const hasRequiredPermissions = workflow.requiredPermissions.every(permission =>
      user.permissions.some(userPerm => 
        (userPerm.resource === permission || userPerm.resource === '*') &&
        (userPerm.actions.includes('execute') || userPerm.actions.includes('*'))
      )
    );

    if (!hasRequiredPermissions) {
      throw new WorkflowExecutionError(
        'Insufficient permissions for this workflow',
        'permission',
        'INSUFFICIENT_PERMISSIONS',
        { requiredPermissions: workflow.requiredPermissions }
      );
    }

    // Step 4: Execute workflow with progress tracking
    const result = await workflowExecutionService.executeWorkflow(
      workflowId,
      input,
      {
        userId: user.id,
        enableProgressTracking: true,
        onProgress,
        onError: (error) => {
          console.error('Workflow execution error:', error);
        }
      }
    );

    return result;

  } catch (error) {
    console.error('Failed to execute workflow:', error);
    
    if (error instanceof WorkflowExecutionError) {
      throw error;
    }

    throw new WorkflowExecutionError(
      'Workflow execution failed',
      'execution',
      'EXECUTION_FAILED',
      error
    );
  }
}

/**
 * Get available workflows for a user based on their permissions
 */
export async function getAvailableWorkflowsForUser(user: User): Promise<DifyWorkflow[]> {
  try {
    // Get all workflows from Dify API
    const allWorkflows = await difyApiClient.getWorkflows();
    
    // Filter workflows based on user permissions
    const availableWorkflows = allWorkflows.filter(workflow => {
      // Check if user can access this workflow
      const accessResult = accessControlService.checkAccess(
        user,
        `workflow:${workflow.id}`,
        'read'
      );

      if (!accessResult.allowed) {
        return false;
      }

      // Check if user has all required permissions for the workflow
      return workflow.requiredPermissions.every(permission =>
        user.permissions.some(userPerm => 
          (userPerm.resource === permission || userPerm.resource === '*') &&
          (userPerm.actions.includes('execute') || userPerm.actions.includes('*'))
        )
      );
    });

    return availableWorkflows;

  } catch (error) {
    console.error('Failed to get available workflows:', error);
    return [];
  }
}

/**
 * Validate workflow input with enhanced error reporting
 */
export function validateWorkflowInputWithDetails(
  input: WorkflowInput,
  workflow: DifyWorkflow
): { valid: boolean; errors: string[]; warnings: string[] } {
  const validationResult = workflowExecutionService.validateWorkflowInput(
    input,
    workflow.inputSchema
  );

  const errors = validationResult.errors.map(error => 
    `${error.field}: ${error.message}`
  );

  const warnings: string[] = [];

  // Add custom validation warnings
  if (workflow.inputSchema.properties) {
    Object.entries(workflow.inputSchema.properties).forEach(([key, schema]) => {
      const value = input[key];
      
      // Check for potential performance issues
      if (schema.type === 'string' && typeof value === 'string' && value.length > 10000) {
        warnings.push(`${key}: Large text input may affect performance`);
      }
      
      if (schema.type === 'array' && Array.isArray(value) && value.length > 1000) {
        warnings.push(`${key}: Large array input may affect performance`);
      }
    });
  }

  return {
    valid: validationResult.valid,
    errors,
    warnings
  };
}

/**
 * Execute multiple workflows in sequence with error handling
 */
export async function executeWorkflowChain(
  user: User,
  workflowChain: Array<{ workflowId: string; input: WorkflowInput }>,
  onProgress?: (chainProgress: ChainProgress) => void
): Promise<ChainExecutionResult> {
  const results: ProcessedWorkflowResult[] = [];
  const errors: WorkflowExecutionError[] = [];
  let currentInput: WorkflowInput = {};

  for (let i = 0; i < workflowChain.length; i++) {
    const { workflowId, input } = workflowChain[i];
    
    try {
      // Merge previous result with current input
      const mergedInput = { ...input, ...currentInput };
      
      onProgress?.({
        currentStep: i + 1,
        totalSteps: workflowChain.length,
        currentWorkflowId: workflowId,
        completedWorkflows: results.length,
        failedWorkflows: errors.length
      });

      const result = await executeWorkflowWithPermissions(
        user,
        workflowId,
        mergedInput,
        (progress) => {
          onProgress?.({
            currentStep: i + 1,
            totalSteps: workflowChain.length,
            currentWorkflowId: workflowId,
            completedWorkflows: results.length,
            failedWorkflows: errors.length,
            currentWorkflowProgress: progress
          });
        }
      );

      results.push(result);

      // Use result as input for next workflow if successful
      if (result.status === 'completed' && result.result?.data) {
        currentInput = result.result.data;
      }

    } catch (error) {
      const workflowError = error instanceof WorkflowExecutionError 
        ? error 
        : new WorkflowExecutionError(
            'Chain execution failed',
            'execution',
            'CHAIN_FAILED',
            error
          );
      
      errors.push(workflowError);
      
      // Stop chain execution on error (could be made configurable)
      break;
    }
  }

  return {
    results,
    errors,
    completed: results.length,
    failed: errors.length,
    total: workflowChain.length,
    success: errors.length === 0
  };
}

/**
 * Monitor multiple workflow executions
 */
export class WorkflowExecutionMonitor {
  private activeExecutions = new Map<string, WorkflowMonitorInfo>();
  private listeners = new Set<(update: MonitorUpdate) => void>();

  async startMonitoring(
    executionId: string,
    workflowId: string,
    userId: string
  ): Promise<void> {
    const info: WorkflowMonitorInfo = {
      executionId,
      workflowId,
      userId,
      startedAt: new Date(),
      lastUpdate: new Date(),
      status: 'running'
    };

    this.activeExecutions.set(executionId, info);
    this.notifyListeners({ type: 'started', execution: info });

    // Start monitoring
    this.pollExecution(executionId);
  }

  private async pollExecution(executionId: string): Promise<void> {
    const info = this.activeExecutions.get(executionId);
    if (!info) return;

    try {
      const status = await difyApiClient.getWorkflowStatus(executionId);
      
      info.status = status.status;
      info.lastUpdate = new Date();
      info.result = status.result;
      info.error = status.error;

      this.notifyListeners({ type: 'progress', execution: info });

      // Continue polling if still running
      if (['pending', 'running'].includes(status.status)) {
        setTimeout(() => this.pollExecution(executionId), 2000);
      } else {
        // Execution completed
        this.activeExecutions.delete(executionId);
        this.notifyListeners({ type: 'completed', execution: info });
      }

    } catch (error) {
      info.status = 'failed';
      info.error = error instanceof Error ? error.message : 'Unknown error';
      info.lastUpdate = new Date();

      this.activeExecutions.delete(executionId);
      this.notifyListeners({ type: 'error', execution: info });
    }
  }

  addListener(listener: (update: MonitorUpdate) => void): void {
    this.listeners.add(listener);
  }

  removeListener(listener: (update: MonitorUpdate) => void): void {
    this.listeners.delete(listener);
  }

  private notifyListeners(update: MonitorUpdate): void {
    this.listeners.forEach(listener => {
      try {
        listener(update);
      } catch (error) {
        console.error('Monitor listener error:', error);
      }
    });
  }

  getActiveExecutions(): WorkflowMonitorInfo[] {
    return Array.from(this.activeExecutions.values());
  }

  async cancelExecution(executionId: string): Promise<boolean> {
    const success = await workflowExecutionService.cancelExecution(executionId);
    
    if (success) {
      const info = this.activeExecutions.get(executionId);
      if (info) {
        info.status = 'cancelled';
        info.lastUpdate = new Date();
        this.activeExecutions.delete(executionId);
        this.notifyListeners({ type: 'cancelled', execution: info });
      }
    }

    return success;
  }

  cleanup(): void {
    this.activeExecutions.clear();
    this.listeners.clear();
  }
}

// Supporting types
export interface ChainProgress {
  currentStep: number;
  totalSteps: number;
  currentWorkflowId: string;
  completedWorkflows: number;
  failedWorkflows: number;
  currentWorkflowProgress?: WorkflowProgress;
}

export interface ChainExecutionResult {
  results: ProcessedWorkflowResult[];
  errors: WorkflowExecutionError[];
  completed: number;
  failed: number;
  total: number;
  success: boolean;
}

export interface WorkflowMonitorInfo {
  executionId: string;
  workflowId: string;
  userId: string;
  startedAt: Date;
  lastUpdate: Date;
  status: string;
  result?: any;
  error?: string;
}

export interface MonitorUpdate {
  type: 'started' | 'progress' | 'completed' | 'error' | 'cancelled';
  execution: WorkflowMonitorInfo;
}

// Export singleton monitor instance
export const workflowExecutionMonitor = new WorkflowExecutionMonitor();

/**
 * Utility function to format execution results for display
 */
export function formatExecutionResultForDisplay(result: ProcessedWorkflowResult): string {
  if (result.status === 'failed') {
    return `❌ Execution failed: ${result.error?.message || 'Unknown error'}`;
  }

  if (result.status === 'cancelled') {
    return '⏹️ Execution was cancelled';
  }

  if (result.status === 'completed') {
    const duration = result.metadata.executionTime;
    const durationText = duration > 1000 
      ? `${(duration / 1000).toFixed(1)}s` 
      : `${duration}ms`;
    
    return `✅ Completed in ${durationText} - ${result.result?.summary || 'Success'}`;
  }

  return `⏳ Status: ${result.status}`;
}

/**
 * Utility function to estimate workflow execution cost/complexity
 */
export function estimateWorkflowComplexity(
  workflow: DifyWorkflow,
  input: WorkflowInput
): WorkflowComplexityEstimate {
  let complexity = 1;
  let estimatedDuration = 5000; // Base 5 seconds

  // Analyze input size
  const inputSize = JSON.stringify(input).length;
  if (inputSize > 10000) {
    complexity += 2;
    estimatedDuration += 10000;
  } else if (inputSize > 1000) {
    complexity += 1;
    estimatedDuration += 5000;
  }

  // Analyze workflow properties
  if (workflow.tags?.includes('ai-intensive')) {
    complexity += 3;
    estimatedDuration += 30000;
  }

  if (workflow.tags?.includes('data-processing')) {
    complexity += 2;
    estimatedDuration += 15000;
  }

  // Analyze required permissions (more permissions = more complex)
  complexity += Math.min(workflow.requiredPermissions.length * 0.5, 2);

  return {
    complexity: Math.min(complexity, 10), // Cap at 10
    estimatedDuration,
    riskLevel: complexity > 7 ? 'high' : complexity > 4 ? 'medium' : 'low',
    recommendations: generateComplexityRecommendations(complexity, inputSize)
  };
}

interface WorkflowComplexityEstimate {
  complexity: number; // 1-10 scale
  estimatedDuration: number; // milliseconds
  riskLevel: 'low' | 'medium' | 'high';
  recommendations: string[];
}

function generateComplexityRecommendations(
  complexity: number,
  inputSize: number
): string[] {
  const recommendations: string[] = [];

  if (complexity > 7) {
    recommendations.push('Consider breaking this into smaller workflows');
    recommendations.push('Monitor execution closely for performance issues');
  }

  if (inputSize > 10000) {
    recommendations.push('Large input detected - consider data compression');
    recommendations.push('Validate input thoroughly before execution');
  }

  if (complexity > 5) {
    recommendations.push('Enable progress tracking for better user experience');
    recommendations.push('Set appropriate timeout values');
  }

  return recommendations;
}