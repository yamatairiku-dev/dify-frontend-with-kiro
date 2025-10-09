import React, { useEffect } from 'react';
import { Links, Meta, Outlet, Scripts, ScrollRestoration, isRouteErrorResponse, useRouteError } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { AuthProvider } from '../src/context/AuthContext';
import { SessionTimeoutWarning } from '../src/components/SessionTimeoutWarning';
import { PerformanceMonitor } from '../src/components/PerformanceMonitor';
import { queryClient } from '../src/config/react-query';
import { analyticsService, errorTrackingService, performanceMonitoringService } from '../src/services/monitoringService';
import { getDeploymentConfig, validateEnvironmentConfig, getBuildInfo } from '../src/config/deployment';

function MonitoringInitializer(): React.ReactElement | null {
  useEffect(() => {
    // Initialize monitoring services
    const config = getDeploymentConfig();
    const buildInfo = getBuildInfo();
    
    // Validate environment configuration
    const envValidation = validateEnvironmentConfig();
    if (!envValidation.isValid) {
      console.warn('Missing environment variables:', envValidation.missingVars);
      errorTrackingService.trackError(
        new Error('Missing environment variables'),
        { missingVars: envValidation.missingVars }
      );
    }

    // Register service worker in production
    if (config.features.enableServiceWorker && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then((registration) => {
          console.log('Service Worker registered:', registration);
          analyticsService.trackEvent('service_worker_registered', {
            scope: registration.scope,
          });
        })
        .catch((error) => {
          console.error('Service Worker registration failed:', error);
          errorTrackingService.trackError(error, {
            type: 'service_worker_registration_failed',
          });
        });
    }

    // Track application initialization
    analyticsService.trackEvent('app_initialized', {
      version: buildInfo.version,
      mode: buildInfo.mode,
      buildTime: buildInfo.buildTime,
      environment: config.environment,
    });

    // Track initial performance metrics
    performanceMonitoringService.trackMemoryUsage();

    // Set up periodic memory tracking
    const memoryInterval = setInterval(() => {
      performanceMonitoringService.trackMemoryUsage();
    }, 30000); // Every 30 seconds

    return () => {
      clearInterval(memoryInterval);
    };
  }, []);

  return null;
}

export default function App(): React.ReactElement {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" type="image/svg+xml" href="/vite.svg" />
        <link rel="shortcut icon" href="/vite.svg" />
        <link rel="apple-touch-icon" href="/vite.svg" />
        <Meta />
        <Links />
      </head>
      <body>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <MonitoringInitializer />
            <Outlet />
            <SessionTimeoutWarning />
          </AuthProvider>
          <ReactQueryDevtools initialIsOpen={false} />
          <PerformanceMonitor enabled={process.env.NODE_ENV === 'development'} />
        </QueryClientProvider>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

// Error Boundary for the root route
export function ErrorBoundary(): React.ReactElement {
  const error = useRouteError();

  // Track error in monitoring service
  useEffect(() => {
    if (error instanceof Error) {
      errorTrackingService.trackError(error, {
        type: 'route_error',
        route: window.location.pathname,
      });
    }
  }, [error]);

  if (isRouteErrorResponse(error)) {
    return (
      <html lang="en">
        <head>
          <meta charSet="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>Error {error.status}</title>
        </head>
        <body style={{ 
          fontFamily: 'system-ui, sans-serif', 
          lineHeight: '1.8',
          padding: '2rem',
          textAlign: 'center'
        }}>
          <div style={{ maxWidth: '600px', margin: '0 auto' }}>
            <h1 style={{ color: '#d63031' }}>
              {error.status} {error.statusText}
            </h1>
            <p style={{ fontSize: '1.1rem', marginBottom: '2rem' }}>
              {error.data || 'An error occurred while processing your request.'}
            </p>
            <a 
              href="/"
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: '#0078d4',
                color: 'white',
                textDecoration: 'none',
                borderRadius: '4px'
              }}
            >
              Go Home
            </a>
          </div>
        </body>
      </html>
    );
  }

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Application Error</title>
      </head>
      <body style={{ 
        fontFamily: 'system-ui, sans-serif', 
        lineHeight: '1.8',
        padding: '2rem',
        textAlign: 'center'
      }}>
        <div style={{ maxWidth: '600px', margin: '0 auto' }}>
          <h1 style={{ color: '#d63031' }}>Application Error</h1>
          <p style={{ fontSize: '1.1rem', marginBottom: '2rem' }}>
            Something went wrong. Please try again later.
          </p>
          <details style={{ 
            textAlign: 'left', 
            marginBottom: '2rem',
            padding: '1rem',
            backgroundColor: '#f0f0f0',
            borderRadius: '4px'
          }}>
            <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>
              Error Details
            </summary>
            <pre style={{ 
              marginTop: '1rem', 
              fontSize: '0.9rem',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word'
            }}>
              {error instanceof Error ? error.stack : String(error)}
            </pre>
          </details>
          <a 
            href="/"
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: '#0078d4',
              color: 'white',
              textDecoration: 'none',
              borderRadius: '4px'
            }}
          >
            Go Home
          </a>
        </div>
      </body>
    </html>
  );
}
