/* eslint-disable react-refresh/only-export-components */
import React, { useEffect } from 'react';
import type { MetaFunction } from 'react-router';
import { useParams, useSearchParams, useNavigate } from 'react-router';
import { useAuth } from '../../src/context/AuthContext';

export const meta: MetaFunction = () => [
  { title: 'Authentication Callback - Dify Workflow Frontend' },
  { name: 'description', content: 'Processing authentication callback' },
];

export default function OAuthCallback(): React.ReactElement {
  const params = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { completeLogin } = useAuth();
  
  const provider = params['provider'];
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');

  useEffect(() => {
    const processCallback = async () => {
      if (error) {
        console.error('OAuth error:', error, errorDescription);
        return;
      }
      
      if (code && provider) {
        try {
          console.log('OAuth code received, processing authentication...');
          // TODO: Process the OAuth code and complete authentication
          // This would normally involve exchanging the code for tokens
          // For now, we'll simulate a successful authentication
          
          // Mock session data - this would come from your OAuth token exchange
          const mockSessionData = {
            accessToken: 'mock-access-token',
            refreshToken: 'mock-refresh-token',
            expiresAt: Date.now() + 3600000, // 1 hour
            user: {
              id: 'user-123',
              email: 'user@example.com',
              name: 'Test User',
              provider: provider as 'azure' | 'github' | 'google',
              attributes: {
                domain: 'example.com',
                roles: ['user'],
                department: 'Engineering',
                organization: 'Example Corp'
              },
              permissions: [
                {
                  resource: 'workflow',
                  actions: ['execute', 'view']
                }
              ]
            }
          };
          
          await completeLogin(mockSessionData);
          navigate('/', { replace: true });
        } catch (err) {
          console.error('Authentication completion failed:', err);
        }
      }
    };

    processCallback();
  }, [provider, code, error, errorDescription, completeLogin, navigate]);

  if (error) {
    return (
      <div style={{ 
        fontFamily: 'system-ui, sans-serif', 
        lineHeight: '1.8',
        maxWidth: '500px',
        margin: '2rem auto',
        padding: '2rem',
        border: '1px solid #ff6b6b',
        borderRadius: '8px',
        backgroundColor: '#ffe0e0'
      }}>
        <h1>Authentication Error</h1>
        <p><strong>Error:</strong> {error}</p>
        {errorDescription && (
          <p><strong>Description:</strong> {errorDescription}</p>
        )}
        <p>
          <a href="/login" style={{ color: '#0078d4', textDecoration: 'none' }}>
            ← Back to Login
          </a>
        </p>
      </div>
    );
  }

  return (
    <div style={{ 
      fontFamily: 'system-ui, sans-serif', 
      lineHeight: '1.8',
      maxWidth: '500px',
      margin: '2rem auto',
      padding: '2rem',
      textAlign: 'center'
    }}>
      <h1>Processing Authentication</h1>
      <p>Please wait while we complete your {provider} authentication...</p>
      
      <div style={{ 
        margin: '2rem 0',
        padding: '1rem',
        backgroundColor: '#f0f0f0',
        borderRadius: '4px'
      }}>
        <div style={{
          width: '40px',
          height: '40px',
          border: '4px solid #f3f3f3',
          borderTop: '4px solid #0078d4',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          margin: '0 auto'
        }}></div>
      </div>
      
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}