/* eslint-disable react-refresh/only-export-components */
import React, { useEffect } from 'react';
import type { MetaFunction } from 'react-router';
import { Link, useParams, useLocation } from 'react-router';
import { useAuth } from '../../src/context/AuthContext';
import { usePermissionRequired } from '../../src/hooks/useProtectedRoute';
import { useOptimizedParallelWorkflowData } from '../../src/hooks/useOptimizedWorkflowData';
import { useWorkflowForm } from '../../src/hooks/useWorkflowForm';
import { FullWidthLayout, WorkflowExecutionResults } from '../../src/components';
import { useRoutePreloading } from '../../src/utils/routePreloading';

export const meta: MetaFunction = ({ params }) => [
  { title: `Workflow ${params['id']} - Dify Workflow Frontend` },
  { name: 'description', content: `Execute workflow ${params['id']}` },
];

// Helper functions for mock data
function getWorkflowName(id: string): string {
  const names: Record<string, string> = {
    'workflow-1': 'Text Analysis Workflow',
    'workflow-2': 'Document Processing',
    'workflow-3': 'Data Transformation',
  };
  return names[id] || `Workflow ${id}`;
}

function getWorkflowDescription(id: string): string {
  const descriptions: Record<string, string> = {
    'workflow-1': 'Analyze text content for sentiment and key topics',
    'workflow-2': 'Process and extract information from documents',
    'workflow-3': 'Transform and clean data according to specified rules',
  };
  return descriptions[id] || `Execute workflow ${id}`;
}

function WorkflowExecutionContent(): React.ReactElement {
  const { user } = useAuth();
  const params = useParams();
  const location = useLocation();
  const workflowId = params['id'] as string;
  const { smartPreload } = useRoutePreloading();

  // Use permission-based route protection
  const { isLoading: authLoading, isAuthenticated, hasPermission } = usePermissionRequired({
    resource: 'workflow',
    action: 'execute',
    redirectTo: '/access-denied'
  });

  // Use optimized parallel data loading for workflow data
  const {
    workflow,
    workflowList,
    isLoading: dataLoading,
    error: dataError,
    isReady
  } = useOptimizedParallelWorkflowData(workflowId);

  // Simple execution state using React Query mutation
  const execution = {
    execute: async (input: any) => {
      // Mock execution for now
      return { executionId: 'mock-id', status: 'completed' as const, result: input };
    },
    executeAsync: async (input: any) => {
      return { executionId: 'mock-id', status: 'completed' as const, result: input };
    },
    isExecuting: false,
    executionError: null,
    executionResult: undefined,
    reset: () => {},
  };

  // Smart preloading for related workflows
  useEffect(() => {
    if (workflowList.data && workflowList.data.length > 0) {
      smartPreload(location.pathname, workflowList.data);
    }
  }, [location.pathname, workflowList.data, smartPreload]);

  // Use workflow form hook for form management
  const {
    values: inputData,
    errors: formErrors,
    isValid,
    isSubmitting,
    submitError,
    submitResult,
    fields,
    setValue,
    setFieldTouched,
    handleSubmit,
    reset
  } = useWorkflowForm(workflow.data);

  // Combined loading state
  const isLoading = authLoading || dataLoading;

  // Don't render if still loading or not authenticated/authorized
  if (isLoading || !isAuthenticated || !hasPermission || !user) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '200px',
        fontFamily: 'system-ui, sans-serif'
      }}>
        <div style={{
          width: '40px',
          height: '40px',
          border: '4px solid #f3f3f3',
          borderTop: '4px solid #0078d4',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          marginRight: '1rem'
        }}></div>
        <span>Loading workflow...</span>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  // Handle data loading error
  if (dataError) {
    return (
      <div style={{
        padding: '2rem',
        textAlign: 'center',
        border: '1px solid #ff6b6b',
        borderRadius: '8px',
        backgroundColor: '#ffe0e0',
        color: '#d63031'
      }}>
        <h2>Error Loading Workflow</h2>
        <p>{dataError?.message || 'An error occurred'}</p>
        <Link
          to="/workflows"
          style={{
            display: 'inline-block',
            padding: '0.75rem 1rem',
            backgroundColor: '#0078d4',
            color: 'white',
            textDecoration: 'none',
            borderRadius: '4px',
            marginTop: '1rem'
          }}
        >
          Back to Workflows
        </Link>
      </div>
    );
  }

  // Don't render if workflow data is not ready
  if (!isReady || !workflow.data) {
    return (
      <div style={{
        padding: '2rem',
        textAlign: 'center',
        border: '1px solid #ddd',
        borderRadius: '8px',
        backgroundColor: '#f9f9f9'
      }}>
        <p>Workflow not found or not accessible.</p>
        <Link
          to="/workflows"
          style={{
            display: 'inline-block',
            padding: '0.75rem 1rem',
            backgroundColor: '#0078d4',
            color: 'white',
            textDecoration: 'none',
            borderRadius: '4px',
            marginTop: '1rem'
          }}
        >
          Back to Workflows
        </Link>
      </div>
    );
  }

  const handleInputChange = (field: string, value: any): void => {
    setValue(field, value);
    setFieldTouched(field, true);
  };

  const handleExecute = async (): Promise<void> => {
    await handleSubmit(async (formValues) => {
      // Execute workflow using the execution hook
      const result = await execution.execute(formValues);
      return result;
    });
  };

  const renderInputField = (field: any): React.ReactElement => {
    const { name, type, label, description, validation, required } = field;
    const value = inputData[name] || '';
    const error = formErrors[name];
    const touched = formErrors[name] !== undefined;
    
    const fieldStyle = {
      width: '100%',
      padding: '0.5rem',
      border: `1px solid ${error ? '#ff6b6b' : '#ddd'}`,
      borderRadius: '4px'
    };
    
    if (type === 'string' && validation?.enum) {
      return (
        <div key={name} style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
            {label} {required && <span style={{ color: '#ff6b6b' }}>*</span>}
          </label>
          {description && (
            <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: '#666' }}>
              {description}
            </p>
          )}
          <select
            value={value}
            onChange={(e) => handleInputChange(name, e.target.value)}
            style={fieldStyle}
          >
            <option value="">Select {label}</option>
            {validation.enum.map((enumValue: string) => (
              <option key={enumValue} value={enumValue}>{enumValue}</option>
            ))}
          </select>
          {error && (
            <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.8rem', color: '#ff6b6b' }}>
              {error}
            </p>
          )}
        </div>
      );
    }
    
    if (type === 'boolean') {
      return (
        <div key={name} style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input
              type="checkbox"
              checked={Boolean(value)}
              onChange={(e) => handleInputChange(name, e.target.checked)}
            />
            <span style={{ fontWeight: 'bold' }}>
              {label} {required && <span style={{ color: '#ff6b6b' }}>*</span>}
            </span>
          </label>
          {description && (
            <p style={{ margin: '0.5rem 0 0 1.5rem', fontSize: '0.9rem', color: '#666' }}>
              {description}
            </p>
          )}
          {error && (
            <p style={{ margin: '0.5rem 0 0 1.5rem', fontSize: '0.8rem', color: '#ff6b6b' }}>
              {error}
            </p>
          )}
        </div>
      );
    }
    
    if (type === 'number') {
      return (
        <div key={name} style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
            {label} {required && <span style={{ color: '#ff6b6b' }}>*</span>}
          </label>
          {description && (
            <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: '#666' }}>
              {description}
            </p>
          )}
          <input
            type="number"
            value={value}
            onChange={(e) => handleInputChange(name, parseFloat(e.target.value) || 0)}
            min={validation?.minimum}
            max={validation?.maximum}
            style={fieldStyle}
            placeholder={`Enter ${label}`}
          />
          {error && (
            <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.8rem', color: '#ff6b6b' }}>
              {error}
            </p>
          )}
        </div>
      );
    }
    
    if (type === 'string') {
      return (
        <div key={name} style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
            {label} {required && <span style={{ color: '#ff6b6b' }}>*</span>}
          </label>
          {description && (
            <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: '#666' }}>
              {description}
            </p>
          )}
          <textarea
            value={value}
            onChange={(e) => handleInputChange(name, e.target.value)}
            rows={4}
            minLength={validation?.minLength}
            maxLength={validation?.maxLength}
            style={{
              ...fieldStyle,
              resize: 'vertical'
            }}
            placeholder={`Enter ${label}`}
          />
          {error && (
            <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.8rem', color: '#ff6b6b' }}>
              {error}
            </p>
          )}
        </div>
      );
    }
    
    return <div key={name}>Unsupported field type: {type}</div>;
  };

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', lineHeight: '1.8' }}>
      <div style={{ marginBottom: '2rem' }}>
        <p style={{ fontSize: '1.1rem', color: '#666' }}>
          {workflow.data?.description || 'No description available'}
        </p>
      </div>

      <main style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
        {/* Input Section */}
        <div style={{
          padding: '1.5rem',
          border: '1px solid #ddd',
          borderRadius: '8px',
          backgroundColor: '#f9f9f9'
        }}>
          <h2>Workflow Input</h2>
          <p style={{ marginBottom: '1.5rem', color: '#666' }}>{workflow.data?.description || 'No description available'}</p>
          
          {/* Display form validation errors */}
          {submitError && (
            <div style={{
              padding: '1rem',
              backgroundColor: '#ffe0e0',
              border: '1px solid #ff6b6b',
              borderRadius: '4px',
              marginBottom: '1rem',
              color: '#d63031'
            }}>
              <strong>Error:</strong> {submitError}
            </div>
          )}
          
          <form onSubmit={(e) => { e.preventDefault(); handleExecute(); }}>
            {fields.map(field => renderInputField(field))}
            
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <button
                type="submit"
                disabled={isSubmitting || execution.isExecuting || !isValid}
                style={{
                  padding: '0.75rem 2rem',
                  backgroundColor: (isSubmitting || execution.isExecuting || !isValid) ? '#ccc' : '#0078d4',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: (isSubmitting || execution.isExecuting || !isValid) ? 'not-allowed' : 'pointer',
                  fontSize: '1rem'
                }}
              >
                {isSubmitting || execution.isExecuting ? 'Executing...' : 'Execute Workflow'}
              </button>
              
              {execution.isExecuting && (
                <button
                  type="button"
                  onClick={execution.cancel}
                  style={{
                    padding: '0.75rem 1rem',
                    backgroundColor: '#ff6b6b',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '1rem'
                  }}
                >
                  Cancel
                </button>
              )}
              
              <button
                type="button"
                onClick={reset}
                style={{
                  padding: '0.75rem 1rem',
                  backgroundColor: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '1rem'
                }}
              >
                Reset
              </button>
            </div>
            
            {/* Progress bar for execution */}
            {execution.isExecuting && (
              <div style={{ marginTop: '1rem' }}>
                <div style={{
                  width: '100%',
                  height: '8px',
                  backgroundColor: '#e0e0e0',
                  borderRadius: '4px',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    width: `${execution.progress}%`,
                    height: '100%',
                    backgroundColor: '#0078d4',
                    transition: 'width 0.3s ease'
                  }}></div>
                </div>
                <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.9rem', color: '#666' }}>
                  Progress: {execution.progress.toFixed(0)}%
                </p>
              </div>
            )}
          </form>
        </div>

        {/* Output Section */}
        <div style={{
          padding: '1.5rem',
          border: '1px solid #ddd',
          borderRadius: '8px',
          backgroundColor: '#f9f9f9'
        }}>
          <h2>Workflow Output</h2>
          
          <WorkflowExecutionResults
            result={execution.executionResult}
            isExecuting={execution.isExecuting}
            progress={50}
            error={execution.executionError}
            onRetry={handleExecute}
            onClear={execution.reset}
          />
          
          {submitResult && (
            <div style={{
              padding: '1rem',
              backgroundColor: '#e0f7ff',
              border: '1px solid #0078d4',
              borderRadius: '4px',
              marginTop: '1rem'
            }}>
              <strong>Form Submission Result:</strong>
              <pre style={{ margin: '0.5rem 0 0 0', whiteSpace: 'pre-wrap', fontSize: '0.9rem' }}>
                {JSON.stringify(submitResult, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </main>
      
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export default function WorkflowExecution(): React.ReactElement {
  const params = useParams();
  const workflowId = params['id'] as string;
  
  // Use the optimized workflow data hook to get the actual workflow name
  const { workflow } = useOptimizedParallelWorkflowData(workflowId);
  const workflowName = workflow.data?.name || getWorkflowName(workflowId);

  return (
    <FullWidthLayout 
      title={workflowName}
      routeName="Workflow Execution"
      breadcrumbs={[
        { label: 'Home', path: '/' },
        { label: 'Workflows', path: '/workflows' },
        { label: workflowName }
      ]}
    >
      <WorkflowExecutionContent />
    </FullWidthLayout>
  );
}