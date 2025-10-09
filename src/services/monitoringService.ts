/**
 * Monitoring and Analytics Service
 * Handles error tracking, performance monitoring, and user analytics
 */

import { getDeploymentConfig, getBuildInfo } from '../config/deployment';

export interface AnalyticsEvent {
  name: string;
  properties?: Record<string, any>;
  userId?: string;
  timestamp?: number;
}

export interface ErrorEvent {
  error: Error;
  context?: Record<string, any>;
  userId?: string;
  userAgent?: string;
  url?: string;
  timestamp?: number;
}

export interface PerformanceMetric {
  name: string;
  value: number;
  unit: 'ms' | 'bytes' | 'count';
  tags?: Record<string, string>;
  timestamp?: number;
}

export interface UserSession {
  sessionId: string;
  userId?: string;
  startTime: number;
  lastActivity: number;
  pageViews: number;
  events: number;
}

/**
 * Analytics Service for tracking user interactions and application usage
 */
export class AnalyticsService {
  private static instance: AnalyticsService;
  private config = getDeploymentConfig();
  private buildInfo = getBuildInfo();
  private sessionId: string;
  private eventQueue: AnalyticsEvent[] = [];
  private isEnabled: boolean;

  private constructor() {
    this.sessionId = this.generateSessionId();
    this.isEnabled = this.config.monitoring.enableAnalytics;
    
    if (this.isEnabled) {
      this.initializeAnalytics();
    }
  }

  static getInstance(): AnalyticsService {
    if (!AnalyticsService.instance) {
      AnalyticsService.instance = new AnalyticsService();
    }
    return AnalyticsService.instance;
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private initializeAnalytics(): void {
    // Initialize analytics providers (Google Analytics, Mixpanel, etc.)
    this.trackEvent('app_initialized', {
      version: this.buildInfo.version,
      mode: this.buildInfo.mode,
      buildTime: this.buildInfo.buildTime,
    });

    // Track page views
    this.setupPageViewTracking();
    
    // Track user engagement
    this.setupEngagementTracking();
  }

  private setupPageViewTracking(): void {
    // Track initial page view
    this.trackPageView(window.location.pathname);

    // Track navigation changes (for SPA)
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = function(...args) {
      originalPushState.apply(history, args);
      AnalyticsService.getInstance().trackPageView(window.location.pathname);
    };

    history.replaceState = function(...args) {
      originalReplaceState.apply(history, args);
      AnalyticsService.getInstance().trackPageView(window.location.pathname);
    };

    window.addEventListener('popstate', () => {
      this.trackPageView(window.location.pathname);
    });
  }

  private setupEngagementTracking(): void {
    // Track time on page
    let startTime = Date.now();
    
    window.addEventListener('beforeunload', () => {
      const timeOnPage = Date.now() - startTime;
      this.trackEvent('page_engagement', {
        timeOnPage,
        path: window.location.pathname,
      });
    });

    // Track clicks on important elements
    document.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      if (target.matches('[data-analytics]')) {
        const action = target.getAttribute('data-analytics');
        this.trackEvent('ui_interaction', {
          action,
          element: target.tagName.toLowerCase(),
          path: window.location.pathname,
        });
      }
    });
  }

  trackEvent(name: string, properties?: Record<string, any>, userId?: string): void {
    if (!this.isEnabled) return;

    const event: AnalyticsEvent = {
      name,
      properties: {
        ...properties,
        sessionId: this.sessionId,
        timestamp: Date.now(),
        url: window.location.href,
        userAgent: navigator.userAgent,
        version: this.buildInfo.version,
      },
      userId,
      timestamp: Date.now(),
    };

    this.eventQueue.push(event);
    this.flushEvents();
  }

  trackPageView(path: string, userId?: string): void {
    this.trackEvent('page_view', {
      path,
      title: document.title,
      referrer: document.referrer,
    }, userId);
  }

  trackUserAction(action: string, properties?: Record<string, any>, userId?: string): void {
    this.trackEvent('user_action', {
      action,
      ...properties,
    }, userId);
  }

  trackWorkflowExecution(workflowId: string, status: string, duration?: number, userId?: string): void {
    this.trackEvent('workflow_execution', {
      workflowId,
      status,
      duration,
    }, userId);
  }

  trackAuthenticationEvent(provider: string, status: string, userId?: string): void {
    this.trackEvent('authentication', {
      provider,
      status,
    }, userId);
  }

  private flushEvents(): void {
    if (this.eventQueue.length === 0) return;

    // In a real implementation, send events to analytics service
    // For now, we'll log them in development and queue them for production
    if (this.config.environment === 'development') {
      console.log('Analytics Events:', this.eventQueue);
    }

    // Send events to analytics service (implement based on your provider)
    this.sendEventsToProvider(this.eventQueue);
    this.eventQueue = [];
  }

  private sendEventsToProvider(events: AnalyticsEvent[]): void {
    // Implement based on your analytics provider
    // Example: Google Analytics, Mixpanel, Amplitude, etc.
    
    // Sample implementation for Google Analytics 4
    if (typeof (globalThis as any).gtag !== 'undefined') {
      events.forEach(event => {
        (globalThis as any).gtag('event', event.name, event.properties);
      });
    }

    // Sample implementation for custom analytics endpoint
    if (this.config.environment !== 'development') {
      fetch('/api/analytics/events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ events }),
      }).catch(error => {
        console.warn('Failed to send analytics events:', error);
      });
    }
  }
}

/**
 * Error Tracking Service for monitoring application errors
 */
export class ErrorTrackingService {
  private static instance: ErrorTrackingService;
  private config = getDeploymentConfig();
  private buildInfo = getBuildInfo();
  private isEnabled: boolean;

  private constructor() {
    this.isEnabled = this.config.monitoring.enableErrorTracking;
    
    if (this.isEnabled) {
      this.initializeErrorTracking();
    }
  }

  static getInstance(): ErrorTrackingService {
    if (!ErrorTrackingService.instance) {
      ErrorTrackingService.instance = new ErrorTrackingService();
    }
    return ErrorTrackingService.instance;
  }

  private initializeErrorTracking(): void {
    // Global error handler
    window.addEventListener('error', (event) => {
      this.trackError(new Error(event.message), {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        type: 'javascript_error',
      });
    });

    // Unhandled promise rejection handler
    window.addEventListener('unhandledrejection', (event) => {
      this.trackError(new Error(event.reason), {
        type: 'unhandled_promise_rejection',
      });
    });
  }

  trackError(error: Error, context?: Record<string, any>, userId?: string): void {
    if (!this.isEnabled) return;

    const errorEvent: ErrorEvent = {
      error,
      context: {
        ...context,
        timestamp: Date.now(),
        url: window.location.href,
        userAgent: navigator.userAgent,
        version: this.buildInfo.version,
        mode: this.buildInfo.mode,
        stack: error.stack,
      },
      userId,
      userAgent: navigator.userAgent,
      url: window.location.href,
      timestamp: Date.now(),
    };

    this.sendErrorToProvider(errorEvent);
  }

  trackAuthenticationError(provider: string, error: Error, userId?: string): void {
    this.trackError(error, {
      type: 'authentication_error',
      provider,
    }, userId);
  }

  trackApiError(endpoint: string, error: Error, userId?: string): void {
    this.trackError(error, {
      type: 'api_error',
      endpoint,
    }, userId);
  }

  trackWorkflowError(workflowId: string, error: Error, userId?: string): void {
    this.trackError(error, {
      type: 'workflow_error',
      workflowId,
    }, userId);
  }

  private sendErrorToProvider(errorEvent: ErrorEvent): void {
    // In development, log to console
    if (this.config.environment === 'development') {
      console.error('Error tracked:', errorEvent);
    }

    // Send to error tracking service (Sentry, Bugsnag, etc.)
    if (this.config.environment !== 'development') {
      // Sample implementation for Sentry
      if (typeof (globalThis as any).Sentry !== 'undefined') {
        (globalThis as any).Sentry.captureException(errorEvent.error, {
          contexts: {
            app: errorEvent.context,
          },
          user: errorEvent.userId ? { id: errorEvent.userId } : undefined,
        });
      }

      // Sample implementation for custom error endpoint
      fetch('/api/errors', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: errorEvent.error.message,
          stack: errorEvent.error.stack,
          context: errorEvent.context,
          userId: errorEvent.userId,
          timestamp: errorEvent.timestamp,
        }),
      }).catch(error => {
        console.warn('Failed to send error to tracking service:', error);
      });
    }
  }
}

/**
 * Performance Monitoring Service for tracking application performance
 */
export class PerformanceMonitoringService {
  private static instance: PerformanceMonitoringService;
  private config = getDeploymentConfig();
  private buildInfo = getBuildInfo();
  private isEnabled: boolean;
  private metrics: PerformanceMetric[] = [];

  private constructor() {
    this.isEnabled = this.config.monitoring.enablePerformanceMonitoring;
    
    if (this.isEnabled) {
      this.initializePerformanceMonitoring();
    }
  }

  static getInstance(): PerformanceMonitoringService {
    if (!PerformanceMonitoringService.instance) {
      PerformanceMonitoringService.instance = new PerformanceMonitoringService();
    }
    return PerformanceMonitoringService.instance;
  }

  private initializePerformanceMonitoring(): void {
    // Track page load performance
    window.addEventListener('load', () => {
      this.trackPageLoadMetrics();
    });

    // Track navigation performance
    this.setupNavigationTracking();
    
    // Track resource loading
    this.setupResourceTracking();
  }

  private trackPageLoadMetrics(): void {
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    
    if (navigation) {
      this.trackMetric('page_load_time', navigation.loadEventEnd - navigation.fetchStart, 'ms');
      this.trackMetric('dom_content_loaded', navigation.domContentLoadedEventEnd - navigation.fetchStart, 'ms');
      this.trackMetric('first_paint', this.getFirstPaint(), 'ms');
      this.trackMetric('first_contentful_paint', this.getFirstContentfulPaint(), 'ms');
    }
  }

  private getFirstPaint(): number {
    const paintEntries = performance.getEntriesByType('paint');
    const firstPaint = paintEntries.find(entry => entry.name === 'first-paint');
    return firstPaint ? firstPaint.startTime : 0;
  }

  private getFirstContentfulPaint(): number {
    const paintEntries = performance.getEntriesByType('paint');
    const firstContentfulPaint = paintEntries.find(entry => entry.name === 'first-contentful-paint');
    return firstContentfulPaint ? firstContentfulPaint.startTime : 0;
  }

  private setupNavigationTracking(): void {
    const observer = new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => {
        if (entry.entryType === 'navigation') {
          const navEntry = entry as PerformanceNavigationTiming;
          this.trackMetric('navigation_time', navEntry.loadEventEnd - navEntry.fetchStart, 'ms', {
            type: navEntry.type,
          });
        }
      });
    });

    observer.observe({ entryTypes: ['navigation'] });
  }

  private setupResourceTracking(): void {
    const observer = new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => {
        if (entry.entryType === 'resource') {
          const resourceEntry = entry as PerformanceResourceTiming;
          this.trackMetric('resource_load_time', resourceEntry.responseEnd - resourceEntry.fetchStart, 'ms', {
            resource: resourceEntry.name,
            type: this.getResourceType(resourceEntry.name),
          });
        }
      });
    });

    observer.observe({ entryTypes: ['resource'] });
  }

  private getResourceType(url: string): string {
    if (url.includes('.js')) return 'javascript';
    if (url.includes('.css')) return 'stylesheet';
    if (url.includes('.png') || url.includes('.jpg') || url.includes('.svg')) return 'image';
    if (url.includes('/api/')) return 'api';
    return 'other';
  }

  trackMetric(name: string, value: number, unit: 'ms' | 'bytes' | 'count', tags?: Record<string, string>): void {
    if (!this.isEnabled) return;

    const metric: PerformanceMetric = {
      name,
      value,
      unit,
      tags: {
        ...tags,
        version: this.buildInfo.version,
        mode: this.buildInfo.mode,
      },
      timestamp: Date.now(),
    };

    this.metrics.push(metric);
    this.flushMetrics();
  }

  trackApiResponseTime(endpoint: string, duration: number): void {
    this.trackMetric('api_response_time', duration, 'ms', {
      endpoint,
    });
  }

  trackWorkflowExecutionTime(workflowId: string, duration: number): void {
    this.trackMetric('workflow_execution_time', duration, 'ms', {
      workflowId,
    });
  }

  trackComponentRenderTime(componentName: string, duration: number): void {
    this.trackMetric('component_render_time', duration, 'ms', {
      component: componentName,
    });
  }

  trackMemoryUsage(): void {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      this.trackMetric('memory_used', memory.usedJSHeapSize, 'bytes');
      this.trackMetric('memory_total', memory.totalJSHeapSize, 'bytes');
      this.trackMetric('memory_limit', memory.jsHeapSizeLimit, 'bytes');
    }
  }

  private flushMetrics(): void {
    if (this.metrics.length === 0) return;

    // In development, log metrics
    if (this.config.environment === 'development') {
      console.log('Performance Metrics:', this.metrics);
    }

    // Send metrics to monitoring service
    this.sendMetricsToProvider(this.metrics);
    this.metrics = [];
  }

  private sendMetricsToProvider(metrics: PerformanceMetric[]): void {
    // Send to performance monitoring service (DataDog, New Relic, etc.)
    if (this.config.environment !== 'development') {
      fetch('/api/metrics', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ metrics }),
      }).catch(error => {
        console.warn('Failed to send performance metrics:', error);
      });
    }
  }
}

// Export singleton instances
export const analyticsService = AnalyticsService.getInstance();
export const errorTrackingService = ErrorTrackingService.getInstance();
export const performanceMonitoringService = PerformanceMonitoringService.getInstance();

// Convenience functions
export function trackEvent(name: string, properties?: Record<string, any>, userId?: string): void {
  analyticsService.trackEvent(name, properties, userId);
}

export function trackError(error: Error, context?: Record<string, any>, userId?: string): void {
  errorTrackingService.trackError(error, context, userId);
}

export function trackMetric(name: string, value: number, unit: 'ms' | 'bytes' | 'count', tags?: Record<string, string>): void {
  performanceMonitoringService.trackMetric(name, value, unit, tags);
}