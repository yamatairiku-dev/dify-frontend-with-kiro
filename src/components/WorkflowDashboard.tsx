import React, { useMemo } from 'react';
import { Link } from 'react-router';
import type { DifyWorkflow } from '../types/dify';
import { useAuth } from '../context/AuthContext';
import { usePermissionCheck } from '../hooks/useProtectedRoute';

export interface WorkflowDashboardProps {
  workflows: DifyWorkflow[];
  loading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
  className?: string;
}

export interface WorkflowStats {
  total: number;
  accessible: number;
  executable: number;
  categories: Record<string, number>;
  recentlyUpdated: DifyWorkflow[];
  mostUsedTags: Array<{ tag: string; count: number }>;
}

export const WorkflowDashboard: React.FC<WorkflowDashboardProps> = ({
  workflows,
  loading = false,
  error = null,
  onRefresh,
  className = '',
}) => {
  const { user } = useAuth();
  const canExecuteWorkflow = usePermissionCheck('workflow', 'execute');
  const canReadWorkflow = usePermissionCheck('workflow', 'read');

  // Calculate workflow statistics
  const stats: WorkflowStats = useMemo(() => {
    const accessible = workflows.filter(workflow => canReadWorkflow);
    const executable = workflows.filter(workflow => canExecuteWorkflow);
    
    // Category distribution
    const categories: Record<string, number> = {};
    accessible.forEach(workflow => {
      const category = workflow.category || 'Uncategorized';
      categories[category] = (categories[category] || 0) + 1;
    });

    // Recently updated workflows (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const recentlyUpdated = accessible
      .filter(workflow => {
        const updatedDate = new Date(workflow.updatedAt || workflow.createdAt || '');
        return updatedDate > thirtyDaysAgo;
      })
      .sort((a, b) => {
        const aDate = new Date(a.updatedAt || a.createdAt || '');
        const bDate = new Date(b.updatedAt || b.createdAt || '');
        return bDate.getTime() - aDate.getTime();
      })
      .slice(0, 5);

    // Most used tags
    const tagCounts: Record<string, number> = {};
    accessible.forEach(workflow => {
      (workflow.tags || []).forEach(tag => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });
    });
    
    const mostUsedTags = Object.entries(tagCounts)
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      total: workflows.length,
      accessible: accessible.length,
      executable: executable.length,
      categories,
      recentlyUpdated,
      mostUsedTags,
    };
  }, [workflows, canReadWorkflow, canExecuteWorkflow]);

  if (loading) {
    return (
      <div className={`workflow-dashboard ${className}`} style={{
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

  if (error) {
    return (
      <div className={`workflow-dashboard ${className}`} style={{
        padding: '2rem',
        textAlign: 'center',
        border: '1px solid #ff6b6b',
        borderRadius: '8px',
        backgroundColor: '#ffe0e0',
        color: '#d63031'
      }}>
        <h2>Error Loading Dashboard</h2>
        <p>{error}</p>
        {onRefresh && (
          <button
            onClick={onRefresh}
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
        )}
      </div>
    );
  }

  return (
    <div className={`workflow-dashboard ${className}`} style={{ fontFamily: 'system-ui, sans-serif' }}>
      {/* Welcome Section */}
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ margin: '0 0 0.5rem 0', fontSize: '2rem', color: '#333' }}>
          Workflow Dashboard
        </h1>
        <p style={{ fontSize: '1.1rem', color: '#666', margin: 0 }}>
          Welcome back, <strong>{user?.name}</strong>! Here's an overview of your available workflows.
        </p>
      </div>

      {/* Statistics Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '1.5rem',
        marginBottom: '2rem'
      }}>
        {/* Total Workflows */}
        <div style={{
          padding: '1.5rem',
          border: '1px solid #ddd',
          borderRadius: '8px',
          backgroundColor: '#f8f9fa',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#0078d4', marginBottom: '0.5rem' }}>
            {stats.total}
          </div>
          <div style={{ fontSize: '1rem', color: '#666' }}>Total Workflows</div>
        </div>

        {/* Accessible Workflows */}
        <div style={{
          padding: '1.5rem',
          border: '1px solid #ddd',
          borderRadius: '8px',
          backgroundColor: '#e8f5e8',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#28a745', marginBottom: '0.5rem' }}>
            {stats.accessible}
          </div>
          <div style={{ fontSize: '1rem', color: '#666' }}>Accessible</div>
        </div>

        {/* Executable Workflows */}
        <div style={{
          padding: '1.5rem',
          border: '1px solid #ddd',
          borderRadius: '8px',
          backgroundColor: '#fff3cd',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#ffc107', marginBottom: '0.5rem' }}>
            {stats.executable}
          </div>
          <div style={{ fontSize: '1rem', color: '#666' }}>Executable</div>
        </div>

        {/* Categories Count */}
        <div style={{
          padding: '1.5rem',
          border: '1px solid #ddd',
          borderRadius: '8px',
          backgroundColor: '#e2e3f0',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#6f42c1', marginBottom: '0.5rem' }}>
            {Object.keys(stats.categories).length}
          </div>
          <div style={{ fontSize: '1rem', color: '#666' }}>Categories</div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
        gap: '2rem',
        marginBottom: '2rem'
      }}>
        {/* Categories Breakdown */}
        <div style={{
          padding: '1.5rem',
          border: '1px solid #ddd',
          borderRadius: '8px',
          backgroundColor: '#f9f9f9'
        }}>
          <h2 style={{ margin: '0 0 1rem 0', fontSize: '1.3rem' }}>Workflows by Category</h2>
          {Object.keys(stats.categories).length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {Object.entries(stats.categories)
                .sort(([, a], [, b]) => b - a)
                .map(([category, count]) => (
                  <div key={category} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: '500' }}>{category}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <div style={{
                        width: `${Math.max(20, (count / stats.accessible) * 100)}px`,
                        height: '8px',
                        backgroundColor: '#0078d4',
                        borderRadius: '4px'
                      }}></div>
                      <span style={{ 
                        minWidth: '30px', 
                        textAlign: 'right',
                        fontSize: '0.9rem',
                        color: '#666'
                      }}>
                        {count}
                      </span>
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            <p style={{ color: '#666', fontStyle: 'italic' }}>No categories available</p>
          )}
        </div>

        {/* Recently Updated */}
        <div style={{
          padding: '1.5rem',
          border: '1px solid #ddd',
          borderRadius: '8px',
          backgroundColor: '#f9f9f9'
        }}>
          <h2 style={{ margin: '0 0 1rem 0', fontSize: '1.3rem' }}>Recently Updated</h2>
          {stats.recentlyUpdated.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {stats.recentlyUpdated.map(workflow => (
                <div key={workflow.id} style={{
                  padding: '0.75rem',
                  border: '1px solid #e0e0e0',
                  borderRadius: '4px',
                  backgroundColor: 'white'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <Link
                        to={`/workflows/${workflow.id}`}
                        style={{
                          fontWeight: 'bold',
                          color: '#0078d4',
                          textDecoration: 'none',
                          fontSize: '0.95rem'
                        }}
                      >
                        {workflow.name}
                      </Link>
                      <div style={{ fontSize: '0.8rem', color: '#666', marginTop: '0.25rem' }}>
                        {workflow.category && (
                          <span style={{ marginRight: '0.5rem' }}>{workflow.category}</span>
                        )}
                        <span>
                          {new Date(workflow.updatedAt || workflow.createdAt || '').toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: '#666', fontStyle: 'italic' }}>No recent updates</p>
          )}
        </div>
      </div>

      {/* Popular Tags */}
      {stats.mostUsedTags.length > 0 && (
        <div style={{
          padding: '1.5rem',
          border: '1px solid #ddd',
          borderRadius: '8px',
          backgroundColor: '#f9f9f9',
          marginBottom: '2rem'
        }}>
          <h2 style={{ margin: '0 0 1rem 0', fontSize: '1.3rem' }}>Popular Tags</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {stats.mostUsedTags.map(({ tag, count }) => (
              <span
                key={tag}
                style={{
                  padding: '0.4rem 0.8rem',
                  backgroundColor: '#e0e0e0',
                  borderRadius: '20px',
                  fontSize: '0.85rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.3rem'
                }}
              >
                {tag}
                <span style={{
                  backgroundColor: '#0078d4',
                  color: 'white',
                  borderRadius: '10px',
                  padding: '0.1rem 0.4rem',
                  fontSize: '0.7rem',
                  fontWeight: 'bold'
                }}>
                  {count}
                </span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div style={{
        padding: '1.5rem',
        border: '1px solid #ddd',
        borderRadius: '8px',
        backgroundColor: '#f0f8ff'
      }}>
        <h2 style={{ margin: '0 0 1rem 0', fontSize: '1.3rem' }}>Quick Actions</h2>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <Link
            to="/workflows"
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: '#0078d4',
              color: 'white',
              textDecoration: 'none',
              borderRadius: '4px',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            📋 Browse All Workflows
          </Link>
          
          {stats.executable > 0 && (
            <Link
              to="/workflows"
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: '#28a745',
                color: 'white',
                textDecoration: 'none',
                borderRadius: '4px',
                fontWeight: 'bold',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              ⚡ Execute Workflows
            </Link>
          )}
          
          {onRefresh && (
            <button
              onClick={onRefresh}
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                fontWeight: 'bold',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              🔄 Refresh Data
            </button>
          )}
        </div>
      </div>

      {/* No Access Message */}
      {stats.accessible === 0 && stats.total > 0 && (
        <div style={{
          padding: '2rem',
          textAlign: 'center',
          border: '1px solid #ffc107',
          borderRadius: '8px',
          backgroundColor: '#fff3cd',
          color: '#856404',
          marginTop: '2rem'
        }}>
          <h3>Limited Access</h3>
          <p>
            There are {stats.total} workflows available, but you don't have permission to access any of them.
            Please contact your administrator to request access.
          </p>
        </div>
      )}
    </div>
  );
};

export default WorkflowDashboard;