/* eslint-disable react-refresh/only-export-components */
import React, { useEffect } from 'react';
import type { MetaFunction } from 'react-router';
import { useLocation } from 'react-router';
import { useAuth } from '../../src/context/AuthContext';
import { useAuthRequired } from '../../src/hooks/useProtectedRoute';
import { useOptimizedWorkflowList } from '../../src/hooks/useOptimizedWorkflowData';
import { ProtectedLayout, OptimizedWorkflowList } from '../../src/components';
import { useRoutePreloading } from '../../src/utils/routePreloading';

export const meta: MetaFunction = () => [
  { title: 'Workflows - Dify Workflow Frontend' },
  { name: 'description', content: 'Available Dify workflows' },
];

function WorkflowsIndexContent(): React.ReactElement {
  const { user } = useAuth();
  const location = useLocation();
  const { isLoading: authLoading, isAuthenticated } = useAuthRequired();
  const { smartPreload } = useRoutePreloading();
  
  // Use the optimized workflow data loading hook
  const { 
    data: workflows, 
    isLoading: workflowsLoading, 
    error: workflowsError, 
    refetch 
  } = useOptimizedWorkflowList();

  // Smart preloading for workflow details
  useEffect(() => {
    if (workflows && workflows.length > 0) {
      smartPreload(location.pathname, workflows);
    }
  }, [location.pathname, workflows, smartPreload]);

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

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', lineHeight: '1.8' }}>
      <div style={{ marginBottom: '2rem' }}>
        <p style={{ fontSize: '1.1rem', color: '#666' }}>
          Browse and execute available Dify workflows based on your permissions.
        </p>
      </div>

      <OptimizedWorkflowList
        workflows={workflows || []}
        loading={workflowsLoading}
        error={workflowsError}
        onRefresh={refetch}
        onWorkflowSelect={(workflow) => {
          window.location.href = `/workflows/${workflow.id}`;
        }}
        showSearch={true}
        showFilters={true}
      />
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