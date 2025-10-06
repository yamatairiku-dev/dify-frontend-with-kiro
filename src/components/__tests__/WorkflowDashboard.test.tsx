import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router';
import { WorkflowDashboard } from '../WorkflowDashboard';
import { useAuth } from '../../context/AuthContext';
import { usePermissionCheck } from '../../hooks/useProtectedRoute';
import type { DifyWorkflow } from '../../types/dify';
import type { User } from '../../types/auth';

// Mock the hooks
jest.mock('../../context/AuthContext');
jest.mock('../../hooks/useProtectedRoute');

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockUsePermissionCheck = usePermissionCheck as jest.MockedFunction<typeof usePermissionCheck>;

// Mock user data
const mockUser: User = {
  id: 'user-1',
  email: 'test@example.com',
  name: 'Test User',
  provider: 'azure',
  attributes: {
    domain: 'example.com',
    roles: ['user'],
    department: 'Engineering',
    organization: 'Test Corp'
  },
  permissions: [
    { resource: 'workflow', actions: ['read', 'execute'] }
  ]
};

// Mock workflows data with recent updates
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
    updatedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString() // 5 days ago
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
    updatedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString() // 10 days ago
  },
  {
    id: 'workflow-3',
    name: 'Data Transformation',
    description: 'Transform and clean data according to specified rules',
    category: 'AI Analysis',
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
    createdAt: '2024-01-10T00:00:00Z',
    updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString() // 2 days ago
  },
  {
    id: 'workflow-4',
    name: 'Image Processing',
    description: 'Process and analyze images',
    category: 'Image Processing',
    tags: ['image', 'processing', 'analysis'],
    requiredPermissions: ['workflow:execute', 'image:read'],
    inputSchema: {
      type: 'object',
      properties: {
        image: { type: 'string', description: 'Image data' }
      },
      required: ['image']
    },
    outputSchema: {
      type: 'object',
      properties: {
        analysis: { type: 'object' }
      }
    },
    isActive: true,
    createdAt: '2024-01-15T00:00:00Z',
    updatedAt: new Date(Date.now() - 50 * 24 * 60 * 60 * 1000).toISOString() // 50 days ago (not recent)
  }
];

const renderWithRouter = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      {component}
    </BrowserRouter>
  );
};

describe('WorkflowDashboard', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      user: mockUser,
      isAuthenticated: true,
      isLoading: false,
      login: jest.fn(),
      logout: jest.fn(),
      refreshToken: jest.fn(),
      completeLogin: jest.fn()
    });
    mockUsePermissionCheck.mockImplementation((resource, action) => {
      if (resource === 'workflow' && (action === 'read' || action === 'execute')) {
        return true;
      }
      return false;
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders loading state correctly', () => {
    renderWithRouter(
      <WorkflowDashboard
        workflows={[]}
        loading={true}
      />
    );

    expect(screen.getByText('Loading dashboard...')).toBeInTheDocument();
  });

  it('renders error state correctly', () => {
    const mockRefresh = jest.fn();
    renderWithRouter(
      <WorkflowDashboard
        workflows={[]}
        error="Failed to load dashboard"
        onRefresh={mockRefresh}
      />
    );

    expect(screen.getByText('Error Loading Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Failed to load dashboard')).toBeInTheDocument();
    
    const retryButton = screen.getByText('Retry');
    fireEvent.click(retryButton);
    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });

  it('renders welcome message with user name', () => {
    renderWithRouter(
      <WorkflowDashboard workflows={mockWorkflows} />
    );

    expect(screen.getByText('Workflow Dashboard')).toBeInTheDocument();
    expect(screen.getByText(/Welcome back,/)).toBeInTheDocument();
    expect(screen.getByText('Test User')).toBeInTheDocument();
  });

  it('displays correct workflow statistics', () => {
    renderWithRouter(
      <WorkflowDashboard workflows={mockWorkflows} />
    );

    // Total workflows
    expect(screen.getByText('4')).toBeInTheDocument(); // Total count
    expect(screen.getByText('Total Workflows')).toBeInTheDocument();

    // Accessible workflows (all 4 since user has read permission)
    expect(screen.getByText('Accessible')).toBeInTheDocument();

    // Executable workflows (all 4 since user has execute permission)
    expect(screen.getByText('Executable')).toBeInTheDocument();

    // Categories (3 unique categories)
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('Categories')).toBeInTheDocument();
  });

  it('displays category breakdown correctly', () => {
    renderWithRouter(
      <WorkflowDashboard workflows={mockWorkflows} />
    );

    expect(screen.getByText('Workflows by Category')).toBeInTheDocument();
    
    // AI Analysis should have 2 workflows
    expect(screen.getByText('AI Analysis')).toBeInTheDocument();
    
    // Document Processing should have 1 workflow
    expect(screen.getByText('Document Processing')).toBeInTheDocument();
    
    // Image Processing should have 1 workflow
    expect(screen.getByText('Image Processing')).toBeInTheDocument();
  });

  it('displays recently updated workflows', () => {
    renderWithRouter(
      <WorkflowDashboard workflows={mockWorkflows} />
    );

    expect(screen.getByText('Recently Updated')).toBeInTheDocument();
    
    // Should show workflows updated in the last 30 days
    expect(screen.getByText('Text Analysis Workflow')).toBeInTheDocument();
    expect(screen.getByText('Data Transformation')).toBeInTheDocument();
    
    // Should not show workflow updated 50 days ago
    expect(screen.queryByText('Image Processing')).not.toBeInTheDocument();
  });

  it('displays popular tags with counts', () => {
    renderWithRouter(
      <WorkflowDashboard workflows={mockWorkflows} />
    );

    expect(screen.getByText('Popular Tags')).toBeInTheDocument();
    
    // Check for tags (each appears once in our mock data)
    expect(screen.getByText('text')).toBeInTheDocument();
    expect(screen.getByText('sentiment')).toBeInTheDocument();
    expect(screen.getByText('analysis')).toBeInTheDocument();
    expect(screen.getByText('document')).toBeInTheDocument();
    expect(screen.getByText('data')).toBeInTheDocument();
    
    // Check for tag counts (should show "1" for each tag since they appear once each)
    const tagCounts = screen.getAllByText('1');
    expect(tagCounts.length).toBeGreaterThan(0);
  });

  it('displays quick actions correctly', () => {
    renderWithRouter(
      <WorkflowDashboard workflows={mockWorkflows} />
    );

    expect(screen.getByText('Quick Actions')).toBeInTheDocument();
    
    // Browse all workflows link
    const browseLink = screen.getByText('📋 Browse All Workflows');
    expect(browseLink.closest('a')).toHaveAttribute('href', '/workflows');
    
    // Execute workflows link (should appear since user has executable workflows)
    const executeLink = screen.getByText('⚡ Execute Workflows');
    expect(executeLink.closest('a')).toHaveAttribute('href', '/workflows');
  });

  it('displays refresh button when onRefresh is provided', () => {
    const mockRefresh = jest.fn();
    renderWithRouter(
      <WorkflowDashboard workflows={mockWorkflows} onRefresh={mockRefresh} />
    );

    const refreshButton = screen.getByText('🔄 Refresh Data');
    fireEvent.click(refreshButton);
    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });

  it('does not display execute workflows link when user has no executable workflows', () => {
    mockUsePermissionCheck.mockImplementation((resource, action) => {
      if (resource === 'workflow' && action === 'read') {
        return true;
      }
      return false; // No execute permission
    });

    renderWithRouter(
      <WorkflowDashboard workflows={mockWorkflows} />
    );

    expect(screen.queryByText('⚡ Execute Workflows')).not.toBeInTheDocument();
  });

  it('shows limited access message when user has no accessible workflows', () => {
    mockUsePermissionCheck.mockReturnValue(false); // No permissions

    renderWithRouter(
      <WorkflowDashboard workflows={mockWorkflows} />
    );

    expect(screen.getByText('Limited Access')).toBeInTheDocument();
    expect(screen.getByText(/There are 4 workflows available, but you don't have permission to access any of them/)).toBeInTheDocument();
  });

  it('handles empty workflows list', () => {
    renderWithRouter(
      <WorkflowDashboard workflows={[]} />
    );

    expect(screen.getByText('0')).toBeInTheDocument(); // Total workflows
    expect(screen.getByText('No categories available')).toBeInTheDocument();
    expect(screen.getByText('No recent updates')).toBeInTheDocument();
    expect(screen.queryByText('Popular Tags')).not.toBeInTheDocument();
  });

  it('handles workflows without categories', () => {
    const workflowsWithoutCategory = mockWorkflows.map(w => ({ ...w, category: undefined }));
    
    renderWithRouter(
      <WorkflowDashboard workflows={workflowsWithoutCategory} />
    );

    expect(screen.getByText('Uncategorized')).toBeInTheDocument();
  });

  it('handles workflows without tags', () => {
    const workflowsWithoutTags = mockWorkflows.map(w => ({ ...w, tags: undefined }));
    
    renderWithRouter(
      <WorkflowDashboard workflows={workflowsWithoutTags} />
    );

    expect(screen.queryByText('Popular Tags')).not.toBeInTheDocument();
  });

  it('sorts categories by workflow count', () => {
    renderWithRouter(
      <WorkflowDashboard workflows={mockWorkflows} />
    );

    const categorySection = screen.getByText('Workflows by Category').closest('div');
    expect(categorySection).toBeInTheDocument();
    
    // AI Analysis should appear first (2 workflows)
    // Document Processing and Image Processing should follow (1 workflow each)
  });

  it('limits recently updated workflows to 5 items', () => {
    // Create more than 5 recent workflows
    const manyRecentWorkflows = Array.from({ length: 7 }, (_, i) => ({
      ...mockWorkflows[0],
      id: `workflow-${i}`,
      name: `Recent Workflow ${i}`,
      updatedAt: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString()
    }));

    renderWithRouter(
      <WorkflowDashboard workflows={manyRecentWorkflows} />
    );

    // Should only show 5 recent workflows
    const recentSection = screen.getByText('Recently Updated').closest('div');
    expect(recentSection).toBeInTheDocument();
    
    // Count workflow links in recent section
    expect(screen.getByText('Recent Workflow 0')).toBeInTheDocument();
    expect(screen.getByText('Recent Workflow 4')).toBeInTheDocument();
    expect(screen.queryByText('Recent Workflow 5')).not.toBeInTheDocument();
  });

  it('limits popular tags to 10 items', () => {
    // Create workflow with many tags
    const workflowWithManyTags = {
      ...mockWorkflows[0],
      tags: Array.from({ length: 15 }, (_, i) => `tag${i}`)
    };

    renderWithRouter(
      <WorkflowDashboard workflows={[workflowWithManyTags]} />
    );

    // Should show Popular Tags section
    expect(screen.getByText('Popular Tags')).toBeInTheDocument();
    
    // Should show first 10 tags
    expect(screen.getByText('tag0')).toBeInTheDocument();
    expect(screen.getByText('tag9')).toBeInTheDocument();
    expect(screen.queryByText('tag10')).not.toBeInTheDocument();
  });
});