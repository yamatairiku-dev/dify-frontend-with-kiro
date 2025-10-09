/**
 * Integration tests for workflow execution end-to-end
 * Tests complete workflow execution flow from discovery to results
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router';
import { AuthProvider } from '../../context/AuthContext';
import { DifyApiClient } from '../../services/difyApiClient';
import { WorkflowExecutionService } from '../../services/workflowExecutionService';
import { AccessControlService } from '../../services/accessControlService';
import { useWorkflowData } from '../../hooks/useWorkflowData';
import { useWorkflowForm } from '../../hooks/useWorkflowForm';
import { WorkflowList } from '../../components/WorkflowList';
import { WorkflowDashboard } from '../../components/WorkflowDashboard';
import { WorkflowExecutionResults } from '../../components/WorkflowExecutionResults';
import { User, DifyWorkflow, WorkflowResult, WorkflowInput } from '../../types';

// Mock services
jest.mock('../../services/difyApiClient');
jest.mock('../../services/workflowExecutionService');
jest.mock('../../services/accessControlService');
jest.mock('../../services/tokenManager');

const mockDifyApiClient = DifyApiClient as jest.Mocked<typeof DifyApiClient>;
const mockWorkflowExecutionService = WorkflowExecutionService as jest.Mocked<typeof WorkflowExecutionService>;
const mockAccessControlService = AccessControlService as jest.Mocked<typeof AccessControlService>;

// Test user with workflow permissions
const testUser: User = {
  id: 'test-user-id',
  email: 'user@company.com',
  name: 'Test User',
  provider: 'azure',
  attributes: {
    domain: 'company.com',
    roles: ['user', 'developer'],
    department: 'Engineering'
  },
  permissions: [
    {
      resource: 'workflow',
      actions: ['read', 'execute'],
      conditions: []
    },
    {
      resource: 'workflow',
      actions: ['manage'],
      conditions: [
        {
          attribute: 'category',
          operator: 'equals',
          value: 'development'
        }
      ]
    }
  ]
};

// Test workflows
const testWorkflows: DifyWorkflow[] = [
  {
    id: 'text-analysis-workflow',
    name: 'Text Analysis',
    description: 'Analyze text sentiment and extract key information',
    inputSchema: {
      type: 'object',
      properties: {
        text: {
          type: 'string',
          description: 'Text to analyze',
          minLength: 1,
          maxLength: 5000
        },
        language: {
          type: 'string',
          enum: ['en', 'es', 'fr', 'de'],
          default: 'en',
          description: 'Language of the text'
        },
        includeEntities: {
          type: 'boolean',
          default: true,
          description: 'Extract named entities'
        }
      },
      required: ['text']
    },
    outputSchema: {
      type: 'object',
      properties: {
        sentiment: {
          type: 'object',
          properties: {
            score: { type: 'number' },
            label: { type: 'string' }
          }
        },
        entities: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              text: { type: 'string' },
              type: { type: 'string' },
              confidence: { type: 'number' }
            }
          }
        },
        keyPhrases: {
          type: 'array',
          items: { type: 'string' }
        }
      }
    },
    requiredPermissions: ['workflow:read', 'workflow:execute'],
    version: '1.0.0',
    tags: ['nlp', 'analysis'],
    category: 'text-processing',
    isActive: true,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-15T00:00:00Z'
  },
  {
    id: 'image-generation-workflow',
    name: 'Image Generation',
    description: 'Generate images from text descriptions',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: {
          type: 'string',
          description: 'Text description for image generation',
          minLength: 10,
          maxLength: 1000
        },
        style: {
          type: 'string',
          enum: ['realistic', 'artistic', 'cartoon', 'abstract'],
          default: 'realistic',
          description: 'Image style'
        },
        size: {
          type: 'string',
          enum: ['256x256', '512x512', '1024x1024'],
          default: '512x512',
          description: 'Image dimensions'
        },
        count: {
          type: 'integer',
          minimum: 1,
          maximum: 4,
          default: 1,
          description: 'Number of images to generate'
        }
      },
      required: ['prompt']
    },
    outputSchema: {
      type: 'object',
      properties: {
        images: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              url: { type: 'string' },
              width: { type: 'integer' },
              height: { type: 'integer' }
            }
          }
        },
        metadata: {
          type: 'object',
          properties: {
            model: { type: 'string' },
            processingTime: { type: 'number' }
          }
        }
      }
    },
    requiredPermissions: ['workflow:read', 'workflow:execute'],
    version: '2.1.0',
    tags: ['ai', 'image', 'generation'],
    category: 'creative',
    isActive: true,
    createdAt: '2024-01-10T00:00:00Z',
    updatedAt: '2024-01-20T00:00:00Z'
  },
  {
    id: 'data-processing-workflow',
    name: 'Data Processing Pipeline',
    description: 'Process and transform structured data',
    inputSchema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: true
          },
          description: 'Array of data objects to process'
        },
        operations: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['filter', 'transform', 'aggregate', 'sort']
          },
          description: 'Processing operations to apply'
        },
        outputFormat: {
          type: 'string',
          enum: ['json', 'csv', 'xml'],
          default: 'json',
          description: 'Output format'
        }
      },
      required: ['data', 'operations']
    },
    outputSchema: {
      type: 'object',
      properties: {
        processedData: {
          type: 'array',
          items: { type: 'object' }
        },
        statistics: {
          type: 'object',
          properties: {
            totalRecords: { type: 'integer' },
            processedRecords: { type: 'integer' },
            errors: { type: 'integer' }
          }
        }
      }
    },
    requiredPermissions: ['workflow:read', 'workflow:execute', 'workflow:manage'],
    version: '1.5.0',
    tags: ['data', 'processing', 'etl'],
    category: 'development',
    isActive: true,
    createdAt: '2024-01-05T00:00:00Z',
    updatedAt: '2024-01-25T00:00:00Z'
  }
];

// Test workflow results
const mockTextAnalysisResult: WorkflowResult = {
  executionId: 'exec-text-001',
  status: 'completed',
  result: {
    sentiment: {
      score: 0.8,
      label: 'positive'
    },
    entities: [
      {
        text: 'OpenAI',
        type: 'ORGANIZATION',
        confidence: 0.95
      },
      {
        text: 'artificial intelligence',
        type: 'TECHNOLOGY',
        confidence: 0.87
      }
    ],
    keyPhrases: [
      'machine learning',
      'natural language processing',
      'AI development'
    ]
  },
  startedAt: '2024-01-30T10:00:00Z',
  completedAt: '2024-01-30T10:00:15Z',
  duration: 15000
};

const mockImageGenerationResult: WorkflowResult = {
  executionId: 'exec-image-001',
  status: 'completed',
  result: {
    images: [
      {
        url: 'https://example.com/generated-image-1.jpg',
        width: 512,
        height: 512
      }
    ],
    metadata: {
      model: 'dall-e-3',
      processingTime: 8.5
    }
  },
  startedAt: '2024-01-30T10:05:00Z',
  completedAt: '2024-01-30T10:05:08Z',
  duration: 8500
};

// Test components
const WorkflowDiscoveryPage: React.FC = () => {
  const { workflows, isLoading, error, refetch } = useWorkflowData();

  if (isLoading) return <div>Loading workflows...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      <h1>Available Workflows</h1>
      <WorkflowDashboard />
      <WorkflowList 
        workflows={workflows}
        onWorkflowSelect={(workflow) => {
          window.location.href = `/workflows/${workflow.id}`;
        }}
      />
    </div>
  );
};

const WorkflowExecutionPage: React.FC<{ workflowId: string }> = ({ workflowId }) => {
  const { workflow, isLoading: workflowLoading } = useWorkflowData(workflowId);
  const {
    values,
    errors,
    isValid,
    isSubmitting,
    fields,
    setValue,
    handleSubmit,
    reset
  } = useWorkflowForm(workflow);

  const [executionResult, setExecutionResult] = React.useState<WorkflowResult | null>(null);
  const [executionError, setExecutionError] = React.useState<string | null>(null);

  const handleExecute = async () => {
    try {
      setExecutionError(null);
      const result = await handleSubmit(async (formValues) => {
        return await mockWorkflowExecutionService.executeWorkflow(workflowId, formValues);
      });
      setExecutionResult(result);
    } catch (error) {
      setExecutionError(error instanceof Error ? error.message : 'Execution failed');
    }
  };

  if (workflowLoading) return <div>Loading workflow...</div>;
  if (!workflow) return <div>Workflow not found</div>;

  return (
    <div>
      <h1>Execute: {workflow.name}</h1>
      <p>{workflow.description}</p>
      
      <div data-testid="workflow-form">
        {fields.map((field) => (
          <div key={field.name} className="form-field">
            <label htmlFor={field.name}>{field.label}</label>
            {field.type === 'string' && (
              <input
                id={field.name}
                type="text"
                value={values[field.name] || ''}
                onChange={(e) => setValue(field.name, e.target.value)}
                placeholder={field.description}
                required={field.required}
              />
            )}
            {field.type === 'boolean' && (
              <input
                id={field.name}
                type="checkbox"
                checked={values[field.name] || false}
                onChange={(e) => setValue(field.name, e.target.checked)}
              />
            )}
            {field.type === 'select' && (
              <select
                id={field.name}
                value={values[field.name] || ''}
                onChange={(e) => setValue(field.name, e.target.value)}
              >
                <option value="">Select...</option>
                {field.options?.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            )}
            {errors[field.name] && (
              <div className="error" data-testid={`error-${field.name}`}>
                {errors[field.name]}
              </div>
            )}
          </div>
        ))}
        
        <div className="form-actions">
          <button
            onClick={handleExecute}
            disabled={!isValid || isSubmitting}
            data-testid="execute-button"
          >
            {isSubmitting ? 'Executing...' : 'Execute Workflow'}
          </button>
          <button onClick={reset} type="button">
            Reset
          </button>
        </div>
      </div>

      {executionError && (
        <div className="error" data-testid="execution-error">
          {executionError}
        </div>
      )}

      {executionResult && (
        <div data-testid="execution-results">
          <WorkflowExecutionResults result={executionResult} />
        </div>
      )}
    </div>
  );
};

const TestApp: React.FC<{ workflowId?: string }> = ({ workflowId }) => {
  return (
    <BrowserRouter>
      <AuthProvider initialUser={testUser}>
        {workflowId ? (
          <WorkflowExecutionPage workflowId={workflowId} />
        ) : (
          <WorkflowDiscoveryPage />
        )}
      </AuthProvider>
    </BrowserRouter>
  );
};

describe('Workflow Execution End-to-End Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Setup access control mocks
    mockAccessControlService.checkAccess.mockImplementation((user, resource, action) => ({
      allowed: user.permissions.some(perm => 
        (perm.resource === resource || perm.resource === '*') &&
        (perm.actions.includes(action) || perm.actions.includes('*'))
      ),
      reason: 'Permission granted'
    }));

    mockAccessControlService.getAvailableWorkflows.mockReturnValue(testWorkflows);

    // Setup Dify API client mocks
    mockDifyApiClient.prototype.getWorkflows.mockResolvedValue(testWorkflows);
    mockDifyApiClient.prototype.getWorkflowMetadata.mockImplementation(async (id) => {
      const workflow = testWorkflows.find(w => w.id === id);
      if (!workflow) throw new Error('Workflow not found');
      return workflow;
    });

    // Setup workflow execution service mocks
    mockWorkflowExecutionService.executeWorkflow.mockImplementation(async (workflowId, input) => {
      if (workflowId === 'text-analysis-workflow') {
        return mockTextAnalysisResult;
      }
      if (workflowId === 'image-generation-workflow') {
        return mockImageGenerationResult;
      }
      throw new Error('Workflow execution failed');
    });

    mockWorkflowExecutionService.validateWorkflowInput.mockReturnValue({
      valid: true,
      errors: []
    });
  });

  describe('Workflow Discovery Flow', () => {
    it('should display available workflows based on user permissions', async () => {
      render(<TestApp />);

      await waitFor(() => {
        expect(screen.getByText('Available Workflows')).toBeInTheDocument();
      });

      // Should show workflows the user has access to
      expect(screen.getByText('Text Analysis')).toBeInTheDocument();
      expect(screen.getByText('Image Generation')).toBeInTheDocument();
      expect(screen.getByText('Data Processing Pipeline')).toBeInTheDocument();
    });

    it('should show workflow statistics in dashboard', async () => {
      render(<TestApp />);

      await waitFor(() => {
        expect(screen.getByText('Available Workflows')).toBeInTheDocument();
      });

      // Dashboard should show workflow counts and categories
      expect(mockAccessControlService.getAvailableWorkflows).toHaveBeenCalledWith(testUser);
    });

    it('should handle workflow loading errors gracefully', async () => {
      mockDifyApiClient.prototype.getWorkflows.mockRejectedValue(new Error('API Error'));

      render(<TestApp />);

      await waitFor(() => {
        expect(screen.getByText('Error: API Error')).toBeInTheDocument();
      });
    });

    it('should filter workflows by search and category', async () => {
      render(<TestApp />);

      await waitFor(() => {
        expect(screen.getByText('Text Analysis')).toBeInTheDocument();
      });

      // Simulate search functionality (would be tested in WorkflowList component)
      expect(mockAccessControlService.getAvailableWorkflows).toHaveBeenCalled();
    });
  });

  describe('Text Analysis Workflow Execution', () => {
    it('should render workflow form with correct fields', async () => {
      render(<TestApp workflowId="text-analysis-workflow" />);

      await waitFor(() => {
        expect(screen.getByText('Execute: Text Analysis')).toBeInTheDocument();
      });

      // Check form fields based on input schema
      expect(screen.getByLabelText(/text/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/language/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/includeEntities/i)).toBeInTheDocument();
    });

    it('should validate required fields', async () => {
      render(<TestApp workflowId="text-analysis-workflow" />);

      await waitFor(() => {
        expect(screen.getByTestId('execute-button')).toBeInTheDocument();
      });

      // Try to execute without required text field
      const executeButton = screen.getByTestId('execute-button');
      fireEvent.click(executeButton);

      // Should show validation error
      await waitFor(() => {
        expect(screen.getByTestId('error-text')).toBeInTheDocument();
      });
    });

    it('should execute workflow with valid input', async () => {
      render(<TestApp workflowId="text-analysis-workflow" />);

      await waitFor(() => {
        expect(screen.getByLabelText(/text/i)).toBeInTheDocument();
      });

      // Fill in required fields
      const textInput = screen.getByLabelText(/text/i);
      fireEvent.change(textInput, {
        target: { value: 'OpenAI is revolutionizing artificial intelligence development.' }
      });

      const languageSelect = screen.getByLabelText(/language/i);
      fireEvent.change(languageSelect, { target: { value: 'en' } });

      // Execute workflow
      const executeButton = screen.getByTestId('execute-button');
      fireEvent.click(executeButton);

      // Should show execution results
      await waitFor(() => {
        expect(screen.getByTestId('execution-results')).toBeInTheDocument();
      });

      expect(mockWorkflowExecutionService.executeWorkflow).toHaveBeenCalledWith(
        'text-analysis-workflow',
        expect.objectContaining({
          text: 'OpenAI is revolutionizing artificial intelligence development.',
          language: 'en'
        })
      );
    });

    it('should display execution results correctly', async () => {
      render(<TestApp workflowId="text-analysis-workflow" />);

      await waitFor(() => {
        expect(screen.getByLabelText(/text/i)).toBeInTheDocument();
      });

      // Fill and execute
      const textInput = screen.getByLabelText(/text/i);
      fireEvent.change(textInput, {
        target: { value: 'Test text for analysis' }
      });

      fireEvent.click(screen.getByTestId('execute-button'));

      await waitFor(() => {
        expect(screen.getByTestId('execution-results')).toBeInTheDocument();
      });

      // Results should be displayed in WorkflowExecutionResults component
      // The component would show sentiment, entities, and key phrases
    });

    it('should handle execution errors gracefully', async () => {
      mockWorkflowExecutionService.executeWorkflow.mockRejectedValue(
        new Error('Workflow execution timeout')
      );

      render(<TestApp workflowId="text-analysis-workflow" />);

      await waitFor(() => {
        expect(screen.getByLabelText(/text/i)).toBeInTheDocument();
      });

      const textInput = screen.getByLabelText(/text/i);
      fireEvent.change(textInput, { target: { value: 'Test text' } });

      fireEvent.click(screen.getByTestId('execute-button'));

      await waitFor(() => {
        expect(screen.getByTestId('execution-error')).toBeInTheDocument();
        expect(screen.getByText('Workflow execution timeout')).toBeInTheDocument();
      });
    });
  });

  describe('Image Generation Workflow Execution', () => {
    it('should render image generation form correctly', async () => {
      render(<TestApp workflowId="image-generation-workflow" />);

      await waitFor(() => {
        expect(screen.getByText('Execute: Image Generation')).toBeInTheDocument();
      });

      // Check form fields
      expect(screen.getByLabelText(/prompt/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/style/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/size/i)).toBeInTheDocument();
    });

    it('should execute image generation workflow', async () => {
      render(<TestApp workflowId="image-generation-workflow" />);

      await waitFor(() => {
        expect(screen.getByLabelText(/prompt/i)).toBeInTheDocument();
      });

      // Fill in prompt
      const promptInput = screen.getByLabelText(/prompt/i);
      fireEvent.change(promptInput, {
        target: { value: 'A beautiful sunset over mountains with vibrant colors' }
      });

      const styleSelect = screen.getByLabelText(/style/i);
      fireEvent.change(styleSelect, { target: { value: 'artistic' } });

      fireEvent.click(screen.getByTestId('execute-button'));

      await waitFor(() => {
        expect(screen.getByTestId('execution-results')).toBeInTheDocument();
      });

      expect(mockWorkflowExecutionService.executeWorkflow).toHaveBeenCalledWith(
        'image-generation-workflow',
        expect.objectContaining({
          prompt: 'A beautiful sunset over mountains with vibrant colors',
          style: 'artistic'
        })
      );
    });
  });

  describe('Data Processing Workflow Execution', () => {
    it('should handle complex data input validation', async () => {
      render(<TestApp workflowId="data-processing-workflow" />);

      await waitFor(() => {
        expect(screen.getByText('Execute: Data Processing Pipeline')).toBeInTheDocument();
      });

      // This workflow requires array input and complex validation
      expect(mockDifyApiClient.prototype.getWorkflowMetadata).toHaveBeenCalledWith(
        'data-processing-workflow'
      );
    });

    it('should execute data processing with structured input', async () => {
      render(<TestApp workflowId="data-processing-workflow" />);

      await waitFor(() => {
        expect(screen.getByText('Execute: Data Processing Pipeline')).toBeInTheDocument();
      });

      // Complex form handling would be tested here
      // This would involve JSON input fields and operation selection
    });
  });

  describe('Workflow Execution Progress Tracking', () => {
    it('should show execution progress for long-running workflows', async () => {
      // Mock a workflow that takes time to complete
      mockWorkflowExecutionService.executeWorkflow.mockImplementation(
        () => new Promise(resolve => {
          setTimeout(() => resolve(mockTextAnalysisResult), 2000);
        })
      );

      render(<TestApp workflowId="text-analysis-workflow" />);

      await waitFor(() => {
        expect(screen.getByLabelText(/text/i)).toBeInTheDocument();
      });

      const textInput = screen.getByLabelText(/text/i);
      fireEvent.change(textInput, { target: { value: 'Test text' } });

      fireEvent.click(screen.getByTestId('execute-button'));

      // Should show executing state
      expect(screen.getByText('Executing...')).toBeInTheDocument();
      expect(screen.getByTestId('execute-button')).toBeDisabled();
    });

    it('should handle workflow cancellation', async () => {
      // Mock cancellable execution
      let cancelled = false;
      mockWorkflowExecutionService.executeWorkflow.mockImplementation(
        () => new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            if (cancelled) {
              reject(new Error('Execution cancelled'));
            } else {
              resolve(mockTextAnalysisResult);
            }
          }, 5000);

          // Simulate cancellation
          setTimeout(() => {
            cancelled = true;
            clearTimeout(timeout);
          }, 1000);
        })
      );

      render(<TestApp workflowId="text-analysis-workflow" />);

      await waitFor(() => {
        expect(screen.getByLabelText(/text/i)).toBeInTheDocument();
      });

      const textInput = screen.getByLabelText(/text/i);
      fireEvent.change(textInput, { target: { value: 'Test text' } });

      fireEvent.click(screen.getByTestId('execute-button'));

      // Execution should be cancelled and show error
      await waitFor(() => {
        expect(screen.getByTestId('execution-error')).toBeInTheDocument();
      }, { timeout: 6000 });
    });
  });

  describe('Permission-Based Workflow Access', () => {
    it('should only show workflows user has permission to execute', async () => {
      // Create user with limited permissions
      const limitedUser: User = {
        ...testUser,
        permissions: [
          {
            resource: 'workflow',
            actions: ['read'],
            conditions: []
          }
        ]
      };

      mockAccessControlService.getAvailableWorkflows.mockImplementation((user) => {
        return testWorkflows.filter(workflow => 
          workflow.requiredPermissions.every(perm => 
            user.permissions.some(userPerm => 
              userPerm.resource === 'workflow' && userPerm.actions.includes('read')
            )
          )
        );
      });

      const TestAppWithLimitedUser: React.FC = () => (
        <BrowserRouter>
          <AuthProvider initialUser={limitedUser}>
            <WorkflowDiscoveryPage />
          </AuthProvider>
        </BrowserRouter>
      );

      render(<TestAppWithLimitedUser />);

      await waitFor(() => {
        expect(mockAccessControlService.getAvailableWorkflows).toHaveBeenCalledWith(limitedUser);
      });
    });

    it('should prevent execution of workflows without execute permission', async () => {
      const readOnlyUser: User = {
        ...testUser,
        permissions: [
          {
            resource: 'workflow',
            actions: ['read'],
            conditions: []
          }
        ]
      };

      mockAccessControlService.checkAccess.mockImplementation((user, resource, action) => ({
        allowed: action === 'read',
        reason: action === 'read' ? 'Permission granted' : 'Execute permission required'
      }));

      const TestAppWithReadOnlyUser: React.FC = () => (
        <BrowserRouter>
          <AuthProvider initialUser={readOnlyUser}>
            <WorkflowExecutionPage workflowId="text-analysis-workflow" />
          </AuthProvider>
        </BrowserRouter>
      );

      render(<TestAppWithReadOnlyUser />);

      await waitFor(() => {
        expect(screen.getByText('Execute: Text Analysis')).toBeInTheDocument();
      });

      // Execute button should be disabled or show permission error
      const executeButton = screen.getByTestId('execute-button');
      expect(executeButton).toBeDisabled();
    });
  });

  describe('Error Recovery and Retry Mechanisms', () => {
    it('should provide retry functionality for failed executions', async () => {
      mockWorkflowExecutionService.executeWorkflow
        .mockRejectedValueOnce(new Error('Network timeout'))
        .mockResolvedValueOnce(mockTextAnalysisResult);

      render(<TestApp workflowId="text-analysis-workflow" />);

      await waitFor(() => {
        expect(screen.getByLabelText(/text/i)).toBeInTheDocument();
      });

      const textInput = screen.getByLabelText(/text/i);
      fireEvent.change(textInput, { target: { value: 'Test text' } });

      // First execution fails
      fireEvent.click(screen.getByTestId('execute-button'));

      await waitFor(() => {
        expect(screen.getByTestId('execution-error')).toBeInTheDocument();
        expect(screen.getByText('Network timeout')).toBeInTheDocument();
      });

      // Retry execution succeeds
      fireEvent.click(screen.getByTestId('execute-button'));

      await waitFor(() => {
        expect(screen.getByTestId('execution-results')).toBeInTheDocument();
      });

      expect(mockWorkflowExecutionService.executeWorkflow).toHaveBeenCalledTimes(2);
    });

    it('should handle API rate limiting gracefully', async () => {
      mockWorkflowExecutionService.executeWorkflow.mockRejectedValue(
        new Error('Rate limit exceeded. Please try again in 60 seconds.')
      );

      render(<TestApp workflowId="text-analysis-workflow" />);

      await waitFor(() => {
        expect(screen.getByLabelText(/text/i)).toBeInTheDocument();
      });

      const textInput = screen.getByLabelText(/text/i);
      fireEvent.change(textInput, { target: { value: 'Test text' } });

      fireEvent.click(screen.getByTestId('execute-button'));

      await waitFor(() => {
        expect(screen.getByTestId('execution-error')).toBeInTheDocument();
        expect(screen.getByText(/Rate limit exceeded/)).toBeInTheDocument();
      });
    });

    it('should handle workflow not found errors', async () => {
      mockDifyApiClient.prototype.getWorkflowMetadata.mockRejectedValue(
        new Error('Workflow not found')
      );

      render(<TestApp workflowId="non-existent-workflow" />);

      await waitFor(() => {
        expect(screen.getByText('Workflow not found')).toBeInTheDocument();
      });
    });
  });
});