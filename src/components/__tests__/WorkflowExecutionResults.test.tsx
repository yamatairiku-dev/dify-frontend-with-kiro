import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { WorkflowExecutionResults } from '../WorkflowExecutionResults';
import type { WorkflowResult } from '../../types/dify';

// Mock workflow results
const mockSuccessResult: WorkflowResult = {
  executionId: 'exec-123',
  status: 'completed',
  result: {
    sentiment: 'positive',
    topics: ['technology', 'innovation'],
    confidence: 0.95,
    metadata: {
      processingTime: 1.5,
      model: 'gpt-4'
    }
  },
  startedAt: '2024-01-15T10:00:00Z',
  completedAt: '2024-01-15T10:00:05Z',
  duration: 5.2
};

const mockFailedResult: WorkflowResult = {
  executionId: 'exec-456',
  status: 'failed',
  error: 'Invalid input format',
  startedAt: '2024-01-15T10:00:00Z',
  completedAt: '2024-01-15T10:00:03Z',
  duration: 3.1
};

const mockRunningResult: WorkflowResult = {
  executionId: 'exec-789',
  status: 'running',
  startedAt: '2024-01-15T10:00:00Z'
};

const mockArrayResult: WorkflowResult = {
  executionId: 'exec-array',
  status: 'completed',
  result: [
    { id: 1, name: 'Item 1', value: 100 },
    { id: 2, name: 'Item 2', value: 200 },
    { id: 3, name: 'Item 3', value: 300 }
  ],
  startedAt: '2024-01-15T10:00:00Z',
  completedAt: '2024-01-15T10:00:02Z',
  duration: 2.0
};

describe('WorkflowExecutionResults', () => {
  it('renders empty state when no result', () => {
    render(<WorkflowExecutionResults result={null} />);

    expect(screen.getByText('📊')).toBeInTheDocument();
    expect(screen.getByText('No Results Yet')).toBeInTheDocument();
    expect(screen.getByText('Execute a workflow to see results here.')).toBeInTheDocument();
  });

  it('renders execution progress correctly', () => {
    render(
      <WorkflowExecutionResults
        result={null}
        isExecuting={true}
        progress={45}
      />
    );

    expect(screen.getByText('Executing workflow...')).toBeInTheDocument();
    expect(screen.getByText('Progress: 45%')).toBeInTheDocument();
    
    // Check progress bar exists (it's a div, not a progressbar role)
    const progressContainer = screen.getByText('Progress: 45%').previousElementSibling;
    expect(progressContainer).toBeInTheDocument();
  });

  it('renders error state correctly', () => {
    const mockRetry = jest.fn();
    render(
      <WorkflowExecutionResults
        result={null}
        error="Network connection failed"
        onRetry={mockRetry}
      />
    );

    expect(screen.getByText('❌')).toBeInTheDocument();
    expect(screen.getByText('Execution Error')).toBeInTheDocument();
    expect(screen.getByText('Network connection failed')).toBeInTheDocument();
    
    const retryButton = screen.getByText('Retry Execution');
    fireEvent.click(retryButton);
    expect(mockRetry).toHaveBeenCalledTimes(1);
  });

  it('renders successful result correctly', () => {
    render(<WorkflowExecutionResults result={mockSuccessResult} />);

    expect(screen.getByText('✅')).toBeInTheDocument();
    expect(screen.getByText('Execution Results')).toBeInTheDocument();
    
    // Check metadata
    expect(screen.getByText('COMPLETED')).toBeInTheDocument();
    expect(screen.getByText('exec-123')).toBeInTheDocument();
    expect(screen.getByText('5.20s')).toBeInTheDocument();
    
    // Check result data
    expect(screen.getByText('"sentiment":')).toBeInTheDocument();
    expect(screen.getByText('"positive"')).toBeInTheDocument();
  });

  it('renders failed result correctly', () => {
    render(<WorkflowExecutionResults result={mockFailedResult} />);

    expect(screen.getByText('❌')).toBeInTheDocument();
    expect(screen.getByText('FAILED')).toBeInTheDocument();
    expect(screen.getByText('Invalid input format')).toBeInTheDocument();
  });

  it('renders running result correctly', () => {
    render(<WorkflowExecutionResults result={mockRunningResult} />);

    expect(screen.getByText('⏳')).toBeInTheDocument();
    expect(screen.getByText('RUNNING')).toBeInTheDocument();
    expect(screen.getByText('exec-789')).toBeInTheDocument();
  });

  it('toggles metadata visibility', async () => {
    render(<WorkflowExecutionResults result={mockSuccessResult} />);

    // Metadata should be visible by default
    expect(screen.getByText('Status:')).toBeInTheDocument();
    
    // Toggle metadata off
    const metadataCheckbox = screen.getByLabelText('Show Metadata');
    fireEvent.click(metadataCheckbox);
    
    await waitFor(() => {
      expect(screen.queryByText('Status:')).not.toBeInTheDocument();
    });
  });

  it('switches between display formats', async () => {
    render(<WorkflowExecutionResults result={mockArrayResult} />);

    // Default should be JSON format
    expect(screen.getByDisplayValue('JSON')).toBeInTheDocument();
    
    // Switch to table format
    const formatSelect = screen.getByDisplayValue('JSON');
    fireEvent.change(formatSelect, { target: { value: 'table' } });
    
    await waitFor(() => {
      expect(screen.getByText('Property')).toBeInTheDocument();
      expect(screen.getByText('Value')).toBeInTheDocument();
    });
    
    // Switch to raw format
    fireEvent.change(formatSelect, { target: { value: 'raw' } });
    
    await waitFor(() => {
      expect(screen.getByText('[')).toBeInTheDocument();
    });
  });

  it('expands and collapses JSON sections', async () => {
    render(<WorkflowExecutionResults result={mockSuccessResult} />);

    // Find expandable sections
    const objectButton = screen.getByText(/properties/);
    expect(objectButton).toBeInTheDocument();
    
    // Click to expand
    fireEvent.click(objectButton);
    
    await waitFor(() => {
      expect(screen.getByText('"sentiment":')).toBeInTheDocument();
    });
  });

  it('renders table view for array data', async () => {
    render(<WorkflowExecutionResults result={mockArrayResult} />);

    // Switch to table format
    const formatSelect = screen.getByDisplayValue('JSON');
    fireEvent.change(formatSelect, { target: { value: 'table' } });
    
    await waitFor(() => {
      expect(screen.getByText('id')).toBeInTheDocument();
      expect(screen.getByText('name')).toBeInTheDocument();
      expect(screen.getByText('value')).toBeInTheDocument();
      expect(screen.getByText('Item 1')).toBeInTheDocument();
      expect(screen.getByText('100')).toBeInTheDocument();
    });
  });

  it('handles expand all option', async () => {
    render(<WorkflowExecutionResults result={mockSuccessResult} />);

    // Toggle expand all
    const expandAllCheckbox = screen.getByLabelText('Expand All');
    fireEvent.click(expandAllCheckbox);
    
    await waitFor(() => {
      // All sections should be expanded
      expect(screen.getByText('"sentiment":')).toBeInTheDocument();
      expect(screen.getByText('"topics":')).toBeInTheDocument();
    });
  });

  it('clears results when clear button is clicked', () => {
    const mockClear = jest.fn();
    render(
      <WorkflowExecutionResults
        result={mockSuccessResult}
        onClear={mockClear}
      />
    );

    const clearButton = screen.getByText('Clear');
    fireEvent.click(clearButton);
    expect(mockClear).toHaveBeenCalledTimes(1);
  });

  it('formats duration correctly', () => {
    const shortResult = { ...mockSuccessResult, duration: 0.5 };
    const longResult = { ...mockSuccessResult, duration: 125.7 };
    
    const { rerender } = render(<WorkflowExecutionResults result={shortResult} />);
    expect(screen.getByText('500ms')).toBeInTheDocument();
    
    rerender(<WorkflowExecutionResults result={longResult} />);
    expect(screen.getByText('2m 6s')).toBeInTheDocument();
  });

  it('formats timestamps correctly', () => {
    render(<WorkflowExecutionResults result={mockSuccessResult} />);

    // Check that timestamps are displayed (exact format may vary by locale)
    expect(screen.getByText(/Started:/)).toBeInTheDocument();
    expect(screen.getByText(/Completed:/)).toBeInTheDocument();
  });

  it('handles null and undefined values in JSON', () => {
    const resultWithNulls: WorkflowResult = {
      executionId: 'exec-null',
      status: 'completed',
      result: {
        value: null,
        undefined: undefined,
        empty: '',
        zero: 0,
        false: false
      }
    };

    render(<WorkflowExecutionResults result={resultWithNulls} />);

    expect(screen.getByText('null')).toBeInTheDocument();
    expect(screen.getByText('0')).toBeInTheDocument();
    expect(screen.getByText('false')).toBeInTheDocument();
  });

  it('handles complex nested objects', () => {
    const complexResult: WorkflowResult = {
      executionId: 'exec-complex',
      status: 'completed',
      result: {
        level1: {
          level2: {
            level3: {
              deepValue: 'found'
            }
          }
        },
        array: [
          { nested: { value: 1 } },
          { nested: { value: 2 } }
        ]
      }
    };

    render(<WorkflowExecutionResults result={complexResult} />);

    // Should show expandable sections for nested objects
    const objectButtons = screen.getAllByText(/properties/);
    expect(objectButtons.length).toBeGreaterThan(0);
  });

  it('shows no result data message when result is empty', () => {
    const emptyResult: WorkflowResult = {
      executionId: 'exec-empty',
      status: 'completed',
      result: null
    };

    render(<WorkflowExecutionResults result={emptyResult} />);

    expect(screen.getByText('No result data available')).toBeInTheDocument();
  });

  it('handles array of primitive values in table view', async () => {
    const primitiveArrayResult: WorkflowResult = {
      executionId: 'exec-primitive',
      status: 'completed',
      result: ['apple', 'banana', 'cherry']
    };

    render(<WorkflowExecutionResults result={primitiveArrayResult} />);

    // Switch to table format
    const formatSelect = screen.getByDisplayValue('JSON');
    fireEvent.change(formatSelect, { target: { value: 'table' } });
    
    await waitFor(() => {
      expect(screen.getByText('Index')).toBeInTheDocument();
      expect(screen.getByText('Value')).toBeInTheDocument();
      expect(screen.getByText('apple')).toBeInTheDocument();
      expect(screen.getByText('banana')).toBeInTheDocument();
    });
  });

  it('displays status colors correctly', () => {
    const { rerender } = render(<WorkflowExecutionResults result={mockSuccessResult} />);
    
    let statusElement = screen.getByText('COMPLETED');
    expect(statusElement).toHaveStyle('color: #28a745');
    
    rerender(<WorkflowExecutionResults result={mockFailedResult} />);
    statusElement = screen.getByText('FAILED');
    expect(statusElement).toHaveStyle('color: #dc3545');
    
    rerender(<WorkflowExecutionResults result={mockRunningResult} />);
    statusElement = screen.getByText('RUNNING');
    expect(statusElement).toHaveStyle('color: #007bff');
  });
});