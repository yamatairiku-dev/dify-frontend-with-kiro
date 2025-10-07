import { config } from '../config/environment';
import { TokenManager } from './tokenManager';
import { SecureFetch, RateLimiter, InputValidator } from './securityService';
import type {
  DifyWorkflow,
  WorkflowResult,
  DifyApiRequest,
  DifyApiResponse,
  DifyApiError,
  DifyApiConfig,
  ExecuteWorkflowRequest,
  ExecuteWorkflowResponse,
  GetWorkflowsRequest,
  GetWorkflowsResponse,
  GetWorkflowStatusRequest,
  GetWorkflowStatusResponse,
  SignedRequest,
  RateLimitInfo,
  WorkflowInput,
} from '../types/dify';

/**
 * Dify API Client Service
 * 
 * Provides a comprehensive interface for interacting with Dify workflow APIs
 * with proper error handling, retries, authentication, and request signing.
 */
export class DifyApiClient {
  private config: DifyApiConfig;
  private rateLimitInfo: RateLimitInfo | null = null;
  private requestQueue: Array<() => Promise<any>> = [];
  private isProcessingQueue = false;

  constructor(customConfig?: Partial<DifyApiConfig>) {
    this.config = {
      baseUrl: config.difyApiUrl,
      timeout: 30000, // 30 seconds
      retryAttempts: 3,
      retryDelay: 1000, // 1 second
      enableRequestSigning: true,
      ...customConfig,
    };
  }

  /**
   * Get all available workflows with optional filtering
   */
  async getWorkflows(request?: GetWorkflowsRequest): Promise<DifyWorkflow[]> {
    const response = await this.makeRequest<GetWorkflowsResponse>({
      method: 'GET',
      endpoint: '/api/v1/workflows',
      data: request,
    });

    return response.data?.workflows || [];
  }

  /**
   * Execute a workflow with the given input
   */
  async executeWorkflow(
    workflowId: string,
    input: WorkflowInput,
    userId?: string
  ): Promise<WorkflowResult> {
    const request: ExecuteWorkflowRequest = {
      workflowId,
      input,
      userId,
      metadata: {
        userAgent: navigator.userAgent,
        sessionId: this.getSessionId(),
        requestId: this.generateRequestId(),
      },
    };

    const response = await this.makeRequest<ExecuteWorkflowResponse>({
      method: 'POST',
      endpoint: `/api/v1/workflows/${workflowId}/execute`,
      data: request,
    });

    if (!response.data) {
      throw new Error('Invalid response from Dify API');
    }

    return {
      executionId: response.data.executionId,
      status: response.data.status,
    };
  }

  /**
   * Get the status of a workflow execution
   */
  async getWorkflowStatus(executionId: string): Promise<WorkflowResult> {
    const response = await this.makeRequest<GetWorkflowStatusResponse>({
      method: 'GET',
      endpoint: `/api/v1/executions/${executionId}/status`,
    });

    if (!response.data) {
      throw new Error('Invalid response from Dify API');
    }

    return response.data;
  }

  /**
   * Get workflow metadata by ID
   */
  async getWorkflowMetadata(workflowId: string): Promise<DifyWorkflow> {
    const response = await this.makeRequest<DifyWorkflow>({
      method: 'GET',
      endpoint: `/api/v1/workflows/${workflowId}`,
    });

    if (!response.data) {
      throw new Error('Workflow not found');
    }

    return response.data;
  }

  /**
   * Cancel a running workflow execution
   */
  async cancelWorkflowExecution(executionId: string): Promise<boolean> {
    const response = await this.makeRequest<{ success: boolean }>({
      method: 'POST',
      endpoint: `/api/v1/executions/${executionId}/cancel`,
    });

    return response.data?.success || false;
  }

  /**
   * Make an authenticated HTTP request to the Dify API
   */
  private async makeRequest<T>(request: DifyApiRequest): Promise<DifyApiResponse<T>> {
    // Check rate limits
    if (this.rateLimitInfo && this.isRateLimited()) {
      await this.waitForRateLimit();
    }

    // Add authentication headers
    const authenticatedRequest = await this.addAuthentication(request);

    // Sign the request if enabled
    const signedRequest = this.config.enableRequestSigning
      ? await this.signRequest(authenticatedRequest)
      : authenticatedRequest;

    // Execute request with retries
    return this.executeWithRetry(signedRequest);
  }

  /**
   * Execute request with exponential backoff retry logic
   */
  private async executeWithRetry<T>(
    request: SignedRequest,
    attempt = 1
  ): Promise<DifyApiResponse<T>> {
    try {
      const response = await this.executeRequest<T>(request);
      
      // Update rate limit info from response headers
      this.updateRateLimitInfo(response);
      
      return response;
    } catch (error) {
      if (attempt < this.config.retryAttempts && this.shouldRetry(error)) {
        const delay = this.config.retryDelay * Math.pow(2, attempt - 1);
        await this.sleep(delay);
        return this.executeWithRetry(request, attempt + 1);
      }
      throw error;
    }
  }

  /**
   * Execute the actual HTTP request with security features
   */
  private async executeRequest<T>(request: SignedRequest): Promise<DifyApiResponse<T>> {
    let url = `${this.config.baseUrl}${request.endpoint}`;
    
    try {
      const fetchOptions: RequestInit = {
        method: request.method,
        headers: {
          'Content-Type': 'application/json',
          ...request.headers,
        },
      };

      if (request.method !== 'GET' && request.data) {
        // Validate input data before sending
        const validation = InputValidator.validateWorkflowInput(request.data);
        if (!validation.isValid) {
          throw this.createApiError(400, { 
            message: 'Invalid request data', 
            errors: validation.errors 
          });
        }
        fetchOptions.body = JSON.stringify(request.data);
      } else if (request.method === 'GET' && request.data) {
        // Add query parameters for GET requests
        const params = new URLSearchParams();
        Object.entries(request.data).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            params.append(key, String(value));
          }
        });
        const queryString = params.toString();
        if (queryString) {
          url += `?${queryString}`;
        }
      }

      // Use secure fetch with rate limiting
      const rateLimitKey = `dify-api:${request.method}:${request.endpoint}`;
      const response = await SecureFetch.fetch(url, fetchOptions, rateLimitKey);

      const responseData = await response.json();

      if (!response.ok) {
        throw this.createApiError(response.status, responseData);
      }

      return {
        success: true,
        data: responseData,
        metadata: {
          requestId: response.headers.get('x-request-id') || this.generateRequestId(),
          timestamp: new Date().toISOString(),
          version: response.headers.get('x-api-version') || '1.0',
        },
      };
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw this.createApiError(408, { message: 'Request timeout' });
      }
      
      throw error;
    }
  }

  /**
   * Add authentication headers to the request
   */
  private async addAuthentication(request: DifyApiRequest): Promise<DifyApiRequest> {
    const accessToken = TokenManager.getValidAccessToken();
    
    if (!accessToken) {
      throw this.createApiError(401, { message: 'No valid access token available' });
    }

    return {
      ...request,
      headers: {
        ...request.headers,
        Authorization: `Bearer ${accessToken}`,
      },
    };
  }

  /**
   * Sign the request using HMAC-SHA256
   */
  private async signRequest(request: DifyApiRequest): Promise<SignedRequest> {
    if (!this.config.signingSecret) {
      return request as SignedRequest;
    }

    const timestamp = Date.now();
    const nonce = this.generateNonce();
    const payload = this.createSignaturePayload(request, timestamp, nonce);
    
    try {
      const signature = await this.generateHmacSignature(payload, this.config.signingSecret);
      
      return {
        ...request,
        signature,
        timestamp,
        nonce,
        headers: {
          ...request.headers,
          'X-Signature': signature,
          'X-Timestamp': timestamp.toString(),
          'X-Nonce': nonce,
        },
      };
    } catch (error) {
      console.warn('Failed to sign request:', error);
      return request as SignedRequest;
    }
  }

  /**
   * Create signature payload for HMAC signing
   */
  private createSignaturePayload(
    request: DifyApiRequest,
    timestamp: number,
    nonce: string
  ): string {
    const method = request.method;
    const endpoint = request.endpoint;
    const body = request.data ? JSON.stringify(request.data) : '';
    
    return `${method}|${endpoint}|${body}|${timestamp}|${nonce}`;
  }

  /**
   * Generate HMAC-SHA256 signature
   */
  private async generateHmacSignature(payload: string, secret: string): Promise<string> {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const messageData = encoder.encode(payload);

    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
    return Array.from(new Uint8Array(signature))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  /**
   * Create standardized API error
   */
  private createApiError(status: number, data: any): Error & DifyApiError {
    const errorMap: Record<number, { type: DifyApiError['type']; defaultMessage: string }> = {
      400: { type: 'validation', defaultMessage: 'Invalid request data' },
      401: { type: 'authentication', defaultMessage: 'Authentication required' },
      403: { type: 'authorization', defaultMessage: 'Access denied' },
      404: { type: 'not_found', defaultMessage: 'Resource not found' },
      429: { type: 'rate_limit', defaultMessage: 'Rate limit exceeded' },
      500: { type: 'server_error', defaultMessage: 'Internal server error' },
    };

    const errorInfo = errorMap[status] || { type: 'server_error' as const, defaultMessage: 'Unknown error' };
    
    const message = data?.message || errorInfo.defaultMessage;
    const error = new Error(message) as Error & DifyApiError;
    
    error.code = data?.code || `HTTP_${status}`;
    error.message = message;
    error.type = errorInfo.type;
    error.details = data?.details;
    
    return error;
  }

  /**
   * Check if request should be retried based on error type
   */
  private shouldRetry(error: any): boolean {
    if (error?.type === 'network' || error?.type === 'server_error') {
      return true;
    }
    
    // Retry on specific HTTP status codes
    const retryableStatuses = [408, 429, 500, 502, 503, 504];
    return retryableStatuses.includes(error?.status);
  }

  /**
   * Update rate limit information from response headers
   */
  private updateRateLimitInfo(response: DifyApiResponse<any>): void {
    // This would typically come from response headers
    // For now, we'll implement a basic rate limiting mechanism
    this.rateLimitInfo = {
      limit: 100,
      remaining: 99,
      resetTime: Date.now() + 60000, // 1 minute from now
    };
  }

  /**
   * Check if currently rate limited
   */
  private isRateLimited(): boolean {
    if (!this.rateLimitInfo) return false;
    
    return this.rateLimitInfo.remaining <= 0 && Date.now() < this.rateLimitInfo.resetTime;
  }

  /**
   * Wait for rate limit to reset
   */
  private async waitForRateLimit(): Promise<void> {
    if (!this.rateLimitInfo) return;
    
    const waitTime = this.rateLimitInfo.resetTime - Date.now();
    if (waitTime > 0) {
      await this.sleep(waitTime);
    }
  }

  /**
   * Utility function to sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Generate a unique request ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate a cryptographic nonce
   */
  private generateNonce(): string {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Get current session ID from token manager
   */
  private getSessionId(): string {
    // This would typically come from the session or token manager
    return `session_${Date.now()}`;
  }

  /**
   * Update API configuration
   */
  updateConfig(newConfig: Partial<DifyApiConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current rate limit information
   */
  getRateLimitInfo(): RateLimitInfo | null {
    return this.rateLimitInfo;
  }
}

// Export singleton instance
export const difyApiClient = new DifyApiClient();