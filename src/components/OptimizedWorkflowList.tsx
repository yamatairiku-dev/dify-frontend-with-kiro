import React, { memo, useMemo, useCallback, useState } from 'react';
import type { DifyWorkflow } from '../types/dify';

interface OptimizedWorkflowListProps {
  workflows: DifyWorkflow[];
  loading: boolean;
  error: Error | null;
  onRefresh: () => void;
  onWorkflowSelect?: (workflow: DifyWorkflow) => void;
  showSearch?: boolean;
  showFilters?: boolean;
}

// Memoized workflow item component
const WorkflowItem = memo<{
  workflow: DifyWorkflow;
  onSelect?: (workflow: DifyWorkflow) => void;
}>(({ workflow, onSelect }) => {
  const handleClick = useCallback(() => {
    onSelect?.(workflow);
  }, [workflow, onSelect]);

  return (
    <div
      style={{
        padding: '1rem',
        border: '1px solid #ddd',
        borderRadius: '8px',
        backgroundColor: '#fff',
        cursor: onSelect ? 'pointer' : 'default',
        transition: 'box-shadow 0.2s ease',
      }}
      onClick={handleClick}
      onMouseEnter={(e) => {
        if (onSelect) {
          e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
        <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#333' }}>
          {workflow.name}
        </h3>
        {workflow.isActive !== false && (
          <span style={{
            padding: '0.25rem 0.5rem',
            backgroundColor: '#28a745',
            color: 'white',
            borderRadius: '4px',
            fontSize: '0.75rem',
            fontWeight: 'bold'
          }}>
            Active
          </span>
        )}
      </div>
      
      <p style={{ margin: '0 0 0.5rem 0', color: '#666', fontSize: '0.9rem' }}>
        {workflow.description}
      </p>
      
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
        {workflow.category && (
          <span style={{
            padding: '0.25rem 0.5rem',
            backgroundColor: '#007bff',
            color: 'white',
            borderRadius: '4px',
            fontSize: '0.75rem'
          }}>
            {workflow.category}
          </span>
        )}
        {workflow.tags?.map((tag, index) => (
          <span
            key={index}
            style={{
              padding: '0.25rem 0.5rem',
              backgroundColor: '#6c757d',
              color: 'white',
              borderRadius: '4px',
              fontSize: '0.75rem'
            }}
          >
            {tag}
          </span>
        ))}
      </div>
      
      {workflow.requiredPermissions && workflow.requiredPermissions.length > 0 && (
        <div style={{ fontSize: '0.8rem', color: '#666' }}>
          <strong>Required permissions:</strong> {workflow.requiredPermissions.join(', ')}
        </div>
      )}
      
      {workflow.updatedAt && (
        <div style={{ fontSize: '0.8rem', color: '#999', marginTop: '0.5rem' }}>
          Updated: {new Date(workflow.updatedAt).toLocaleDateString()}
        </div>
      )}
    </div>
  );
});

WorkflowItem.displayName = 'WorkflowItem';

// Memoized search component
const WorkflowSearch = memo<{
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}>(({ value, onChange, placeholder = 'Search workflows...' }) => {
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  }, [onChange]);

  return (
    <input
      type="text"
      value={value}
      onChange={handleChange}
      placeholder={placeholder}
      style={{
        width: '100%',
        padding: '0.75rem',
        border: '1px solid #ddd',
        borderRadius: '4px',
        fontSize: '1rem',
        outline: 'none',
        transition: 'border-color 0.2s ease',
      }}
      onFocus={(e) => {
        e.target.style.borderColor = '#007bff';
      }}
      onBlur={(e) => {
        e.target.style.borderColor = '#ddd';
      }}
    />
  );
});

WorkflowSearch.displayName = 'WorkflowSearch';

// Memoized filter component
const WorkflowFilters = memo<{
  categories: string[];
  selectedCategory: string;
  onCategoryChange: (category: string) => void;
  showActiveOnly: boolean;
  onActiveOnlyChange: (showActiveOnly: boolean) => void;
}>(({ categories, selectedCategory, onCategoryChange, showActiveOnly, onActiveOnlyChange }) => {
  const handleCategoryChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    onCategoryChange(e.target.value);
  }, [onCategoryChange]);

  const handleActiveOnlyChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onActiveOnlyChange(e.target.checked);
  }, [onActiveOnlyChange]);

  return (
    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
      <div>
        <label htmlFor="category-filter" style={{ marginRight: '0.5rem', fontSize: '0.9rem' }}>
          Category:
        </label>
        <select
          id="category-filter"
          value={selectedCategory}
          onChange={handleCategoryChange}
          style={{
            padding: '0.5rem',
            border: '1px solid #ddd',
            borderRadius: '4px',
            fontSize: '0.9rem',
          }}
        >
          <option value="">All Categories</option>
          {categories.map(category => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>
      </div>
      
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <input
          type="checkbox"
          id="active-only-filter"
          checked={showActiveOnly}
          onChange={handleActiveOnlyChange}
          style={{ marginRight: '0.5rem' }}
        />
        <label htmlFor="active-only-filter" style={{ fontSize: '0.9rem' }}>
          Active workflows only
        </label>
      </div>
    </div>
  );
});

WorkflowFilters.displayName = 'WorkflowFilters';

// Main optimized workflow list component
export const OptimizedWorkflowList = memo<OptimizedWorkflowListProps>(({
  workflows,
  loading,
  error,
  onRefresh,
  onWorkflowSelect,
  showSearch = true,
  showFilters = true,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [showActiveOnly, setShowActiveOnly] = useState(false);

  // Memoized categories list
  const categories = useMemo(() => {
    const categorySet = new Set<string>();
    workflows.forEach(workflow => {
      if (workflow.category) {
        categorySet.add(workflow.category);
      }
    });
    return Array.from(categorySet).sort();
  }, [workflows]);

  // Memoized filtered workflows
  const filteredWorkflows = useMemo(() => {
    return workflows.filter(workflow => {
      // Search filter
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const matchesSearch = 
          workflow.name.toLowerCase().includes(searchLower) ||
          workflow.description.toLowerCase().includes(searchLower) ||
          workflow.tags?.some(tag => tag.toLowerCase().includes(searchLower));
        
        if (!matchesSearch) return false;
      }

      // Category filter
      if (selectedCategory && workflow.category !== selectedCategory) {
        return false;
      }

      // Active filter
      if (showActiveOnly && workflow.isActive === false) {
        return false;
      }

      return true;
    });
  }, [workflows, searchTerm, selectedCategory, showActiveOnly]);

  // Memoized callbacks
  const handleSearchChange = useCallback((value: string) => {
    setSearchTerm(value);
  }, []);

  const handleCategoryChange = useCallback((category: string) => {
    setSelectedCategory(category);
  }, []);

  const handleActiveOnlyChange = useCallback((showActive: boolean) => {
    setShowActiveOnly(showActive);
  }, []);

  const handleRefresh = useCallback(() => {
    onRefresh();
  }, [onRefresh]);

  if (loading) {
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
        <h3 style={{ margin: '0 0 1rem 0' }}>Error Loading Workflows</h3>
        <p style={{ margin: '0 0 1rem 0' }}>
          {error.message || 'An unexpected error occurred while loading workflows.'}
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
      {/* Header with refresh button */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '1rem' 
      }}>
        <h2 style={{ margin: 0 }}>
          Workflows ({filteredWorkflows.length})
        </h2>
        <button
          onClick={handleRefresh}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '0.9rem'
          }}
        >
          Refresh
        </button>
      </div>

      {/* Search and filters */}
      {(showSearch || showFilters) && (
        <div style={{ marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {showSearch && (
            <WorkflowSearch
              value={searchTerm}
              onChange={handleSearchChange}
              placeholder="Search workflows by name, description, or tags..."
            />
          )}
          
          {showFilters && categories.length > 0 && (
            <WorkflowFilters
              categories={categories}
              selectedCategory={selectedCategory}
              onCategoryChange={handleCategoryChange}
              showActiveOnly={showActiveOnly}
              onActiveOnlyChange={handleActiveOnlyChange}
            />
          )}
        </div>
      )}

      {/* Workflows grid */}
      {filteredWorkflows.length === 0 ? (
        <div style={{
          padding: '3rem',
          textAlign: 'center',
          color: '#666',
          backgroundColor: '#f8f9fa',
          borderRadius: '8px'
        }}>
          <h3 style={{ margin: '0 0 1rem 0' }}>No Workflows Found</h3>
          <p style={{ margin: 0 }}>
            {workflows.length === 0 
              ? 'No workflows are available with your current permissions.'
              : 'No workflows match your current search and filter criteria.'
            }
          </p>
          {(searchTerm || selectedCategory || showActiveOnly) && (
            <button
              onClick={() => {
                setSearchTerm('');
                setSelectedCategory('');
                setShowActiveOnly(false);
              }}
              style={{
                marginTop: '1rem',
                padding: '0.5rem 1rem',
                backgroundColor: '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.9rem'
              }}
            >
              Clear Filters
            </button>
          )}
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
          gap: '1rem'
        }}>
          {filteredWorkflows.map(workflow => (
            <WorkflowItem
              key={workflow.id}
              workflow={workflow}
              onSelect={onWorkflowSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
});

OptimizedWorkflowList.displayName = 'OptimizedWorkflowList';