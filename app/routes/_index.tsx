/* eslint-disable react-refresh/only-export-components */
import React, { useEffect } from 'react';
import type { MetaFunction } from 'react-router';
import { useLocation } from 'react-router';
import { useAuth } from '../../src/context/AuthContext';
import { useAuthRequired } from '../../src/hooks/useProtectedRoute';
import { useOptimizedWorkflowList } from '../../src/hooks/useOptimizedWorkflowData';
import { ProtectedLayout, OptimizedWorkflowDashboard } from '../../src/components';
import { useRoutePreloading } from '../../src/utils/routePreloading';

export const meta: MetaFunction = () => [
  { title: 'Dashboard - Dify Workflow Frontend' },
  { name: 'description', content: 'Dify Workflow Frontend Dashboard' },
];

function IndexContent(): React.ReactElement {
  const { user } = useAuth();
  const location = useLocation();
  const { isLoading: authLoading, isAuthenticated } = useAuthRequired();
  const { smartPreload } = useRoutePreloading();
  
  // Use optimized workflow data for dashboard
  const { 
    data: workflows, 
    isLoading: workflowsLoading, 
    error: workflowsError, 
    refetch 
  } = useOptimizedWorkflowList();

  // Smart preloading based on current route
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
        <span>Loading dashboard...</span>
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
    <div style={{ fontFamily: 'system-ui, sans-serif' }}>
      <OptimizedWorkflowDashboard
        workflows={workflows || []}
        loading={workflowsLoading}
        error={workflowsError}
        onRefresh={refetch}
        onWorkflowSelect={(workflow) => {
          window.location.href = `/workflows/${workflow.id}`;
        }}
      />
      
      {/* User Information Section */}
      <div style={{
        marginTop: '2rem',
        padding: '1.5rem',
        border: '1px solid #ddd',
        borderRadius: '8px',
        backgroundColor: '#f9f9f9'
      }}>
        <h2 style={{ margin: '0 0 1rem 0' }}>User Information</h2>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '1rem'
        }}>
          <div>
            <p><strong>Email:</strong> {user.email}</p>
            <p><strong>Provider:</strong> {user.provider}</p>
            <p><strong>Domain:</strong> {user.attributes.domain}</p>
          </div>
          <div>
            {user.attributes.department && (
              <p><strong>Department:</strong> {user.attributes.department}</p>
            )}
            {user.attributes.organization && (
              <p><strong>Organization:</strong> {user.attributes.organization}</p>
            )}
            {user.attributes.roles && user.attributes.roles.length > 0 && (
              <p><strong>Roles:</strong> {user.attributes.roles.join(', ')}</p>
            )}
          </div>
        </div>
        
        <div style={{ marginTop: '1rem' }}>
          <h3>Permissions</h3>
          {user.permissions.length > 0 ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {user.permissions.map((permission, index) => (
                <span
                  key={index}
                  style={{
                    padding: '0.25rem 0.5rem',
                    backgroundColor: '#e0e0e0',
                    borderRadius: '4px',
                    fontSize: '0.85rem'
                  }}
                >
                  <strong>{permission.resource}</strong>: {permission.actions.join(', ')}
                </span>
              ))}
            </div>
          ) : (
            <p style={{ color: '#666', fontStyle: 'italic' }}>No specific permissions assigned.</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Index(): React.ReactElement {
  return (
    <ProtectedLayout 
      title="Dashboard"
      routeName="Dashboard"
      breadcrumbs={[
        { label: 'Home', path: '/' },
        { label: 'Dashboard' }
      ]}
    >
      <IndexContent />
    </ProtectedLayout>
  );
}
