import React, { useState } from 'react';
import type { WorkflowResult } from '../types/dify';

export interface WorkflowExecutionResultsProps {
  result: WorkflowResult | null;
  isExecuting?: boolean;
  progress?: number;
  error?: string | null;
  onRetry?: () => void;
  onClear?: () => void;
  className?: string;
}

export interface ResultDisplayOptions {
  format: 'json' | 'table' | 'raw';
  showMetadata: boolean;
  expandAll: boolean;
}

export const WorkflowExecutionResults: React.FC<WorkflowExecutionResultsProps> = ({
  result,
  isExecuting = false,
  progress = 0,
  error = null,
  onRetry,
  onClear,
  className = '',
}) => {
  const [displayOptions, setDisplayOptions] = useState<ResultDisplayOptions>({
    format: 'json',
    showMetadata: true,
    expandAll: false,
  });

  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  const formatDuration = (duration?: number): string => {
    if (!duration) return 'N/A';
    if (duration < 1) return `${Math.round(duration * 1000)}ms`;
    if (duration < 60) return `${duration.toFixed(2)}s`;
    const minutes = Math.floor(duration / 60);
    const seconds = Math.round(duration % 60);
    return `${minutes}m ${seconds}s`;
  };

  const formatTimestamp = (timestamp?: string): string => {
    if (!timestamp) return 'N/A';
    return new Date(timestamp).toLocaleString();
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'completed': return '#28a745';
      case 'failed': return '#dc3545';
      case 'cancelled': return '#6c757d';
      case 'running': return '#007bff';
      case 'pending': return '#ffc107';
      default: return '#6c757d';
    }
  };

  const getStatusIcon = (status: string): string => {
    switch (status) {
      case 'completed': return '✅';
      case 'failed': return '❌';
      case 'cancelled': return '⏹️';
      case 'running': return '⏳';
      case 'pending': return '⏸️';
      default: return '❓';
    }
  };

  const renderJsonValue = (value: any, key?: string, depth = 0): React.ReactElement => {
    const indent = depth * 20;
    
    if (value === null) {
      return <span style={{ color: '#6c757d', fontStyle: 'italic' }}>null</span>;
    }
    
    if (typeof value === 'boolean') {
      return <span style={{ color: '#007bff' }}>{value.toString()}</span>;
    }
    
    if (typeof value === 'number') {
      return <span style={{ color: '#28a745' }}>{value}</span>;
    }
    
    if (typeof value === 'string') {
      return <span style={{ color: '#dc3545' }}>"{value}"</span>;
    }
    
    if (Array.isArray(value)) {
      const sectionKey = `array-${key}-${depth}`;
      const isExpanded = displayOptions.expandAll || expandedSections.has(sectionKey);
      
      return (
        <div>
          <button
            onClick={() => toggleSection(sectionKey)}
            style={{
              background: 'none',
              border: 'none',
              color: '#007bff',
              cursor: 'pointer',
              padding: 0,
              textDecoration: 'underline'
            }}
          >
            [{value.length} items] {isExpanded ? '▼' : '▶'}
          </button>
          {isExpanded && (
            <div style={{ marginLeft: `${indent + 20}px`, marginTop: '0.5rem' }}>
              {value.map((item, index) => (
                <div key={index} style={{ marginBottom: '0.5rem' }}>
                  <span style={{ color: '#6c757d' }}>[{index}]:</span>{' '}
                  {renderJsonValue(item, `${key}-${index}`, depth + 1)}
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }
    
    if (typeof value === 'object') {
      const sectionKey = `object-${key}-${depth}`;
      const isExpanded = displayOptions.expandAll || expandedSections.has(sectionKey);
      const keys = Object.keys(value);
      
      return (
        <div>
          <button
            onClick={() => toggleSection(sectionKey)}
            style={{
              background: 'none',
              border: 'none',
              color: '#007bff',
              cursor: 'pointer',
              padding: 0,
              textDecoration: 'underline'
            }}
          >
            {`{${keys.length} properties}`} {isExpanded ? '▼' : '▶'}
          </button>
          {isExpanded && (
            <div style={{ marginLeft: `${indent + 20}px`, marginTop: '0.5rem' }}>
              {keys.map(objKey => (
                <div key={objKey} style={{ marginBottom: '0.5rem' }}>
                  <span style={{ color: '#6f42c1', fontWeight: 'bold' }}>"{objKey}":</span>{' '}
                  {renderJsonValue(value[objKey], `${key}-${objKey}`, depth + 1)}
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }
    
    return <span>{String(value)}</span>;
  };

  const renderTableView = (data: any): React.ReactElement => {
    if (!data || typeof data !== 'object') {
      return <div>Data is not suitable for table view</div>;
    }

    if (Array.isArray(data)) {
      if (data.length === 0) {
        return <div>Empty array</div>;
      }

      const firstItem = data[0];
      if (typeof firstItem !== 'object') {
        return (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ border: '1px solid #ddd', padding: '0.5rem', backgroundColor: '#f8f9fa' }}>
                  Index
                </th>
                <th style={{ border: '1px solid #ddd', padding: '0.5rem', backgroundColor: '#f8f9fa' }}>
                  Value
                </th>
              </tr>
            </thead>
            <tbody>
              {data.map((item, index) => (
                <tr key={index}>
                  <td style={{ border: '1px solid #ddd', padding: '0.5rem' }}>{index}</td>
                  <td style={{ border: '1px solid #ddd', padding: '0.5rem' }}>{String(item)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        );
      }

      const columns = Array.from(new Set(data.flatMap(item => Object.keys(item))));
      return (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {columns.map(column => (
                <th key={column} style={{ 
                  border: '1px solid #ddd', 
                  padding: '0.5rem', 
                  backgroundColor: '#f8f9fa',
                  textAlign: 'left'
                }}>
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((item, index) => (
              <tr key={index}>
                {columns.map(column => (
                  <td key={column} style={{ border: '1px solid #ddd', padding: '0.5rem' }}>
                    {item[column] !== undefined ? String(item[column]) : '—'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      );
    }

    // Object view as table
    const entries = Object.entries(data);
    return (
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ border: '1px solid #ddd', padding: '0.5rem', backgroundColor: '#f8f9fa' }}>
              Property
            </th>
            <th style={{ border: '1px solid #ddd', padding: '0.5rem', backgroundColor: '#f8f9fa' }}>
              Value
            </th>
          </tr>
        </thead>
        <tbody>
          {entries.map(([key, value]) => (
            <tr key={key}>
              <td style={{ border: '1px solid #ddd', padding: '0.5rem', fontWeight: 'bold' }}>
                {key}
              </td>
              <td style={{ border: '1px solid #ddd', padding: '0.5rem' }}>
                {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  return (
    <div className={`workflow-execution-results ${className}`} style={{ fontFamily: 'system-ui, sans-serif' }}>
      {/* Execution Progress */}
      {isExecuting && (
        <div style={{
          padding: '1.5rem',
          border: '1px solid #007bff',
          borderRadius: '8px',
          backgroundColor: '#e7f3ff',
          marginBottom: '1rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1rem' }}>
            <div style={{
              width: '20px',
              height: '20px',
              border: '2px solid #f3f3f3',
              borderTop: '2px solid #007bff',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              marginRight: '0.5rem'
            }}></div>
            <span style={{ fontWeight: 'bold' }}>Executing workflow...</span>
          </div>
          
          <div style={{
            width: '100%',
            height: '8px',
            backgroundColor: '#e0e0e0',
            borderRadius: '4px',
            overflow: 'hidden',
            marginBottom: '0.5rem'
          }}>
            <div style={{
              width: `${progress}%`,
              height: '100%',
              backgroundColor: '#007bff',
              transition: 'width 0.3s ease'
            }}></div>
          </div>
          
          <div style={{ fontSize: '0.9rem', color: '#666' }}>
            Progress: {progress.toFixed(0)}%
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div style={{
          padding: '1.5rem',
          border: '1px solid #dc3545',
          borderRadius: '8px',
          backgroundColor: '#f8d7da',
          color: '#721c24',
          marginBottom: '1rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1rem' }}>
            <span style={{ fontSize: '1.2rem', marginRight: '0.5rem' }}>❌</span>
            <strong>Execution Error</strong>
          </div>
          <p style={{ margin: '0 0 1rem 0' }}>{error}</p>
          {onRetry && (
            <button
              onClick={onRetry}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: '#dc3545',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Retry Execution
            </button>
          )}
        </div>
      )}

      {/* Results Display */}
      {result && (
        <div style={{
          border: '1px solid #ddd',
          borderRadius: '8px',
          backgroundColor: '#f9f9f9'
        }}>
          {/* Results Header */}
          <div style={{
            padding: '1rem 1.5rem',
            borderBottom: '1px solid #ddd',
            backgroundColor: '#f8f9fa',
            borderRadius: '8px 8px 0 0'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span>{getStatusIcon(result.status)}</span>
                Execution Results
              </h3>
              
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {onClear && (
                  <button
                    onClick={onClear}
                    style={{
                      padding: '0.25rem 0.5rem',
                      backgroundColor: '#6c757d',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '0.8rem'
                    }}
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Metadata Section */}
          {displayOptions.showMetadata && (
            <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid #eee' }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '1rem'
              }}>
                <div>
                  <strong>Status:</strong>{' '}
                  <span style={{ 
                    color: getStatusColor(result.status),
                    fontWeight: 'bold'
                  }}>
                    {result.status.toUpperCase()}
                  </span>
                </div>
                
                <div>
                  <strong>Execution ID:</strong>{' '}
                  <code style={{ 
                    backgroundColor: '#e9ecef',
                    padding: '0.2rem 0.4rem',
                    borderRadius: '3px',
                    fontSize: '0.85rem'
                  }}>
                    {result.executionId}
                  </code>
                </div>
                
                <div>
                  <strong>Duration:</strong> {formatDuration(result.duration)}
                </div>
                
                <div>
                  <strong>Started:</strong> {formatTimestamp(result.startedAt)}
                </div>
                
                {result.completedAt && (
                  <div>
                    <strong>Completed:</strong> {formatTimestamp(result.completedAt)}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Display Options */}
          {result.result && (
            <div style={{ 
              padding: '1rem 1.5rem', 
              borderBottom: '1px solid #eee',
              backgroundColor: '#f8f9fa'
            }}>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <div>
                  <label style={{ marginRight: '0.5rem', fontWeight: 'bold' }}>Format:</label>
                  <select
                    value={displayOptions.format}
                    onChange={(e) => setDisplayOptions(prev => ({ 
                      ...prev, 
                      format: e.target.value as 'json' | 'table' | 'raw'
                    }))}
                    style={{
                      padding: '0.25rem 0.5rem',
                      border: '1px solid #ddd',
                      borderRadius: '4px'
                    }}
                  >
                    <option value="json">JSON</option>
                    <option value="table">Table</option>
                    <option value="raw">Raw</option>
                  </select>
                </div>
                
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <input
                    type="checkbox"
                    checked={displayOptions.showMetadata}
                    onChange={(e) => setDisplayOptions(prev => ({ 
                      ...prev, 
                      showMetadata: e.target.checked 
                    }))}
                  />
                  Show Metadata
                </label>
                
                {displayOptions.format === 'json' && (
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <input
                      type="checkbox"
                      checked={displayOptions.expandAll}
                      onChange={(e) => setDisplayOptions(prev => ({ 
                        ...prev, 
                        expandAll: e.target.checked 
                      }))}
                    />
                    Expand All
                  </label>
                )}
              </div>
            </div>
          )}

          {/* Results Content */}
          <div style={{ padding: '1.5rem' }}>
            {result.result ? (
              <div>
                {displayOptions.format === 'json' && (
                  <div style={{
                    fontFamily: 'monospace',
                    fontSize: '0.9rem',
                    lineHeight: '1.4'
                  }}>
                    {renderJsonValue(result.result, 'root')}
                  </div>
                )}
                
                {displayOptions.format === 'table' && (
                  <div style={{ overflowX: 'auto' }}>
                    {renderTableView(result.result)}
                  </div>
                )}
                
                {displayOptions.format === 'raw' && (
                  <pre style={{
                    backgroundColor: '#f8f9fa',
                    padding: '1rem',
                    borderRadius: '4px',
                    overflow: 'auto',
                    margin: 0,
                    fontSize: '0.85rem',
                    lineHeight: '1.4'
                  }}>
                    {JSON.stringify(result.result, null, 2)}
                  </pre>
                )}
              </div>
            ) : (
              <div style={{ 
                textAlign: 'center', 
                color: '#6c757d',
                fontStyle: 'italic',
                padding: '2rem'
              }}>
                No result data available
              </div>
            )}
          </div>
        </div>
      )}

      {/* Empty State */}
      {!isExecuting && !error && !result && (
        <div style={{
          padding: '3rem',
          textAlign: 'center',
          border: '2px dashed #ddd',
          borderRadius: '8px',
          color: '#6c757d'
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📊</div>
          <h3 style={{ margin: '0 0 0.5rem 0' }}>No Results Yet</h3>
          <p style={{ margin: 0 }}>Execute a workflow to see results here.</p>
        </div>
      )}

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default WorkflowExecutionResults;