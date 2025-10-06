/**
 * Error Handling Integration Examples
 * Demonstrates how to use the new error handling functionality
 */

import {
  createAuthenticationError,
  createAuthorizationError,
  createNetworkError,
  createDifyApiError,
} from '../utils/errorUtils';
import {
  handleAuthenticationError,
  handleAuthorizationError,
  handleNetworkError,
  handleDifyApiError,
  handleError,
} from '../services/specificErrorHandlers';
import {
  fetchWithErrorHandling,
  authOperationWithErrorHandling,
  difyApiOperationWithErrorHandling,
} from '../utils/errorHandlingIntegration';

/**
 * Example: Authentication Error Handling
 */
export async function exampleAuthenticationErrorHandling() {
  console.log('=== Authentication Error Handling Example ===');

  // Simulate a token refresh operation that fails initially
  let attemptCount = 0;
  const tokenRefreshOperation = async () => {
    attemptCount++;
    console.log(`Token refresh attempt ${attemptCount}`);
    
    if (attemptCount < 2) {
      throw createAuthenticationError('Token refresh failed', {
        provider: 'azure',
        authStep: 'refresh',
      });
    }
    
    return { accessToken: 'new-token', user: { id: '1', name: 'User' } };
  };

  try {
    const result = await authOperationWithErrorHandling(
      tokenRefreshOperation,
      { provider: 'azure', authStep: 'refresh' }
    );
    console.log('Token refresh successful:', result);
  } catch (error) {
    console.error('Token refresh failed after retries:', error);
  }
}

/**
 * Example: Network Error Handling with Fetch
 */
export async function exampleNetworkErrorHandling() {
  console.log('=== Network Error Handling Example ===');

  // Simulate a network request that fails with 500 error initially
  let requestCount = 0;
  const mockFetch = async (url: string, options?: RequestInit) => {
    requestCount++;
    console.log(`Network request attempt ${requestCount} to ${url}`);
    
    if (requestCount < 2) {
      return new Response(null, { 
        status: 500, 
        statusText: 'Internal Server Error' 
      });
    }
    
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  };

  // Mock global fetch
  const originalFetch = global.fetch;
  global.fetch = mockFetch as any;

  try {
    const response = await fetchWithErrorHandling('/api/test', {
      method: 'GET',
    }, {
      endpoint: '/api/test',
    });
    
    const data = await response.json();
    console.log('Network request successful:', data);
  } catch (error) {
    console.error('Network request failed after retries:', error);
  } finally {
    // Restore original fetch
    global.fetch = originalFetch;
  }
}

/**
 * Example: Dify API Error Handling
 */
export async function exampleDifyApiErrorHandling() {
  console.log('=== Dify API Error Handling Example ===');

  // Simulate a Dify workflow execution that's initially busy
  let executionCount = 0;
  const workflowExecution = async () => {
    executionCount++;
    console.log(`Workflow execution attempt ${executionCount}`);
    
    if (executionCount < 2) {
      throw createDifyApiError('Workflow is busy', {
        workflowId: 'workflow-123',
        apiErrorCode: 'WORKFLOW_BUSY',
      });
    }
    
    return {
      executionId: 'exec-456',
      status: 'completed',
      result: { output: 'Success!' }
    };
  };

  try {
    const result = await difyApiOperationWithErrorHandling(
      workflowExecution,
      {
        workflowId: 'workflow-123',
        workflowName: 'Example Workflow',
      }
    );
    console.log('Workflow execution successful:', result);
  } catch (error) {
    console.error('Workflow execution failed after retries:', error);
  }
}

/**
 * Example: Authorization Error Handling
 */
export async function exampleAuthorizationErrorHandling() {
  console.log('=== Authorization Error Handling Example ===');

  const authzError = createAuthorizationError('Access denied to workflow', {
    resource: 'workflow',
    action: 'execute',
    requiredPermissions: ['workflow:execute'],
  });

  try {
    await handleAuthorizationError(authzError, {
      resource: 'workflow',
      action: 'execute',
      routeName: 'workflow-execution',
      userPermissions: ['workflow:read'], // User only has read permission
    });
  } catch (error) {
    console.log('Authorization error handled:', error.message);
    console.log('Error details:', error.details?.suggestions);
  }
}

/**
 * Example: Unified Error Handling
 */
export async function exampleUnifiedErrorHandling() {
  console.log('=== Unified Error Handling Example ===');

  // Test different error types with unified handler
  const errors = [
    createNetworkError('Connection timeout', { status: 408 }),
    createAuthenticationError('Token expired', { authStep: 'refresh' }),
    createDifyApiError('Rate limited', { apiErrorCode: 'RATE_LIMITED' }),
  ];

  for (const error of errors) {
    console.log(`\nHandling ${error.type}:`);
    
    let operationCount = 0;
    const mockOperation = async () => {
      operationCount++;
      console.log(`  Operation attempt ${operationCount}`);
      
      if (operationCount < 2) {
        throw error;
      }
      
      return `Success for ${error.type}`;
    };

    try {
      const result = await handleError(error, mockOperation);
      console.log(`  Result: ${result}`);
    } catch (handledError) {
      console.log(`  Final error: ${handledError.message}`);
    }
  }
}

/**
 * Example: Error Handling with React Component Integration
 */
export function exampleReactComponentIntegration() {
  console.log('=== React Component Integration Example ===');
  
  // This would be used in a React component like this:
  /*
  import { useUnifiedErrorHandling } from '../hooks/useErrorHandling';
  import { EnhancedErrorDisplay } from '../components/EnhancedErrorDisplay';

  function MyComponent() {
    const errorHandling = useUnifiedErrorHandling({
      onError: (error) => console.log('Error occurred:', error.message),
      onRetrySuccess: () => console.log('Retry successful!'),
    });

    const handleApiCall = async () => {
      try {
        const result = await errorHandling.handleError(
          someError,
          () => apiCall(),
          { endpoint: '/api/data' }
        );
        // Handle success
      } catch (error) {
        // Error is already handled by the error handling system
        // Just update UI state if needed
      }
    };

    if (errorHandling.lastError) {
      return (
        <EnhancedErrorDisplay
          error={errorHandling.lastError}
          onRetry={() => errorHandling.retry(() => apiCall())}
          onDismiss={() => errorHandling.clearError()}
        />
      );
    }

    return <div>Normal component content</div>;
  }
  */
  
  console.log('See code comments for React component integration example');
}

/**
 * Run all examples
 */
export async function runAllErrorHandlingExamples() {
  console.log('🚨 Error Handling Integration Examples\n');
  
  try {
    await exampleAuthenticationErrorHandling();
    console.log('\n');
    
    await exampleNetworkErrorHandling();
    console.log('\n');
    
    await exampleDifyApiErrorHandling();
    console.log('\n');
    
    await exampleAuthorizationErrorHandling();
    console.log('\n');
    
    await exampleUnifiedErrorHandling();
    console.log('\n');
    
    exampleReactComponentIntegration();
    
    console.log('\n✅ All error handling examples completed!');
  } catch (error) {
    console.error('❌ Error running examples:', error);
  }
}

// Individual examples are already exported above