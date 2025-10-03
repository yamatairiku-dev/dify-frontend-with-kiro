/* eslint-disable react-refresh/only-export-components */
import React from 'react';
import type { MetaFunction } from 'react-router';
import { Link } from 'react-router';
import { useAuth } from '../../src/context/AuthContext';
import { useAuthRequired } from '../../src/hooks/useProtectedRoute';
import { ProtectedLayout } from '../../src/components/Layout';

export const meta: MetaFunction = () => [
  { title: 'Dashboard - Dify Workflow Frontend' },
  { name: 'description', content: 'Dify Workflow Frontend Dashboard' },
];

function IndexContent(): React.ReactElement {
  const { user, logout } = useAuth();
  const { isLoading, isAuthenticated } = useAuthRequired();

  // Don't render if still loading or not authenticated
  if (isLoading || !isAuthenticated || !user) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '200px',
        fontFamily: 'system-ui, sans-serif'
      }}>
        <div style={{
          width: '40px',
          height: '40px',
          border: '4px solid #f3f3f3',
          borderTop: '4px solid #0078d4',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          marginRight: '1rem'
        }}></div>
        <span>Loading dashboard...</span>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', lineHeight: '1.8' }}>
      <div style={{ marginBottom: '2rem' }}>
        <p style={{ fontSize: '1.1rem', color: '#666' }}>
          Welcome back, <strong>{user.name}</strong>! Here's an overview of your account and available actions.
        </p>
      </div>

      <main>
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '2rem',
          marginBottom: '2rem'
        }}>
          <div style={{
            padding: '1.5rem',
            border: '1px solid #ddd',
            borderRadius: '8px',
            backgroundColor: '#f9f9f9'
          }}>
            <h2>User Information</h2>
            <p><strong>Email:</strong> {user.email}</p>
            <p><strong>Provider:</strong> {user.provider}</p>
            <p><strong>Domain:</strong> {user.attributes.domain}</p>
            {user.attributes.department && (
              <p><strong>Department:</strong> {user.attributes.department}</p>
            )}
            {user.attributes.organization && (
              <p><strong>Organization:</strong> {user.attributes.organization}</p>
            )}
          </div>

          <div style={{
            padding: '1.5rem',
            border: '1px solid #ddd',
            borderRadius: '8px',
            backgroundColor: '#f9f9f9'
          }}>
            <h2>Available Actions</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <Link 
                to="/workflows"
                style={{
                  padding: '0.75rem 1rem',
                  backgroundColor: '#0078d4',
                  color: 'white',
                  textDecoration: 'none',
                  borderRadius: '4px',
                  textAlign: 'center'
                }}
              >
                View Workflows
              </Link>
            </div>
          </div>
        </div>

        <div style={{
          padding: '1.5rem',
          border: '1px solid #ddd',
          borderRadius: '8px',
          backgroundColor: '#f9f9f9'
        }}>
          <h2>Permissions</h2>
          {user.permissions.length > 0 ? (
            <ul>
              {user.permissions.map((permission, index) => (
                <li key={index}>
                  <strong>{permission.resource}</strong>: {permission.actions.join(', ')}
                </li>
              ))}
            </ul>
          ) : (
            <p>No specific permissions assigned.</p>
          )}
        </div>
      </main>
    </div>
  );
}

export default function Index(): React.ReactElement {
  return (
    <ProtectedLayout 
      title="Dashboard"
      routeName="Dashboard"
      breadcrumbs={[
        { label: 'Home', path: '/' },
        { label: 'Dashboard' }
      ]}
    >
      <IndexContent />
    </ProtectedLayout>
  );
}
