import React, { memo, useMemo, useCallback } from 'react';
import type { DifyWorkflow } from '../types/dify';

interface OptimizedWorkflowDashboardProps {
  workflows: DifyWorkflow[];
  loading: boolean;
  error: Error | null;
  onRefresh: () => void;
  onWorkflowSelect?: (workflow: DifyWorkflow) => void;
}

// Memoized statistics component
const WorkflowStats = memo<{
  workflows: DifyWorkflow[];
}>(({ workflows }) => {
  const stats = useMemo(() => {
    const total = workflows.length;
    const active = workflows.filter(w => w.isActive !== false).length;
    const categories = new Set(workflows.map(w => w.category).filter(Boolean)).size;
    const recentlyUpdated = workflows.filter(w => {
      if (!w.updatedAt) return false;
      const updatedDate = new Date(w.updatedAt);
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      return updatedDate > weekAgo;
    }).length;

    return { total, active, categories, recentlyUpdated };
  }, [workflows]);

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
      gap: '1rem',
      marginBottom: '2rem'
    }}>
      <div style={{
        padding: '1.5rem',
        backgroundColor: '#007bff',
        color: 'white',
        borderRadius: '8px',
        textAlign: 'center'
      }}>
        <div style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
          {stats.total}
        </div>
        <div style={{ fontSize: '0.9rem', opacity: 0.9 }}>
          Total Workflows
        </div>
      </div>

      <div style={{
        padding: '1.5rem',
        backgroundColor: '#28a745',
        color: 'white',
        borderRadius: '8px',
        textAlign: 'center'
      }}>
        <div style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
          {stats.active}
        </div>
        <div style={{ fontSize: '0.9rem', opacity: 0.9 }}>
          Active Workflows
        </div>
      </div>

      <div style={{
        padding: '1.5rem',
        backgroundColor: '#17a2b8',
        color: 'white',
        borderRadius: '8px',
        textAlign: 'center'
      }}>
        <div style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
          {stats.categories}
        </div>
        <div style={{ fontSize: '0.9rem', opacity: 0.9 }}>
          Categories
        </div>
      </div>

      <div style={{
        padding: '1.5rem',
        backgroundColor: '#ffc107',
        color: '#212529',
        borderRadius: '8px',
        textAlign: 'center'
      }}>
        <div style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
          {stats.recentlyUpdated}
        </div>
        <div style={{ fontSize: '0.9rem', opacity: 0.8 }}>
          Updated This Week
        </div>
      </div>
    </div>
  );
});

WorkflowStats.displayName = 'WorkflowStats';

// Memoized recent workflows component
const RecentWorkflows = memo<{
  workflows: DifyWorkflow[];
  onWorkflowSelect?: (workflow: DifyWorkflow) => void;
}>(({ workflows, onWorkflowSelect }) => {
  const recentWorkflows = useMemo(() => {
    return workflows
      .filter(w => w.updatedAt)
      .sort((a, b) => new Date(b.updatedAt!).getTime() - new Date(a.updatedAt!).getTime())
      .slice(0, 5);
  }, [workflows]);

  const handleWorkflowClick = useCallback((workflow: DifyWorkflow) => {
    onWorkflowSelect?.(workflow);
  }, [onWorkflowSelect]);

  if (recentWorkflows.length === 0) {
    return (
      <div style={{
        padding: '2rem',
        textAlign: 'center',
        color: '#666',
        backgroundColor: '#f8f9fa',
        borderRadius: '8px'
      }}>
        <p style={{ margin: 0 }}>No recently updated workflows found.</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {recentWorkflows.map(workflow => (
        <div
          key={workflow.id}
          style={{
            padding: '1rem',
            border: '1px solid #ddd',
            borderRadius: '6px',
            backgroundColor: '#fff',
            cursor: onWorkflowSelect ? 'pointer' : 'default',
            transition: 'box-shadow 0.2s ease',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
          onClick={() => handleWorkflowClick(workflow)}
          onMouseEnter={(e) => {
            if (onWorkflowSelect) {
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 'bold', marginBottom: '0.25rem' }}>
              {workflow.name}
            </div>
            <div style={{ fontSize: '0.9rem', color: '#666' }}>
              {workflow.description}
            </div>
            {workflow.category && (
              <span style={{
                display: 'inline-block',
                marginTop: '0.5rem',
                padding: '0.25rem 0.5rem',
                backgroundColor: '#007bff',
                color: 'white',
                borderRadius: '4px',
                fontSize: '0.75rem'
              }}>
                {workflow.category}
              </span>
            )}
          </div>
          <div style={{ 
            fontSize: '0.8rem', 
            color: '#999',
            textAlign: 'right',
            marginLeft: '1rem'
          }}>
            {new Date(workflow.updatedAt!).toLocaleDateString()}
          </div>
        </div>
      ))}
    </div>
  );
});

RecentWorkflows.displayName = 'RecentWorkflows';

// Memoized popular categories component
const PopularCategories = memo<{
  workflows: DifyWorkflow[];
}>(({ workflows }) => {
  const categoryStats = useMemo(() => {
    const categoryCount = new Map<string, number>();
    
    workflows.forEach(workflow => {
      if (workflow.category) {
        categoryCount.set(workflow.category, (categoryCount.get(workflow.category) || 0) + 1);
      }
    });

    return Array.from(categoryCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);
  }, [workflows]);

  if (categoryStats.length === 0) {
    return (
      <div style={{
        padding: '2rem',
        textAlign: 'center',
        color: '#666',
        backgroundColor: '#f8f9fa',
        borderRadius: '8px'
      }}>
        <p style={{ margin: 0 }}>No categories found.</p>
      </div>
    );
  }

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
      gap: '0.75rem'
    }}>
      {categoryStats.map(([category, count]) => (
        <div
          key={category}
          style={{
            padding: '1rem',
            backgroundColor: '#f8f9fa',
            border: '1px solid #dee2e6',
            borderRadius: '6px',
            textAlign: 'center'
          }}
        >
          <div style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>
            {category}
          </div>
          <div style={{ fontSize: '1.5rem', color: '#007bff', fontWeight: 'bold' }}>
            {count}
          </div>
          <div style={{ fontSize: '0.8rem', color: '#666' }}>
            workflow{count !== 1 ? 's' : ''}
          </div>
        </div>
      ))}
    </div>
  );
});

PopularCategories.displayName = 'PopularCategories';

// Main optimized dashboard component
export const OptimizedWorkflowDashboard = memo<OptimizedWorkflowDashboardProps>(({
  workflows,
  loading,
  error,
  onRefresh,
  onWorkflowSelect,
}) => {
  const handleRefresh = useCallback(() => {
    onRefresh();
  }, [onRefresh]);

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '300px',
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

  if (error) {
    return (
      <div style={{
        padding: '2rem',
        textAlign: 'center',
        border: '1px solid #dc3545',
        borderRadius: '8px',
        backgroundColor: '#f8d7da',
        color: '#721c24',
        fontFamily: 'system-ui, sans-serif'
      }}>
        <h3 style={{ margin: '0 0 1rem 0' }}>Error Loading Dashboard</h3>
        <p style={{ margin: '0 0 1rem 0' }}>
          {error.message || 'An unexpected error occurred while loading the dashboard.'}
        </p>
        <button
          onClick={handleRefresh}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: '#dc3545',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '0.9rem'
          }}
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif' }}>
      {/* Header */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '2rem' 
      }}>
        <div>
          <h1 style={{ margin: '0 0 0.5rem 0', fontSize: '2rem' }}>
            Workflow Dashboard
          </h1>
          <p style={{ margin: 0, color: '#666', fontSize: '1.1rem' }}>
            Overview of your available Dify workflows
          </p>
        </div>
        <button
          onClick={handleRefresh}
          style={{
            padding: '0.75rem 1.5rem',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '1rem',
            fontWeight: 'bold'
          }}
        >
          Refresh Data
        </button>
      </div>

      {/* Statistics */}
      <WorkflowStats workflows={workflows} />

      {/* Content Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
        gap: '2rem'
      }}>
        {/* Recent Workflows */}
        <div>
          <h2 style={{ margin: '0 0 1rem 0', fontSize: '1.5rem' }}>
            Recently Updated
          </h2>
          <RecentWorkflows 
            workflows={workflows} 
            onWorkflowSelect={onWorkflowSelect}
          />
        </div>

        {/* Popular Categories */}
        <div>
          <h2 style={{ margin: '0 0 1rem 0', fontSize: '1.5rem' }}>
            Categories
          </h2>
          <PopularCategories workflows={workflows} />
        </div>
      </div>

      {/* Quick Actions */}
      <div style={{
        marginTop: '2rem',
        padding: '1.5rem',
        backgroundColor: '#f8f9fa',
        borderRadius: '8px',
        border: '1px solid #dee2e6'
      }}>
        <h3 style={{ margin: '0 0 1rem 0' }}>Quick Actions</h3>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <a
            href="/workflows"
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: '#007bff',
              color: 'white',
              textDecoration: 'none',
              borderRadius: '6px',
              fontSize: '0.9rem',
              fontWeight: 'bold'
            }}
          >
            Browse All Workflows
          </a>
          <button
            onClick={handleRefresh}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '0.9rem',
              fontWeight: 'bold'
            }}
          >
            Refresh Workflows
          </button>
        </div>
      </div>
    </div>
  );
});

OptimizedWorkflowDashboard.displayName = 'OptimizedWorkflowDashboard';