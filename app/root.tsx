import React from 'react';
import { Links, Meta, Outlet, Scripts, ScrollRestoration, isRouteErrorResponse, useRouteError } from 'react-router';
import { AuthProvider } from '../src/context/AuthContext';

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
        <AuthProvider>
          <Outlet />
        </AuthProvider>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

// Error Boundary for the root route
export function ErrorBoundary(): React.ReactElement {
  const error = useRouteError();

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
