import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router';
import { WorkflowList } from '../WorkflowList';
import { usePermissionCheck } from '../../hooks/useProtectedRoute';
import type { DifyWorkflow } from '../../types/dify';

// Mock the hooks
jest.mock('../../hooks/useProtectedRoute');

const mockUsePermissionCheck = usePermissionCheck as jest.MockedFunction<typeof usePermissionCheck>;

// Mock workflows data
const mockWorkflows: DifyWorkflow[] = [
  {
    id: 'workflow-1',
    name: 'Text Analysis Workflow',
    description: 'Analyze text content for sentiment and key topics',
    category: 'AI Analysis',
    tags: ['text', 'sentiment', 'analysis'],
    requiredPermissions: ['workflow:execute'],
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Text to analyze' }
      },
      required: ['text']
    },
    outputSchema: {
      type: 'object',
      properties: {
        sentiment: { type: 'string' },
        topics: { type: 'array', items: { type: 'string' } }
      }
    },
    isActive: true,
    version: '1.0.0',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-15T00:00:00Z'
  },
  {
    id: 'workflow-2',
    name: 'Document Processing',
    description: 'Process and extract information from documents',
    category: 'Document Processing',
    tags: ['document', 'extraction', 'processing'],
    requiredPermissions: ['workflow:execute', 'document:read'],
    inputSchema: {
      type: 'object',
      properties: {
        document: { type: 'string', description: 'Document content' }
      },
      required: ['document']
    },
    outputSchema: {
      type: 'object',
      properties: {
        extractedData: { type: 'object' }
      }
    },
    isActive: false,
    version: '2.1.0',
    createdAt: '2024-01-05T00:00:00Z',
    updatedAt: '2024-01-20T00:00:00Z'
  },
  {
    id: 'workflow-3',
    name: 'Data Transformation',
    description: 'Transform and clean data according to specified rules',
    category: 'Data Processing',
    tags: ['data', 'transformation', 'cleaning'],
    requiredPermissions: ['workflow:execute'],
    inputSchema: {
      type: 'object',
      properties: {
        data: { type: 'array', description: 'Data to transform' }
      },
      required: ['data']
    },
    outputSchema: {
      type: 'object',
      properties: {
        transformedData: { type: 'array' }
      }
    },
    isActive: true,
    createdAt: '2024-01-10T00:00:00Z'
  }
];

const renderWithRouter = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      {component}
    </BrowserRouter>
  );
};

describe('WorkflowList', () => {
  beforeEach(() => {
    mockUsePermissionCheck.mockReturnValue(true);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders loading state correctly', () => {
    renderWithRouter(
      <WorkflowList
        workflows={[]}
        loading={true}
      />
    );

    expect(screen.getByText('Loading workflows...')).toBeInTheDocument();
  });

  it('renders error state correctly', () => {
    const mockRefresh = jest.fn();
    renderWithRouter(
      <WorkflowList
        workflows={[]}
        error="Failed to load workflows"
        onRefresh={mockRefresh}
      />
    );

    expect(screen.getByText('Error Loading Workflows')).toBeInTheDocument();
    expect(screen.getByText('Failed to load workflows')).toBeInTheDocument();
    
    const retryButton = screen.getByText('Retry');
    fireEvent.click(retryButton);
    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });

  it('renders workflows correctly', () => {
    renderWithRouter(
      <WorkflowList workflows={mockWorkflows} />
    );

    expect(screen.getByText('Text Analysis Workflow')).toBeInTheDocument();
    expect(screen.getByText('Document Processing')).toBeInTheDocument();
    expect(screen.getByText('Data Transformation')).toBeInTheDocument();
  });

  it('shows workflow metadata correctly', () => {
    renderWithRouter(
      <WorkflowList workflows={mockWorkflows} />
    );

    // Check categories
    expect(screen.getByText('AI Analysis')).toBeInTheDocument();
    expect(screen.getByText('Document Processing')).toBeInTheDocument();
    expect(screen.getByText('Data Processing')).toBeInTheDocument();

    // Check tags
    expect(screen.getByText('text')).toBeInTheDocument();
    expect(screen.getByText('sentiment')).toBeInTheDocument();
    expect(screen.getByText('document')).toBeInTheDocument();

    // Check versions
    expect(screen.getByText('v1.0.0')).toBeInTheDocument();
    expect(screen.getByText('v2.1.0')).toBeInTheDocument();

    // Check status
    expect(screen.getAllByText('Active')).toHaveLength(2);
    expect(screen.getByText('Inactive')).toBeInTheDocument();
  });

  it('filters workflows by search term', async () => {
    renderWithRouter(
      <WorkflowList workflows={mockWorkflows} showSearch={true} />
    );

    const searchInput = screen.getByPlaceholderText('Search by name, description, or tags...');
    fireEvent.change(searchInput, { target: { value: 'text' } });

    await waitFor(() => {
      expect(screen.getByText('Text Analysis Workflow')).toBeInTheDocument();
      expect(screen.queryByText('Document Processing')).not.toBeInTheDocument();
    });
  });

  it('filters workflows by category', async () => {
    renderWithRouter(
      <WorkflowList workflows={mockWorkflows} showFilters={true} />
    );

    const categorySelect = screen.getByDisplayValue('All Categories');
    fireEvent.change(categorySelect, { target: { value: 'AI Analysis' } });

    await waitFor(() => {
      expect(screen.getByText('Text Analysis Workflow')).toBeInTheDocument();
      expect(screen.queryByText('Document Processing')).not.toBeInTheDocument();
      expect(screen.queryByText('Data Transformation')).not.toBeInTheDocument();
    });
  });

  it('filters workflows by status', async () => {
    renderWithRouter(
      <WorkflowList workflows={mockWorkflows} showFilters={true} />
    );

    const statusSelect = screen.getByDisplayValue('All Status');
    fireEvent.change(statusSelect, { target: { value: 'inactive' } });

    await waitFor(() => {
      // Should show only inactive workflows
      expect(screen.getByText('Showing 1 of 3 workflows')).toBeInTheDocument();
      expect(screen.getByText('(filtered)')).toBeInTheDocument();
    });
  });

  it('filters workflows by tags', async () => {
    renderWithRouter(
      <WorkflowList workflows={mockWorkflows} showFilters={true} />
    );

    // Find the tag button in the filter section (not in workflow cards)
    const tagButtons = screen.getAllByText('text');
    const filterTagButton = tagButtons.find(button => 
      button.tagName === 'BUTTON' && 
      button.style.backgroundColor === 'white'
    );
    
    expect(filterTagButton).toBeInTheDocument();
    fireEvent.click(filterTagButton!);

    await waitFor(() => {
      // Should show filtered results
      expect(screen.getByText('(filtered)')).toBeInTheDocument();
    });
  });

  it('sorts workflows correctly', async () => {
    renderWithRouter(
      <WorkflowList workflows={mockWorkflows} showFilters={true} />
    );

    const sortSelect = screen.getByDisplayValue('Name');
    fireEvent.change(sortSelect, { target: { value: 'category' } });

    const sortOrderSelect = screen.getByDisplayValue('↑ Asc');
    fireEvent.change(sortOrderSelect, { target: { value: 'desc' } });

    // Verify sorting is applied (workflows should be reordered)
    await waitFor(() => {
      const workflowElements = screen.getAllByRole('heading', { level: 3 });
      // With desc order by category: Data Processing should come first
      expect(workflowElements[0]).toHaveTextContent('Document Processing');
    });
  });

  it('clears all filters', async () => {
    renderWithRouter(
      <WorkflowList workflows={mockWorkflows} showSearch={true} showFilters={true} />
    );

    // Apply some filters
    const searchInput = screen.getByPlaceholderText('Search by name, description, or tags...');
    fireEvent.change(searchInput, { target: { value: 'text' } });

    const categorySelect = screen.getByDisplayValue('All Categories');
    fireEvent.change(categorySelect, { target: { value: 'AI Analysis' } });

    // Clear filters
    const clearButton = screen.getByText('Clear All Filters');
    fireEvent.click(clearButton);

    await waitFor(() => {
      expect(searchInput).toHaveValue('');
      expect(categorySelect).toHaveValue('');
      expect(screen.getByText('Showing 3 of 3 workflows')).toBeInTheDocument();
    });
  });

  it('shows access denied for workflows without permission', () => {
    mockUsePermissionCheck.mockReturnValue(false);

    renderWithRouter(
      <WorkflowList workflows={mockWorkflows} />
    );

    const accessDeniedElements = screen.getAllByText('Access Denied');
    expect(accessDeniedElements).toHaveLength(3);
  });

  it('shows execute workflow links for workflows with permission', () => {
    mockUsePermissionCheck.mockReturnValue(true);

    renderWithRouter(
      <WorkflowList workflows={mockWorkflows} />
    );

    const executeLinks = screen.getAllByText('Execute Workflow →');
    expect(executeLinks).toHaveLength(3);
    
    // Check that links have correct href (sorted by name by default)
    expect(executeLinks[0].closest('a')).toHaveAttribute('href', '/workflows/workflow-3'); // Data Transformation comes first alphabetically
  });

  it('shows results summary correctly', () => {
    renderWithRouter(
      <WorkflowList workflows={mockWorkflows} />
    );

    expect(screen.getByText('Showing 3 of 3 workflows')).toBeInTheDocument();
  });

  it('shows filtered results summary', async () => {
    renderWithRouter(
      <WorkflowList workflows={mockWorkflows} showSearch={true} />
    );

    const searchInput = screen.getByPlaceholderText('Search by name, description, or tags...');
    fireEvent.change(searchInput, { target: { value: 'text' } });

    await waitFor(() => {
      expect(screen.getByText('Showing 1 of 3 workflows')).toBeInTheDocument();
      expect(screen.getByText('(filtered)')).toBeInTheDocument();
    });
  });

  it('shows no workflows found message when no results', async () => {
    renderWithRouter(
      <WorkflowList workflows={mockWorkflows} showSearch={true} />
    );

    const searchInput = screen.getByPlaceholderText('Search by name, description, or tags...');
    fireEvent.change(searchInput, { target: { value: 'nonexistent' } });

    await waitFor(() => {
      expect(screen.getByText('No Workflows Found')).toBeInTheDocument();
      expect(screen.getByText('No workflows match your current filters. Try adjusting your search criteria.')).toBeInTheDocument();
    });
  });

  it('shows no workflows available message when empty list', () => {
    renderWithRouter(
      <WorkflowList workflows={[]} />
    );

    expect(screen.getByText('No Workflows Found')).toBeInTheDocument();
    expect(screen.getByText('There are no workflows available for your current permissions.')).toBeInTheDocument();
  });

  it('handles hover effects on workflow cards', () => {
    mockUsePermissionCheck.mockReturnValue(true);

    renderWithRouter(
      <WorkflowList workflows={[mockWorkflows[0]]} />
    );

    const workflowHeading = screen.getByText('Text Analysis Workflow');
    const workflowCard = workflowHeading.closest('div');
    expect(workflowCard).toBeInTheDocument();

    // Test hover effect (this is a basic test since we can't easily test CSS transforms)
    fireEvent.mouseEnter(workflowCard!);
    fireEvent.mouseLeave(workflowCard!);
  });

  it('displays workflow permissions correctly', () => {
    renderWithRouter(
      <WorkflowList workflows={mockWorkflows} />
    );

    // Check that permissions are displayed (multiple instances expected)
    expect(screen.getAllByText('workflow:execute').length).toBeGreaterThan(0);
    expect(screen.getByText('workflow:execute, document:read')).toBeInTheDocument();
  });

  it('displays creation and update dates', () => {
    renderWithRouter(
      <WorkflowList workflows={mockWorkflows} />
    );

    // Check that dates are displayed (exact format may vary by locale)
    expect(screen.getAllByText(/Created:/)).toHaveLength(3);
    expect(screen.getAllByText(/Updated:/)).toHaveLength(2); // Only 2 workflows have updatedAt
  });
});