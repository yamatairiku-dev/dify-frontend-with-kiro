import React, { useState, useMemo } from 'react';
import { Link } from 'react-router';
import type { DifyWorkflow } from '../types/dify';
import { usePermissionCheck } from '../hooks/useProtectedRoute';

export interface WorkflowListProps {
  workflows: DifyWorkflow[];
  loading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
  showSearch?: boolean;
  showFilters?: boolean;
  className?: string;
}

export interface WorkflowFilters {
  category: string;
  tags: string[];
  status: 'all' | 'active' | 'inactive';
  permissions: string[];
}

export const WorkflowList: React.FC<WorkflowListProps> = ({
  workflows,
  loading = false,
  error = null,
  onRefresh,
  showSearch = true,
  showFilters = true,
  className = '',
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState<WorkflowFilters>({
    category: '',
    tags: [],
    status: 'all',
    permissions: [],
  });
  const [sortBy, setSortBy] = useState<'name' | 'category' | 'updated' | 'created'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Permission check hook
  const canExecuteWorkflow = usePermissionCheck('workflow', 'execute');

  // Get unique categories and tags for filter options
  const { categories, allTags, allPermissions } = useMemo(() => {
    const categories = Array.from(new Set(workflows.map(w => w.category).filter(Boolean)));
    const allTags = Array.from(new Set(workflows.flatMap(w => w.tags || [])));
    const allPermissions = Array.from(new Set(workflows.flatMap(w => w.requiredPermissions)));
    
    return { categories, allTags, allPermissions };
  }, [workflows]);

  // Filter and search workflows
  const filteredWorkflows = useMemo(() => {
    let filtered = workflows;

    // Apply search filter
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(workflow =>
        workflow.name.toLowerCase().includes(term) ||
        workflow.description.toLowerCase().includes(term) ||
        (workflow.tags || []).some(tag => tag.toLowerCase().includes(term))
      );
    }

    // Apply category filter
    if (filters.category) {
      filtered = filtered.filter(workflow => workflow.category === filters.category);
    }

    // Apply tags filter
    if (filters.tags.length > 0) {
      filtered = filtered.filter(workflow =>
        filters.tags.every(tag => (workflow.tags || []).includes(tag))
      );
    }

    // Apply status filter
    if (filters.status !== 'all') {
      const isActive = filters.status === 'active';
      filtered = filtered.filter(workflow => 
        workflow.isActive === undefined ? true : workflow.isActive === isActive
      );
    }

    // Apply permissions filter
    if (filters.permissions.length > 0) {
      filtered = filtered.filter(workflow =>
        filters.permissions.every(permission => 
          workflow.requiredPermissions.includes(permission)
        )
      );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aValue: string | Date;
      let bValue: string | Date;

      switch (sortBy) {
        case 'name':
          aValue = a.name;
          bValue = b.name;
          break;
        case 'category':
          aValue = a.category || '';
          bValue = b.category || '';
          break;
        case 'updated':
          aValue = new Date(a.updatedAt || a.createdAt || '');
          bValue = new Date(b.updatedAt || b.createdAt || '');
          break;
        case 'created':
          aValue = new Date(a.createdAt || '');
          bValue = new Date(b.createdAt || '');
          break;
        default:
          aValue = a.name;
          bValue = b.name;
      }

      if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [workflows, searchTerm, filters, sortBy, sortOrder]);

  const handleTagToggle = (tag: string) => {
    setFilters(prev => ({
      ...prev,
      tags: prev.tags.includes(tag)
        ? prev.tags.filter(t => t !== tag)
        : [...prev.tags, tag]
    }));
  };

  const handlePermissionToggle = (permission: string) => {
    setFilters(prev => ({
      ...prev,
      permissions: prev.permissions.includes(permission)
        ? prev.permissions.filter(p => p !== permission)
        : [...prev.permissions, permission]
    }));
  };

  const clearFilters = () => {
    setSearchTerm('');
    setFilters({
      category: '',
      tags: [],
      status: 'all',
      permissions: [],
    });
  };

  const hasActiveFilters = searchTerm.trim() || 
    filters.category || 
    filters.tags.length > 0 || 
    filters.status !== 'all' || 
    filters.permissions.length > 0;

  if (loading) {
    return (
      <div className={`workflow-list ${className}`} style={{
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

  if (error) {
    return (
      <div className={`workflow-list ${className}`} style={{
        padding: '2rem',
        textAlign: 'center',
        border: '1px solid #ff6b6b',
        borderRadius: '8px',
        backgroundColor: '#ffe0e0',
        color: '#d63031'
      }}>
        <h2>Error Loading Workflows</h2>
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
    <div className={`workflow-list ${className}`} style={{ fontFamily: 'system-ui, sans-serif' }}>
      {/* Search and Filter Controls */}
      {(showSearch || showFilters) && (
        <div style={{
          padding: '1.5rem',
          border: '1px solid #ddd',
          borderRadius: '8px',
          backgroundColor: '#f9f9f9',
          marginBottom: '2rem'
        }}>
          {/* Search Bar */}
          {showSearch && (
            <div style={{ marginBottom: showFilters ? '1.5rem' : '0' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                Search Workflows
              </label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by name, description, or tags..."
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '1rem'
                }}
              />
            </div>
          )}

          {/* Filters */}
          {showFilters && (
            <div>
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '1rem',
                marginBottom: '1rem'
              }}>
                {/* Category Filter */}
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                    Category
                  </label>
                  <select
                    value={filters.category}
                    onChange={(e) => setFilters(prev => ({ ...prev, category: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      border: '1px solid #ddd',
                      borderRadius: '4px'
                    }}
                  >
                    <option value="">All Categories</option>
                    {categories.map(category => (
                      <option key={category} value={category}>{category}</option>
                    ))}
                  </select>
                </div>

                {/* Status Filter */}
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                    Status
                  </label>
                  <select
                    value={filters.status}
                    onChange={(e) => setFilters(prev => ({ 
                      ...prev, 
                      status: e.target.value as 'all' | 'active' | 'inactive'
                    }))}
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      border: '1px solid #ddd',
                      borderRadius: '4px'
                    }}
                  >
                    <option value="all">All Status</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>

                {/* Sort Options */}
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                    Sort By
                  </label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                      style={{
                        flex: 1,
                        padding: '0.5rem',
                        border: '1px solid #ddd',
                        borderRadius: '4px'
                      }}
                    >
                      <option value="name">Name</option>
                      <option value="category">Category</option>
                      <option value="updated">Updated</option>
                      <option value="created">Created</option>
                    </select>
                    <select
                      value={sortOrder}
                      onChange={(e) => setSortOrder(e.target.value as 'asc' | 'desc')}
                      style={{
                        padding: '0.5rem',
                        border: '1px solid #ddd',
                        borderRadius: '4px'
                      }}
                    >
                      <option value="asc">↑ Asc</option>
                      <option value="desc">↓ Desc</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Tags Filter */}
              {allTags.length > 0 && (
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                    Tags
                  </label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    {allTags.map(tag => (
                      <button
                        key={tag}
                        onClick={() => handleTagToggle(tag)}
                        style={{
                          padding: '0.25rem 0.5rem',
                          border: `1px solid ${filters.tags.includes(tag) ? '#0078d4' : '#ddd'}`,
                          borderRadius: '4px',
                          backgroundColor: filters.tags.includes(tag) ? '#0078d4' : 'white',
                          color: filters.tags.includes(tag) ? 'white' : '#333',
                          cursor: 'pointer',
                          fontSize: '0.8rem'
                        }}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Permissions Filter */}
              {allPermissions.length > 0 && (
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                    Required Permissions
                  </label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    {allPermissions.map(permission => (
                      <button
                        key={permission}
                        onClick={() => handlePermissionToggle(permission)}
                        style={{
                          padding: '0.25rem 0.5rem',
                          border: `1px solid ${filters.permissions.includes(permission) ? '#0078d4' : '#ddd'}`,
                          borderRadius: '4px',
                          backgroundColor: filters.permissions.includes(permission) ? '#0078d4' : 'white',
                          color: filters.permissions.includes(permission) ? 'white' : '#333',
                          cursor: 'pointer',
                          fontSize: '0.8rem'
                        }}
                      >
                        {permission}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Clear Filters */}
              {hasActiveFilters && (
                <div style={{ textAlign: 'right' }}>
                  <button
                    onClick={clearFilters}
                    style={{
                      padding: '0.5rem 1rem',
                      backgroundColor: '#6c757d',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '0.9rem'
                    }}
                  >
                    Clear All Filters
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Results Summary */}
      <div style={{ 
        marginBottom: '1rem',
        padding: '0.75rem 1rem',
        backgroundColor: '#e9ecef',
        borderRadius: '4px',
        fontSize: '0.9rem',
        color: '#495057'
      }}>
        Showing {filteredWorkflows.length} of {workflows.length} workflows
        {hasActiveFilters && (
          <span style={{ fontWeight: 'bold', marginLeft: '0.5rem' }}>
            (filtered)
          </span>
        )}
      </div>

      {/* Workflow Grid */}
      {filteredWorkflows.length > 0 ? (
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
          gap: '2rem'
        }}>
          {filteredWorkflows.map((workflow) => {
            const hasPermission = canExecuteWorkflow;
            
            return (
              <div 
                key={workflow.id}
                style={{
                  padding: '1.5rem',
                  border: '1px solid #ddd',
                  borderRadius: '8px',
                  backgroundColor: hasPermission ? '#f9f9f9' : '#f5f5f5',
                  opacity: hasPermission ? 1 : 0.7,
                  transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                  cursor: 'pointer'
                }}
                onMouseEnter={(e) => {
                  if (hasPermission) {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                {/* Header */}
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                    <h3 style={{ margin: '0', fontSize: '1.2rem' }}>{workflow.name}</h3>
                    {workflow.version && (
                      <span style={{
                        padding: '0.2rem 0.4rem',
                        backgroundColor: '#e0e0e0',
                        borderRadius: '3px',
                        fontSize: '0.7rem',
                        fontFamily: 'monospace'
                      }}>
                        v{workflow.version}
                      </span>
                    )}
                  </div>
                  
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    {workflow.category && (
                      <span style={{
                        padding: '0.25rem 0.5rem',
                        backgroundColor: '#e0e0e0',
                        borderRadius: '4px',
                        fontSize: '0.8rem'
                      }}>
                        {workflow.category}
                      </span>
                    )}
                    
                    {workflow.isActive !== undefined && (
                      <span style={{
                        padding: '0.25rem 0.5rem',
                        backgroundColor: workflow.isActive ? '#d4edda' : '#f8d7da',
                        color: workflow.isActive ? '#155724' : '#721c24',
                        borderRadius: '4px',
                        fontSize: '0.8rem'
                      }}>
                        {workflow.isActive ? 'Active' : 'Inactive'}
                      </span>
                    )}
                  </div>
                </div>
                
                {/* Description */}
                <p style={{ 
                  marginBottom: '1.5rem', 
                  lineHeight: '1.5',
                  color: '#555'
                }}>
                  {workflow.description}
                </p>
                
                {/* Metadata */}
                <div style={{ marginBottom: '1rem', fontSize: '0.9rem' }}>
                  <div style={{ marginBottom: '0.5rem' }}>
                    <strong>Required permissions:</strong>{' '}
                    <span style={{ color: '#666' }}>
                      {workflow.requiredPermissions.length > 0 
                        ? workflow.requiredPermissions.join(', ')
                        : 'None'
                      }
                    </span>
                  </div>
                  
                  {workflow.tags && workflow.tags.length > 0 && (
                    <div style={{ marginTop: '0.5rem' }}>
                      <strong>Tags:</strong>{' '}
                      {workflow.tags.map(tag => (
                        <span
                          key={tag}
                          style={{
                            display: 'inline-block',
                            padding: '0.2rem 0.4rem',
                            backgroundColor: '#e0e0e0',
                            borderRadius: '3px',
                            fontSize: '0.7rem',
                            marginRight: '0.5rem',
                            marginTop: '0.2rem'
                          }}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                  
                  {(workflow.createdAt || workflow.updatedAt) && (
                    <div style={{ marginTop: '0.5rem', color: '#666', fontSize: '0.8rem' }}>
                      {workflow.updatedAt && (
                        <div>Updated: {new Date(workflow.updatedAt).toLocaleDateString()}</div>
                      )}
                      {workflow.createdAt && (
                        <div>Created: {new Date(workflow.createdAt).toLocaleDateString()}</div>
                      )}
                    </div>
                  )}
                </div>
                
                {/* Action Button */}
                {hasPermission ? (
                  <Link
                    to={`/workflows/${workflow.id}`}
                    style={{
                      display: 'inline-block',
                      padding: '0.75rem 1rem',
                      backgroundColor: '#0078d4',
                      color: 'white',
                      textDecoration: 'none',
                      borderRadius: '4px',
                      fontWeight: 'bold',
                      transition: 'background-color 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#106ebe';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = '#0078d4';
                    }}
                  >
                    Execute Workflow →
                  </Link>
                ) : (
                  <div style={{
                    padding: '0.75rem 1rem',
                    backgroundColor: '#ccc',
                    color: '#666',
                    borderRadius: '4px',
                    textAlign: 'center',
                    fontWeight: 'bold'
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
          <h2>No Workflows Found</h2>
          <p>
            {hasActiveFilters 
              ? 'No workflows match your current filters. Try adjusting your search criteria.'
              : 'There are no workflows available for your current permissions.'
            }
          </p>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
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
              Clear Filters
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default WorkflowList;