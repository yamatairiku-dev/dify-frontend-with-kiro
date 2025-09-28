import { difyApiClient } from '../services/difyApiClient';
import { accessControlService } from '../services/accessControlService';
import type { User } from '../types/auth';
import type { DifyWorkflow, WorkflowInput, WorkflowResult } from '../types/dify';

/**
 * Dify API Integration Examples
 * 
 * Demonstrates how to integrate the Dify API client with the access control system
 * to provide secure, permission-based workflow execution.
 */

/**
 * Get workflows available to a specific user based on their permissions
 */
export async function getUserAvailableWorkflows(user: User): Promise<DifyWorkflow[]> {
  try {
    // Get all workflows from Dify API
    const allWorkflows = await difyApiClient.getWorkflows();
    
    // Filter workflows based on user permissions using access control service
    const availableWorkflows = accessControlService.getAvailableWorkflows(user);
    
    // Return intersection of API workflows and user-permitted workflows
    return allWorkflows.filter(workflow => 
      availableWorkflows.some(permitted => permitted.id === workflow.id)
    );
  } catch (error) {
    console.error('Failed to get user available workflows:', error);
    throw new Error('Unable to retrieve available workflows');
  }
}

/**
 * Execute a workflow with permission checking
 */
export async function executeWorkflowWithPermissions(
  user: User,
  workflowId: string,
  input: WorkflowInput
): Promise<WorkflowResult> {
  try {
    // Check if user has permission to execute this workflow
    const accessResult = accessControlService.checkAccess(user, `workflow:${workflowId}`, 'execute');
    
    if (!accessResult.allowed) {
      throw new Error(`Access denied: ${accessResult.reason || 'Insufficient permissions'}`);
    }

    // Get workflow metadata to validate input
    const workflow = await difyApiClient.getWorkflowMetadata(workflowId);
    
    // Validate input against workflow schema
    const validationResult = validateWorkflowInput(input, workflow);
    if (!validationResult.valid) {
      throw new Error(`Invalid input: ${validationResult.errors.join(', ')}`);
    }

    // Execute the workflow
    const result = await difyApiClient.executeWorkflow(workflowId, input, user.id);
    
    console.log(`Workflow ${workflowId} executed successfully for user ${user.email}`, {
      executionId: result.executionId,
      status: result.status,
    });

    return result;
  } catch (error) {
    console.error(`Failed to execute workflow ${workflowId}:`, error);
    throw error;
  }
}

/**
 * Monitor workflow execution with permission checking
 */
export async function monitorWorkflowExecution(
  user: User,
  executionId: string
): Promise<WorkflowResult> {
  try {
    // Check if user has permission to monitor executions
    const accessResult = accessControlService.checkAccess(user, 'workflow:execution', 'read');
    
    if (!accessResult.allowed) {
      throw new Error(`Access denied: ${accessResult.reason || 'Cannot monitor executions'}`);
    }

    // Get execution status
    const status = await difyApiClient.getWorkflowStatus(executionId);
    
    console.log(`Execution ${executionId} status checked by user ${user.email}`, {
      status: status.status,
      completedAt: status.completedAt,
    });

    return status;
  } catch (error) {
    console.error(`Failed to monitor execution ${executionId}:`, error);
    throw error;
  }
}

/**
 * Cancel workflow execution with permission checking
 */
export async function cancelWorkflowExecution(
  user: User,
  executionId: string
): Promise<boolean> {
  try {
    // Check if user has permission to cancel executions
    const accessResult = accessControlService.checkAccess(user, 'workflow:execution', 'cancel');
    
    if (!accessResult.allowed) {
      throw new Error(`Access denied: ${accessResult.reason || 'Cannot cancel executions'}`);
    }

    // Cancel the execution
    const success = await difyApiClient.cancelWorkflowExecution(executionId);
    
    if (success) {
      console.log(`Execution ${executionId} cancelled by user ${user.email}`);
    } else {
      console.warn(`Failed to cancel execution ${executionId} for user ${user.email}`);
    }

    return success;
  } catch (error) {
    console.error(`Failed to cancel execution ${executionId}:`, error);
    throw error;
  }
}

/**
 * Get workflow categories available to user
 */
export async function getUserWorkflowCategories(user: User): Promise<string[]> {
  try {
    const availableWorkflows = await getUserAvailableWorkflows(user);
    
    // Extract unique categories
    const categories = new Set<string>();
    availableWorkflows.forEach(workflow => {
      if (workflow.category) {
        categories.add(workflow.category);
      }
    });

    return Array.from(categories).sort();
  } catch (error) {
    console.error('Failed to get user workflow categories:', error);
    return [];
  }
}

/**
 * Search workflows by name or description with permission filtering
 */
export async function searchUserWorkflows(
  user: User,
  query: string,
  category?: string
): Promise<DifyWorkflow[]> {
  try {
    const availableWorkflows = await getUserAvailableWorkflows(user);
    
    const searchQuery = query.toLowerCase();
    
    return availableWorkflows.filter(workflow => {
      // Filter by category if specified
      if (category && workflow.category !== category) {
        return false;
      }
      
      // Search in name and description
      return (
        workflow.name.toLowerCase().includes(searchQuery) ||
        workflow.description.toLowerCase().includes(searchQuery) ||
        (workflow.tags && workflow.tags.some(tag => tag.toLowerCase().includes(searchQuery)))
      );
    });
  } catch (error) {
    console.error('Failed to search user workflows:', error);
    return [];
  }
}

/**
 * Validate workflow input against schema
 */
function validateWorkflowInput(
  input: WorkflowInput,
  workflow: DifyWorkflow
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const schema = workflow.inputSchema;

  if (!schema || !schema.properties) {
    return { valid: true, errors: [] };
  }

  // Check required fields
  if (schema.required) {
    for (const requiredField of schema.required) {
      if (!(requiredField in input) || input[requiredField] === undefined || input[requiredField] === null) {
        errors.push(`Required field '${requiredField}' is missing`);
      }
    }
  }

  // Basic type validation
  for (const [fieldName, fieldSchema] of Object.entries(schema.properties)) {
    const value = input[fieldName];
    
    if (value !== undefined && value !== null) {
      const validationError = validateFieldValue(fieldName, value, fieldSchema);
      if (validationError) {
        errors.push(validationError);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate individual field value against schema
 */
function validateFieldValue(
  fieldName: string,
  value: any,
  schema: any
): string | null {
  switch (schema.type) {
    case 'string':
      if (typeof value !== 'string') {
        return `Field '${fieldName}' must be a string`;
      }
      if (schema.minLength && value.length < schema.minLength) {
        return `Field '${fieldName}' must be at least ${schema.minLength} characters`;
      }
      if (schema.maxLength && value.length > schema.maxLength) {
        return `Field '${fieldName}' must be at most ${schema.maxLength} characters`;
      }
      if (schema.pattern && !new RegExp(schema.pattern).test(value)) {
        return `Field '${fieldName}' does not match required pattern`;
      }
      break;

    case 'number':
    case 'integer':
      if (typeof value !== 'number') {
        return `Field '${fieldName}' must be a number`;
      }
      if (schema.minimum !== undefined && value < schema.minimum) {
        return `Field '${fieldName}' must be at least ${schema.minimum}`;
      }
      if (schema.maximum !== undefined && value > schema.maximum) {
        return `Field '${fieldName}' must be at most ${schema.maximum}`;
      }
      break;

    case 'boolean':
      if (typeof value !== 'boolean') {
        return `Field '${fieldName}' must be a boolean`;
      }
      break;

    case 'array':
      if (!Array.isArray(value)) {
        return `Field '${fieldName}' must be an array`;
      }
      break;

    case 'object':
      if (typeof value !== 'object' || Array.isArray(value)) {
        return `Field '${fieldName}' must be an object`;
      }
      break;
  }

  return null;
}

/**
 * Example usage scenarios
 */
export const difyApiExamples = {
  /**
   * Example: Data processing workflow
   */
  async processDataWorkflow(user: User, data: any[]): Promise<WorkflowResult> {
    return executeWorkflowWithPermissions(user, 'data-processor', {
      data,
      format: 'json',
      options: {
        validate: true,
        transform: true,
      },
    });
  },

  /**
   * Example: Text analysis workflow
   */
  async analyzeText(user: User, text: string, language = 'en'): Promise<WorkflowResult> {
    return executeWorkflowWithPermissions(user, 'text-analyzer', {
      text,
      language,
      features: ['sentiment', 'entities', 'keywords'],
    });
  },

  /**
   * Example: Image processing workflow
   */
  async processImage(user: User, imageUrl: string, operations: string[]): Promise<WorkflowResult> {
    return executeWorkflowWithPermissions(user, 'image-processor', {
      imageUrl,
      operations,
      outputFormat: 'png',
      quality: 90,
    });
  },

  /**
   * Example: Batch processing with monitoring
   */
  async processBatch(user: User, items: any[]): Promise<WorkflowResult[]> {
    const results: WorkflowResult[] = [];
    
    for (const item of items) {
      try {
        const result = await executeWorkflowWithPermissions(user, 'batch-processor', {
          item,
          batchId: `batch_${Date.now()}`,
        });
        
        results.push(result);
        
        // Monitor execution until completion
        if (result.status === 'pending' || result.status === 'running') {
          await waitForCompletion(user, result.executionId);
        }
      } catch (error) {
        console.error(`Failed to process batch item:`, error);
        // Continue with next item
      }
    }
    
    return results;
  },
};

/**
 * Wait for workflow execution to complete
 */
async function waitForCompletion(
  user: User,
  executionId: string,
  maxWaitTime = 300000 // 5 minutes
): Promise<WorkflowResult> {
  const startTime = Date.now();
  const pollInterval = 2000; // 2 seconds

  while (Date.now() - startTime < maxWaitTime) {
    try {
      const status = await monitorWorkflowExecution(user, executionId);
      
      if (status.status === 'completed' || status.status === 'failed' || status.status === 'cancelled') {
        return status;
      }
      
      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    } catch (error) {
      console.error(`Error polling execution ${executionId}:`, error);
      throw error;
    }
  }

  throw new Error(`Workflow execution ${executionId} timed out after ${maxWaitTime}ms`);
}