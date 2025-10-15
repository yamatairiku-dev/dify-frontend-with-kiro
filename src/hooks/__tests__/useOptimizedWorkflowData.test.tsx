import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useOptimizedWorkflowList, useOptimizedWorkflow } from '../useOptimizedWorkflowData';
import { AuthProvider } from '../../context/AuthContext';
import type { User } from '../../types/auth';

// Mock the services
jest.mock('../../services/difyApiClient', () => ({
  difyApiClient: {
    getWorkflows: jest.fn(),
    getWorkflowMetadata: jest.fn(),
  },
}));

jest.mock('../../services/accessControlService', () => ({
  accessControlService: {
    checkAccess: jest.fn(),
  },
}));

// Mock user for testing
const mockUser: User = {
  id: 'test-user',
  email: 'test@example.com',
  name: 'Test User',
  provider: 'azure',
  attributes: {
    domain: 'example.com',
    roles: ['user'],
  },
  permissions: [
    {
      resource: 'workflow',
      actions: ['read', 'execute'],
      conditions: [],
    },
  ],
};

// Test component for useOptimizedWorkflowList
const WorkflowListTestComponent: React.FC = () => {
  const { data, isLoading, error } = useOptimizedWorkflowList();
  
  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;
  
  return (
    <div>
      <div data-testid="workflow-count">{data?.length || 0}</div>
      {data?.map(workflow => (
        <div key={workflow.id} data-testid={`workflow-${workflow.id}`}>
          {workflow.name}
        </div>
      ))}
    </div>
  );
};

// Test component for useOptimizedWorkflow
const WorkflowDetailTestComponent: React.FC<{ workflowId: string }> = ({ workflowId }) => {
  const { data, isLoading, error } = useOptimizedWorkflow(workflowId);
  
  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;
  
  return (
    <div>
      <div data-testid="workflow-name">{data?.name}</div>
      <div data-testid="workflow-description">{data?.description}</div>
    </div>
  );
};

// Test wrapper with providers
const TestWrapper: React.FC<{ children: React.ReactNode; user?: User | null }> = ({ 
  children, 
  user = mockUser 
}) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        {/* Mock the auth context */}
        <div data-testid="auth-user" style={{ display: 'none' }}>
          {JSON.stringify(user)}
        </div>
        {children}
      </AuthProvider>
    </QueryClientProvider>
  );
};

describe('useOptimizedWorkflowData', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('useOptimizedWorkflowList', () => {
    it('should render loading state initially', () => {
      render(
        <TestWrapper>
          <WorkflowListTestComponent />
        </TestWrapper>
      );

      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });

    it('should handle empty workflow list', async () => {
      const { difyApiClient } = require('../../services/difyApiClient');
      const { accessControlService } = require('../../services/accessControlService');
      
      difyApiClient.getWorkflows.mockResolvedValue([]);
      accessControlService.checkAccess.mockReturnValue({ allowed: true });

      render(
        <TestWrapper>
          <WorkflowListTestComponent />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('workflow-count')).toHaveTextContent('0');
      });
    });
  });

  describe('useOptimizedWorkflow', () => {
    it('should render loading state initially', () => {
      render(
        <TestWrapper>
          <WorkflowDetailTestComponent workflowId="test-workflow" />
        </TestWrapper>
      );

      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });

    it('should handle workflow not found', async () => {
      const { difyApiClient } = require('../../services/difyApiClient');
      
      difyApiClient.getWorkflowMetadata.mockRejectedValue(new Error('Workflow not found'));

      render(
        <TestWrapper>
          <WorkflowDetailTestComponent workflowId="non-existent" />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Error: Workflow not found')).toBeInTheDocument();
      });
    });
  });

  describe('React Query integration', () => {
    it('should use React Query for caching', async () => {
      const { difyApiClient } = require('../../services/difyApiClient');
      const { accessControlService } = require('../../services/accessControlService');
      
      const mockWorkflows = [
        {
          id: 'workflow-1',
          name: 'Test Workflow',
          description: 'Test Description',
          inputSchema: { type: 'object', properties: {} },
          outputSchema: { type: 'object', properties: {} },
          requiredPermissions: ['workflow:read'],
        },
      ];

      difyApiClient.getWorkflows.mockResolvedValue(mockWorkflows);
      accessControlService.checkAccess.mockReturnValue({ allowed: true });

      const { rerender } = render(
        <TestWrapper>
          <WorkflowListTestComponent />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('workflow-count')).toHaveTextContent('1');
      });

      // Re-render should use cached data
      rerender(
        <TestWrapper>
          <WorkflowListTestComponent />
        </TestWrapper>
      );

      // Should still show the data without additional API calls
      expect(screen.getByTestId('workflow-count')).toHaveTextContent('1');
      expect(difyApiClient.getWorkflows).toHaveBeenCalledTimes(1);
    });
  });

  describe('Permission filtering', () => {
    it('should filter workflows based on user permissions', async () => {
      const { difyApiClient } = require('../../services/difyApiClient');
      const { accessControlService } = require('../../services/accessControlService');
      
      const mockWorkflows = [
        {
          id: 'workflow-1',
          name: 'Allowed Workflow',
          description: 'User can access this',
          inputSchema: { type: 'object', properties: {} },
          outputSchema: { type: 'object', properties: {} },
          requiredPermissions: ['workflow:read'],
        },
        {
          id: 'workflow-2',
          name: 'Restricted Workflow',
          description: 'User cannot access this',
          inputSchema: { type: 'object', properties: {} },
          outputSchema: { type: 'object', properties: {} },
          requiredPermissions: ['admin:read'],
        },
      ];

      difyApiClient.getWorkflows.mockResolvedValue(mockWorkflows);
      accessControlService.checkAccess.mockImplementation((user: any, resource: string) => ({
        allowed: resource === 'workflow:workflow-1',
      }));

      render(
        <TestWrapper>
          <WorkflowListTestComponent />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('workflow-count')).toHaveTextContent('1');
        expect(screen.getByTestId('workflow-workflow-1')).toBeInTheDocument();
        expect(screen.queryByTestId('workflow-workflow-2')).not.toBeInTheDocument();
      });
    });
  });
});