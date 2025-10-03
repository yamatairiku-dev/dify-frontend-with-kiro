// Dify API type definitions

// JSON Schema type for workflow input/output validation
export interface JSONSchema {
  type: string;
  properties?: Record<string, JSONSchemaProperty>;
  required?: string[];
  additionalProperties?: boolean;
}

export interface JSONSchemaProperty {
  type: string;
  description?: string;
  enum?: string[];
  format?: string;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  items?: JSONSchema; // Changed to JSONSchema to allow nested schemas with required fields
  properties?: Record<string, JSONSchemaProperty>;
}

// Dify Workflow definition
export interface DifyWorkflow {
  id: string;
  name: string;
  description: string;
  inputSchema: JSONSchema;
  outputSchema: JSONSchema;
  requiredPermissions: string[];
  version?: string;
  tags?: string[];
  category?: string;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

// Workflow execution types
export type WorkflowExecutionStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface WorkflowInput {
  [key: string]: any;
}

export interface WorkflowResult {
  executionId: string;
  status: WorkflowExecutionStatus;
  result?: any;
  error?: string;
  startedAt?: string;
  completedAt?: string;
  duration?: number;
}

export interface WorkflowExecution {
  id: string;
  workflowId: string;
  userId: string;
  input: WorkflowInput;
  status: WorkflowExecutionStatus;
  createdAt: Date;
  completedAt?: Date;
  result?: any;
  error?: string;
  metadata?: WorkflowExecutionMetadata;
}

export interface WorkflowExecutionMetadata {
  userAgent?: string;
  ipAddress?: string;
  sessionId?: string;
  requestId?: string;
}

// API Request/Response types
export interface DifyApiRequest {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  endpoint: string;
  data?: any;
  headers?: Record<string, string>;
  timeout?: number;
}

export interface DifyApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: DifyApiError;
  metadata?: {
    requestId: string;
    timestamp: string;
    version: string;
  };
}

export interface DifyApiError {
  code: string;
  message: string;
  details?: any;
  type: 'validation' | 'authentication' | 'authorization' | 'not_found' | 'server_error' | 'rate_limit' | 'network';
}

// Workflow execution request/response
export interface ExecuteWorkflowRequest {
  workflowId: string;
  input: WorkflowInput;
  userId?: string;
  metadata?: WorkflowExecutionMetadata;
}

export interface ExecuteWorkflowResponse {
  executionId: string;
  status: WorkflowExecutionStatus;
  message?: string;
}

// Workflow list request/response
export interface GetWorkflowsRequest {
  category?: string;
  tags?: string[];
  isActive?: boolean;
  limit?: number;
  offset?: number;
}

export interface GetWorkflowsResponse {
  workflows: DifyWorkflow[];
  total: number;
  limit: number;
  offset: number;
}

// Workflow status request/response
export interface GetWorkflowStatusRequest {
  executionId: string;
}

export interface GetWorkflowStatusResponse extends WorkflowResult {}

// API Configuration
export interface DifyApiConfig {
  baseUrl: string;
  apiKey?: string;
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
  enableRequestSigning: boolean;
  signingSecret?: string;
}

// Rate limiting
export interface RateLimitInfo {
  limit: number;
  remaining: number;
  resetTime: number;
}

// Request signing
export interface SignedRequest extends DifyApiRequest {
  signature?: string;
  timestamp?: number;
  nonce?: string;
}

// Workflow execution result types (from workflowExecutionService)
export interface ProcessedWorkflowResult {
  executionId: string;
  workflowId: string;
  status: WorkflowExecutionStatus;
  result?: FormattedResult;
  error?: any; // WorkflowExecutionError
  metadata: ResultMetadata;
}

export interface FormattedResult {
  data: any;
  displayFormat: 'text' | 'json' | 'table' | 'chart' | 'image' | 'html';
  summary?: string;
  downloadUrl?: string;
}

export interface ResultMetadata {
  executionTime: number;
  startedAt: Date;
  completedAt?: Date;
  inputSize: number;
  outputSize?: number;
  steps?: ExecutionStep[];
}

export interface ExecutionStep {
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt?: Date;
  completedAt?: Date;
  duration?: number;
  output?: any;
}

// Progress tracking types (from workflowExecutionService)
export interface WorkflowProgress {
  executionId: string;
  workflowId: string;
  status: WorkflowExecutionStatus;
  progress: number; // 0-100
  currentStep?: string;
  estimatedTimeRemaining?: number;
  startedAt: Date;
  lastUpdated: Date;
}