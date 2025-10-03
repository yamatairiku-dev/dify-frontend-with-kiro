/* eslint-disable react-refresh/only-export-components */
import React from 'react';
import type { MetaFunction } from 'react-router';
import { Link } from 'react-router';
import { useAuth } from '../../src/context/AuthContext';
import { useAuthRequired, usePermissionCheck } from '../../src/hooks/useProtectedRoute';
import { useWorkflowList } from '../../src/hooks/useWorkflowData';
import { ProtectedLayout } from '../../src/components/Layout';

export const meta: MetaFunction = () => [
  { title: 'Workflows - Dify Workflow Frontend' },
  { name: 'description', content: 'Available Dify workflows' },
];

function WorkflowsIndexContent(): React.ReactElement {
  const { user } = useAuth();
  const { isLoading: authLoading, isAuthenticated } = useAuthRequired();
  
  // Use the new workflow data loading hook
  const { 
    data: workflows, 
    loading: workflowsLoading, 
    error: workflowsError, 
    filteredWorkflows,
    refetch 
  } = useWorkflowList();

  // Use permission check hook for better performance and consistency
  const canExecuteWorkflow = usePermissionCheck('workflow', 'execute');

  // Combined loading state
  const isLoading = authLoading || workflowsLoading;

  // Don't render if still loading or not authenticated
  if (isLoading || !isAuthenticated || !user) {
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
        <span>Loading workflows...</span>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  // Handle workflow loading error
  if (workflowsError) {
    return (
      <div style={{
        padding: '2rem',
        textAlign: 'center',
        border: '1px solid #ff6b6b',
        borderRadius: '8px',
        backgroundColor: '#ffe0e0',
        color: '#d63031'
      }}>
        <h2>Error Loading Workflows</h2>
        <p>{workflowsError}</p>
        <button
          onClick={refetch}
          style={{
            padding: '0.75rem 1rem',
            backgroundColor: '#0078d4',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            marginTop: '1rem'
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  // Use the filtered workflows from the hook (based on user permissions)
  const displayWorkflows = filteredWorkflows || [];

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', lineHeight: '1.8' }}>
      <div style={{ marginBottom: '2rem' }}>
        <p style={{ fontSize: '1.1rem', color: '#666' }}>
          Browse and execute available Dify workflows based on your permissions.
        </p>
      </div>

      <main>
        {displayWorkflows.length > 0 ? (
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
            gap: '2rem'
          }}>
            {displayWorkflows.map((workflow) => {
              // Check specific workflow execution permission
              const hasPermission = canExecuteWorkflow;
              
              return (
                <div 
                  key={workflow.id}
                  style={{
                    padding: '1.5rem',
                    border: '1px solid #ddd',
                    borderRadius: '8px',
                    backgroundColor: hasPermission ? '#f9f9f9' : '#f5f5f5',
                    opacity: hasPermission ? 1 : 0.7
                  }}
                >
                  <div style={{ marginBottom: '1rem' }}>
                    <h3 style={{ margin: '0 0 0.5rem 0' }}>{workflow.name}</h3>
                    <span style={{
                      padding: '0.25rem 0.5rem',
                      backgroundColor: '#e0e0e0',
                      borderRadius: '4px',
                      fontSize: '0.8rem'
                    }}>
                      {workflow.category}
                    </span>
                  </div>
                  
                  <p style={{ marginBottom: '1.5rem' }}>{workflow.description}</p>
                  
                  <div style={{ marginBottom: '1rem' }}>
                    <small style={{ color: '#666' }}>
                      Required permissions: {workflow.requiredPermissions.join(', ')}
                    </small>
                    {workflow.tags && workflow.tags.length > 0 && (
                      <div style={{ marginTop: '0.5rem' }}>
                        {workflow.tags.map(tag => (
                          <span
                            key={tag}
                            style={{
                              display: 'inline-block',
                              padding: '0.2rem 0.4rem',
                              backgroundColor: '#e0e0e0',
                              borderRadius: '3px',
                              fontSize: '0.7rem',
                              marginRight: '0.5rem'
                            }}
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  {hasPermission ? (
                    <Link
                      to={`/workflows/${workflow.id}`}
                      style={{
                        display: 'inline-block',
                        padding: '0.75rem 1rem',
                        backgroundColor: '#0078d4',
                        color: 'white',
                        textDecoration: 'none',
                        borderRadius: '4px'
                      }}
                    >
                      Execute Workflow
                    </Link>
                  ) : (
                    <div style={{
                      padding: '0.75rem 1rem',
                      backgroundColor: '#ccc',
                      color: '#666',
                      borderRadius: '4px',
                      textAlign: 'center'
                    }}>
                      Access Denied
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{
            padding: '2rem',
            textAlign: 'center',
            border: '1px solid #ddd',
            borderRadius: '8px',
            backgroundColor: '#f9f9f9'
          }}>
            <h2>No Workflows Available</h2>
            <p>There are no workflows available for your current permissions.</p>
          </div>
        )}
      </main>
    </div>
  );
}

export default function WorkflowsIndex(): React.ReactElement {
  return (
    <ProtectedLayout 
      title="Available Workflows"
      routeName="Workflows List"
      breadcrumbs={[
        { label: 'Home', path: '/' },
        { label: 'Workflows' }
      ]}
    >
      <WorkflowsIndexContent />
    </ProtectedLayout>
  );
}