import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useWorkflowList, useWorkflow, useWorkflowExecution, useParallelWorkflowData } from '../useWorkflowData';
import { difyApiClient } from '../../services/difyApiClient';
import { accessControlService } from '../../services/accessControlService';
import { useAuth } from '../../context/AuthContext';
import type { DifyWorkflow, WorkflowInput } from '../../types/dify';

// Mock dependencies
jest.mock('../../services/difyApiClient');
jest.mock('../../services/accessControlService');
jest.mock('../../context/AuthContext');

const mockDifyApiClient = difyApiClient as jest.Mocked<typeof difyApiClient>;
const mockAccessControlService = accessControlService as jest.Mocked<typeof accessControlService>;
const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

// Mock data
const mockUser = {
  id: 'user-1',
  email: 'test@example.com',
  name: 'Test User',
  provider: 'azure' as const,
  attributes: {
    domain: 'example.com',
    roles: ['user'],
  },
  permissions: [
    { resource: 'workflow', actions: ['read', 'execute'] }
  ],
};

const mockWorkflows: DifyWorkflow[] = [
  {
    id: 'workflow-1',
    name: 'Test Workflow 1',
    description: 'Test workflow description',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string' }
      },
      required: ['text']
    },
    outputSchema: {
      type: 'object',
      properties: {
        result: { type: 'string' }
      }
    },
    requiredPermissions: ['workflow:execute'],
  },
  {
    id: 'workflow-2',
    name: 'Test Workflow 2',
    description: 'Another test workflow',
    inputSchema: {
      type: 'object',
      properties: {
        data: { type: 'string' }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        output: { type: 'string' }
      }
    },
    requiredPermissions: ['workflow:execute'],
  },
];

describe('useWorkflowList', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuth.mockReturnValue({
      user: mockUser,
      isAuthenticated: true,
      isLoading: false,
      login: jest.fn(),
      logout: jest.fn(),
      refreshToken: jest.fn(),
      completeLogin: jest.fn(),
    });
  });

  it('should fetch workflows successfully', async () => {
    mockDifyApiClient.getWorkflows.mockResolvedValue(mockWorkflows);
    mockAccessControlService.checkAccess.mockReturnValue({ allowed: true });

    const { result } = renderHook(() => useWorkflowList());

    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBe(null);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toEqual(mockWorkflows);
    expect(result.current.error).toBe(null);
    expect(result.current.totalCount).toBe(2);
    expect(mockDifyApiClient.getWorkflows).toHaveBeenCalledWith(undefined);
  });

  it('should filter workflows based on user permissions', async () => {
    mockDifyApiClient.getWorkflows.mockResolvedValue(mockWorkflows);
    mockAccessControlService.checkAccess
      .mockReturnValueOnce({ allowed: true }) // read access for workflow-1
      .mockReturnValueOnce({ allowed: false }) // read access for workflow-2
      .mockReturnValueOnce({ allowed: true }) // execute access for workflow-1
      .mockReturnValueOnce({ allowed: false }); // execute access for workflow-2

    const { result } = renderHook(() => useWorkflowList());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toHaveLength(1);
    expect(result.current.data?.[0].id).toBe('workflow-1');
    expect(result.current.filteredWorkflows).toHaveLength(1);
    expect(result.current.filteredWorkflows[0].id).toBe('workflow-1');
  });

  it('should handle API errors', async () => {
    const errorMessage = 'Failed to fetch workflows';
    mockDifyApiClient.getWorkflows.mockRejectedValue(new Error(errorMessage));

    const { result } = renderHook(() => useWorkflowList());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe(errorMessage);
    expect(result.current.data).toBe(null);
  });

  it('should handle unauthenticated user', async () => {
    mockUseAuth.mockReturnValue({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      login: jest.fn(),
      logout: jest.fn(),
      refreshToken: jest.fn(),
      completeLogin: jest.fn(),
    });

    const { result } = renderHook(() => useWorkflowList());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe('User not authenticated');
    expect(mockDifyApiClient.getWorkflows).not.toHaveBeenCalled();
  });

  it('should support refetch functionality', async () => {
    mockDifyApiClient.getWorkflows.mockResolvedValue(mockWorkflows);
    mockAccessControlService.checkAccess.mockReturnValue({ allowed: true });

    const { result } = renderHook(() => useWorkflowList());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockDifyApiClient.getWorkflows).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.refetch();
    });

    expect(mockDifyApiClient.getWorkflows).toHaveBeenCalledTimes(2);
  });
});

describe('useWorkflow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuth.mockReturnValue({
      user: mockUser,
      isAuthenticated: true,
      isLoading: false,
      login: jest.fn(),
      logout: jest.fn(),
      refreshToken: jest.fn(),
      completeLogin: jest.fn(),
    });
  });

  it('should fetch single workflow successfully', async () => {
    const workflowId = 'workflow-1';
    mockAccessControlService.checkAccess.mockReturnValue({ allowed: true });
    mockDifyApiClient.getWorkflowMetadata.mockResolvedValue(mockWorkflows[0]);

    const { result } = renderHook(() => useWorkflow(workflowId));

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toEqual(mockWorkflows[0]);
    expect(result.current.error).toBe(null);
    expect(result.current.canExecute).toBe(true);
    expect(mockDifyApiClient.getWorkflowMetadata).toHaveBeenCalledWith(workflowId);
  });

  it('should handle access denied', async () => {
    const workflowId = 'workflow-1';
    mockAccessControlService.checkAccess.mockReturnValue({ 
      allowed: false, 
      reason: 'Insufficient permissions' 
    });

    const { result } = renderHook(() => useWorkflow(workflowId));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe('Access denied: Insufficient permissions');
    expect(result.current.data).toBe(null);
    expect(mockDifyApiClient.getWorkflowMetadata).not.toHaveBeenCalled();
  });

  it('should handle missing workflow ID', async () => {
    const { result } = renderHook(() => useWorkflow(''));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe('Workflow ID is required');
    expect(mockDifyApiClient.getWorkflowMetadata).not.toHaveBeenCalled();
  });
});

describe('useWorkflowExecution', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuth.mockReturnValue({
      user: mockUser,
      isAuthenticated: true,
      isLoading: false,
      login: jest.fn(),
      logout: jest.fn(),
      refreshToken: jest.fn(),
      completeLogin: jest.fn(),
    });
  });

  it('should execute workflow successfully', async () => {
    const workflowId = 'workflow-1';
    const input: WorkflowInput = { text: 'test input' };
    const executionResult = {
      executionId: 'exec-1',
      status: 'completed' as const,
      result: { output: 'test output' },
    };

    mockAccessControlService.checkAccess.mockReturnValue({ allowed: true });
    mockDifyApiClient.executeWorkflow.mockResolvedValue(executionResult);
    mockDifyApiClient.getWorkflowStatus.mockResolvedValue(executionResult);

    // Mock timers to control the progress monitoring interval
    jest.useFakeTimers();

    const { result } = renderHook(() => useWorkflowExecution(workflowId));

    expect(result.current.isExecuting).toBe(false);
    expect(result.current.result).toBe(null);

    let execResult: any;
    await act(async () => {
      execResult = await result.current.execute(input);
      // Fast-forward timers to trigger progress monitoring
      jest.advanceTimersByTime(2000);
    });

    expect(execResult).toEqual(executionResult);
    expect(mockDifyApiClient.executeWorkflow).toHaveBeenCalledWith(
      workflowId,
      input,
      mockUser.id
    );

    // Clean up timers
    jest.useRealTimers();
  });

  it('should handle execution access denied', async () => {
    const workflowId = 'workflow-1';
    const input: WorkflowInput = { text: 'test input' };

    mockAccessControlService.checkAccess.mockReturnValue({ 
      allowed: false, 
      reason: 'Insufficient permissions' 
    });

    const { result } = renderHook(() => useWorkflowExecution(workflowId));

    await act(async () => {
      const execResult = await result.current.execute(input);
      expect(execResult).toBe(null);
    });

    expect(result.current.error).toBe('Access denied: Insufficient permissions');
    expect(mockDifyApiClient.executeWorkflow).not.toHaveBeenCalled();
  });

  it('should handle unauthenticated execution', async () => {
    mockUseAuth.mockReturnValue({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      login: jest.fn(),
      logout: jest.fn(),
      refreshToken: jest.fn(),
      completeLogin: jest.fn(),
    });

    const workflowId = 'workflow-1';
    const input: WorkflowInput = { text: 'test input' };

    const { result } = renderHook(() => useWorkflowExecution(workflowId));

    await act(async () => {
      const execResult = await result.current.execute(input);
      expect(execResult).toBe(null);
    });

    expect(result.current.error).toBe('User not authenticated');
  });

  it('should support cancellation', async () => {
    const workflowId = 'workflow-1';
    const executionId = 'exec-1';

    mockAccessControlService.checkAccess.mockReturnValue({ allowed: true });
    mockDifyApiClient.executeWorkflow.mockResolvedValue({
      executionId,
      status: 'running',
    });
    mockDifyApiClient.cancelWorkflowExecution.mockResolvedValue(true);

    const { result } = renderHook(() => useWorkflowExecution(workflowId));

    // Start execution
    await act(async () => {
      await result.current.execute({ text: 'test' });
    });

    // Cancel execution
    await act(async () => {
      const cancelled = await result.current.cancel();
      expect(cancelled).toBe(true);
    });

    expect(mockDifyApiClient.cancelWorkflowExecution).toHaveBeenCalledWith(executionId);
  });

  it('should support reset functionality', async () => {
    const workflowId = 'workflow-1';

    const { result } = renderHook(() => useWorkflowExecution(workflowId));

    // Set some state
    act(() => {
      result.current.reset();
    });

    expect(result.current.isExecuting).toBe(false);
    expect(result.current.result).toBe(null);
    expect(result.current.error).toBe(null);
    expect(result.current.progress).toBe(0);
  });
});

describe('useParallelWorkflowData', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuth.mockReturnValue({
      user: mockUser,
      isAuthenticated: true,
      isLoading: false,
      login: jest.fn(),
      logout: jest.fn(),
      refreshToken: jest.fn(),
      completeLogin: jest.fn(),
    });
  });

  it('should load workflow data in parallel', async () => {
    const workflowId = 'workflow-1';
    
    mockDifyApiClient.getWorkflows.mockResolvedValue(mockWorkflows);
    mockDifyApiClient.getWorkflowMetadata.mockResolvedValue(mockWorkflows[0]);
    mockAccessControlService.checkAccess.mockReturnValue({ allowed: true });

    const { result } = renderHook(() => useParallelWorkflowData(workflowId));

    expect(result.current.isLoading).toBe(true);
    expect(result.current.isReady).toBe(false);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isReady).toBe(true);
    expect(result.current.workflow.data).toEqual(mockWorkflows[0]);
    expect(result.current.workflowList.data).toEqual(mockWorkflows);
    expect(result.current.error).toBe(null);
  });

  it('should handle combined errors', async () => {
    const workflowId = 'workflow-1';
    const errorMessage = 'Failed to load data';
    
    mockDifyApiClient.getWorkflows.mockRejectedValue(new Error(errorMessage));
    mockDifyApiClient.getWorkflowMetadata.mockRejectedValue(new Error(errorMessage));

    const { result } = renderHook(() => useParallelWorkflowData(workflowId));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBe(errorMessage);
    expect(result.current.isReady).toBe(false);
  });

  it('should support refetching all data', async () => {
    const workflowId = 'workflow-1';
    
    mockDifyApiClient.getWorkflows.mockResolvedValue(mockWorkflows);
    mockDifyApiClient.getWorkflowMetadata.mockResolvedValue(mockWorkflows[0]);
    mockAccessControlService.checkAccess.mockReturnValue({ allowed: true });

    const { result } = renderHook(() => useParallelWorkflowData(workflowId));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockDifyApiClient.getWorkflows).toHaveBeenCalledTimes(1);
    expect(mockDifyApiClient.getWorkflowMetadata).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.refetchAll();
    });

    expect(mockDifyApiClient.getWorkflows).toHaveBeenCalledTimes(2);
    expect(mockDifyApiClient.getWorkflowMetadata).toHaveBeenCalledTimes(2);
  });
});