/* eslint-disable react-refresh/only-export-components */
import React from 'react';
import type { MetaFunction } from 'react-router';
import { Link, useLocation, useNavigate } from 'react-router';
import { useAuth } from '../../src/context/AuthContext';
import { PublicLayout } from '../../src/components/Layout';

export const meta: MetaFunction = () => [
  { title: 'Access Denied - Dify Workflow Frontend' },
  { name: 'description', content: 'Access denied to requested resource' },
];

interface LocationState {
  requiredResource?: string;
  requiredAction?: string;
  requiredPermissions?: Array<{
    resource: string;
    action: string;
    allowWildcard?: boolean;
  }>;
  requiredRoles?: string[];
  userPermissions?: Array<{ resource: string; actions: string[] }>;
  userRoles?: string[];
}

function AccessDeniedContent(): React.ReactElement {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as LocationState || {};

  const handleGoBack = (): void => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/');
    }
  };

  return (
    <div style={{ 
      fontFamily: 'system-ui, sans-serif', 
      lineHeight: '1.8',
      maxWidth: '800px',
      margin: '2rem auto',
      padding: '2rem',
      textAlign: 'center'
    }}>
      <div style={{
        fontSize: '4rem',
        marginBottom: '1rem'
      }}>
        🚫
      </div>
      
      <h1 style={{ color: '#d63031', marginBottom: '1rem' }}>Access Denied</h1>
      
      <p style={{ fontSize: '1.1rem', marginBottom: '2rem', color: '#666' }}>
        You don't have permission to access this resource.
      </p>

      {/* Display specific permission requirements if available */}
      {(state.requiredResource || state.requiredPermissions || state.requiredRoles) && (
        <div style={{
          padding: '1.5rem',
          backgroundColor: '#fff3cd',
          border: '1px solid #ffeaa7',
          borderRadius: '8px',
          marginBottom: '2rem',
          textAlign: 'left'
        }}>
          <h3 style={{ margin: '0 0 1rem 0', color: '#856404' }}>Required Access:</h3>
          
          {state.requiredResource && state.requiredAction && (
            <div style={{ marginBottom: '1rem' }}>
              <p style={{ margin: '0', fontWeight: 'bold' }}>
                Resource: <code style={{ 
                  backgroundColor: '#f8f9fa', 
                  padding: '0.2rem 0.4rem', 
                  borderRadius: '3px',
                  fontFamily: 'monospace'
                }}>{state.requiredResource}</code>
              </p>
              <p style={{ margin: '0.5rem 0 0 0', fontWeight: 'bold' }}>
                Action: <code style={{ 
                  backgroundColor: '#f8f9fa', 
                  padding: '0.2rem 0.4rem', 
                  borderRadius: '3px',
                  fontFamily: 'monospace'
                }}>{state.requiredAction}</code>
              </p>
            </div>
          )}

          {state.requiredPermissions && state.requiredPermissions.length > 0 && (
            <div style={{ marginBottom: '1rem' }}>
              <p style={{ margin: '0 0 0.5rem 0', fontWeight: 'bold' }}>
                Required Permissions (any of):
              </p>
              <ul style={{ margin: '0', paddingLeft: '1.5rem' }}>
                {state.requiredPermissions.map((perm, index) => (
                  <li key={index} style={{ marginBottom: '0.25rem' }}>
                    <code style={{ 
                      backgroundColor: '#f8f9fa', 
                      padding: '0.2rem 0.4rem', 
                      borderRadius: '3px',
                      fontFamily: 'monospace'
                    }}>
                      {perm.resource}:{perm.action}
                    </code>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {state.requiredRoles && state.requiredRoles.length > 0 && (
            <div>
              <p style={{ margin: '0 0 0.5rem 0', fontWeight: 'bold' }}>
                Required Roles (any of):
              </p>
              <ul style={{ margin: '0', paddingLeft: '1.5rem' }}>
                {state.requiredRoles.map((role, index) => (
                  <li key={index} style={{ marginBottom: '0.25rem' }}>
                    <code style={{ 
                      backgroundColor: '#f8f9fa', 
                      padding: '0.2rem 0.4rem', 
                      borderRadius: '3px',
                      fontFamily: 'monospace'
                    }}>
                      {role}
                    </code>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
      
      {user ? (
        <div style={{
          padding: '1.5rem',
          backgroundColor: '#f9f9f9',
          border: '1px solid #ddd',
          borderRadius: '8px',
          marginBottom: '2rem',
          textAlign: 'left'
        }}>
          <h3>Your Current Permissions:</h3>
          {user.permissions.length > 0 ? (
            <ul style={{ margin: '1rem 0' }}>
              {user.permissions.map((permission, index) => (
                <li key={index}>
                  <strong>{permission.resource}</strong>: {permission.actions.join(', ')}
                </li>
              ))}
            </ul>
          ) : (
            <p style={{ color: '#666', fontStyle: 'italic' }}>
              No specific permissions assigned to your account.
            </p>
          )}
          
          <div style={{ marginTop: '1rem', fontSize: '0.9rem', color: '#666' }}>
            <p><strong>User:</strong> {user.name} ({user.email})</p>
            <p><strong>Domain:</strong> {user.attributes.domain}</p>
            {user.attributes.department && (
              <p><strong>Department:</strong> {user.attributes.department}</p>
            )}
            {user.attributes.roles && user.attributes.roles.length > 0 && (
              <div style={{ marginTop: '0.5rem' }}>
                <p style={{ margin: '0 0 0.25rem 0' }}><strong>Your Roles:</strong></p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {user.attributes.roles.map((role: string, index: number) => (
                    <span key={index} style={{
                      backgroundColor: '#e9ecef',
                      padding: '0.2rem 0.5rem',
                      borderRadius: '12px',
                      fontSize: '0.8rem',
                      fontFamily: 'monospace'
                    }}>
                      {role}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div style={{
          padding: '1.5rem',
          backgroundColor: '#fff3cd',
          border: '1px solid #ffeaa7',
          borderRadius: '8px',
          marginBottom: '2rem'
        }}>
          <p>You are not currently logged in. Please authenticate to access this resource.</p>
        </div>
      )}
      
      <div style={{ 
        display: 'flex', 
        gap: '1rem', 
        justifyContent: 'center',
        flexWrap: 'wrap'
      }}>
        <button
          onClick={handleGoBack}
          style={{
            padding: '0.75rem 1.5rem',
            backgroundColor: '#6c757d',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '1rem'
          }}
        >
          ← Go Back
        </button>
        
        {user ? (
          <>
            <Link
              to="/"
              style={{
                display: 'inline-block',
                padding: '0.75rem 1.5rem',
                backgroundColor: '#0078d4',
                color: 'white',
                textDecoration: 'none',
                borderRadius: '4px',
                fontSize: '1rem'
              }}
            >
              🏠 Dashboard
            </Link>
            <Link
              to="/workflows"
              style={{
                display: 'inline-block',
                padding: '0.75rem 1.5rem',
                backgroundColor: '#00b894',
                color: 'white',
                textDecoration: 'none',
                borderRadius: '4px',
                fontSize: '1rem'
              }}
            >
              ⚙️ Available Workflows
            </Link>
          </>
        ) : (
          <Link
            to="/login"
            style={{
              display: 'inline-block',
              padding: '0.75rem 1.5rem',
              backgroundColor: '#0078d4',
              color: 'white',
              textDecoration: 'none',
              borderRadius: '4px',
              fontSize: '1rem'
            }}
          >
            🔐 Login
            </Link>
        )}
      </div>
      
      <div style={{ 
        marginTop: '2rem', 
        padding: '1rem',
        backgroundColor: '#f0f0f0',
        borderRadius: '4px',
        fontSize: '0.9rem',
        color: '#666'
      }}>
        <p><strong>Need access?</strong></p>
        <p>
          Contact your system administrator to request the necessary permissions for this resource.
          Include your email address ({user?.email || 'your email'}) and the specific resource you're trying to access.
        </p>
      </div>
    </div>
  );
}

export default function AccessDenied(): React.ReactElement {
  return (
    <PublicLayout 
      title="Access Denied"
      routeName="Access Denied"
    >
      <AccessDeniedContent />
    </PublicLayout>
  );
}