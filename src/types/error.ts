/**
 * Error Types and Interfaces for Global Error Handling
 */

/**
 * Application error types
 */
export enum ErrorType {
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  AUTHORIZATION_ERROR = 'AUTHORIZATION_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  DIFY_API_ERROR = 'DIFY_API_ERROR',
  ROUTE_ERROR = 'ROUTE_ERROR',
  COMPONENT_ERROR = 'COMPONENT_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

/**
 * Error severity levels
 */
export enum ErrorSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

/**
 * Base application error interface
 */
export interface AppError {
  type: ErrorType;
  message: string;
  code?: string;
  details?: any;
  severity: ErrorSeverity;
  timestamp: Date;
  userId?: string;
  sessionId?: string;
  userAgent?: string;
  url?: string;
  stack?: string;
  componentStack?: string;
}

/**
 * Authentication specific error
 */
export interface AuthenticationError extends AppError {
  type: ErrorType.AUTHENTICATION_ERROR;
  provider?: string;
  authStep?: 'login' | 'callback' | 'refresh' | 'logout';
}

/**
 * Authorization specific error
 */
export interface AuthorizationError extends AppError {
  type: ErrorType.AUTHORIZATION_ERROR;
  resource?: string;
  action?: string;
  requiredPermissions?: string[];
}

/**
 * Network specific error
 */
export interface NetworkError extends AppError {
  type: ErrorType.NETWORK_ERROR;
  status?: number;
  statusText?: string;
  endpoint?: string;
  method?: string;
  retryCount?: number;
}

/**
 * Validation specific error
 */
export interface ValidationError extends AppError {
  type: ErrorType.VALIDATION_ERROR;
  field?: string;
  value?: any;
  constraint?: string;
  validationErrors?: Array<{
    field: string;
    message: string;
    value?: any;
  }>;
}

/**
 * Dify API specific error
 */
export interface DifyApiError extends AppError {
  type: ErrorType.DIFY_API_ERROR;
  workflowId?: string;
  executionId?: string;
  apiEndpoint?: string;
  apiErrorCode?: string;
}

/**
 * Route specific error
 */
export interface RouteError extends AppError {
  type: ErrorType.ROUTE_ERROR;
  routeName?: string;
  routePath?: string;
  params?: Record<string, string>;
}

/**
 * Component specific error
 */
export interface ComponentError extends AppError {
  type: ErrorType.COMPONENT_ERROR;
  componentName?: string;
  componentStack?: string;
  props?: Record<string, any>;
}

/**
 * Union type for all specific error types
 */
export type SpecificError = 
  | AuthenticationError
  | AuthorizationError
  | NetworkError
  | ValidationError
  | DifyApiError
  | RouteError
  | ComponentError;

/**
 * Error context for error boundaries
 */
export interface ErrorContext {
  errorId: string;
  timestamp: Date;
  url: string;
  userAgent: string;
  userId?: string;
  sessionId?: string;
  routeName?: string;
  componentStack?: string;
}

/**
 * Error logging configuration
 */
export interface ErrorLoggingConfig {
  enableConsoleLogging: boolean;
  enableRemoteLogging: boolean;
  logLevel: ErrorSeverity;
  excludePersonalInfo: boolean;
  maxStackTraceLength: number;
  remoteEndpoint?: string;
  apiKey?: string;
}

/**
 * Error recovery action
 */
export interface ErrorRecoveryAction {
  label: string;
  action: () => void | Promise<void>;
  primary?: boolean;
  variant?: 'primary' | 'secondary' | 'danger';
}

/**
 * Error display options
 */
export interface ErrorDisplayOptions {
  showStack?: boolean;
  showRetry?: boolean;
  showReload?: boolean;
  showGoHome?: boolean;
  customActions?: ErrorRecoveryAction[];
  title?: string;
  description?: string;
  icon?: string;
}

/**
 * Error boundary state
 */
export interface ErrorBoundaryState {
  hasError: boolean;
  error: AppError | null;
  errorContext: ErrorContext | null;
  retryCount: number;
}

/**
 * Error handler function type
 */
export type ErrorHandler = (error: AppError, context: ErrorContext) => void | Promise<void>;

/**
 * Error recovery function type
 */
export type ErrorRecoveryFunction = () => void | Promise<void>;

/**
 * Error boundary props
 */
export interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<{
    error: AppError;
    context: ErrorContext;
    retry: ErrorRecoveryFunction;
    actions?: ErrorRecoveryAction[];
  }>;
  onError?: ErrorHandler;
  displayOptions?: ErrorDisplayOptions;
  maxRetries?: number;
  resetOnPropsChange?: boolean;
  resetKeys?: Array<string | number>;
}

/**
 * Error utility functions interface
 */
export interface ErrorUtils {
  createError: (type: ErrorType, message: string, options?: Partial<AppError>) => AppError;
  isRetryableError: (error: AppError) => boolean;
  shouldLogError: (error: AppError, config: ErrorLoggingConfig) => boolean;
  sanitizeError: (error: AppError, excludePersonalInfo: boolean) => AppError;
  formatErrorForDisplay: (error: AppError) => string;
  getErrorSeverity: (error: AppError) => ErrorSeverity;
}