/* eslint-disable react-refresh/only-export-components */
import React, { useEffect } from 'react';
import type { MetaFunction } from 'react-router';
import { useNavigate } from 'react-router';
import { useAuth } from '../../src/context/AuthContext';
import { PublicLayout } from '../../src/components/Layout';

export const meta: MetaFunction = () => [
  { title: 'Login - Dify Workflow Frontend' },
  { name: 'description', content: 'Login to access Dify workflows' },
];

function LoginContent(): React.ReactElement {
  const { isAuthenticated, login } = useAuth();
  const navigate = useNavigate();

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const handleLogin = async (provider: 'azure' | 'github' | 'google') => {
    try {
      await login(provider);
    } catch (error) {
      console.error('Login failed:', error);
    }
  };

  return (
    <div style={{ 
      fontFamily: 'system-ui, sans-serif', 
      lineHeight: '1.8',
      maxWidth: '400px',
      margin: '2rem auto',
      padding: '2rem',
      border: '1px solid #ddd',
      borderRadius: '8px',
      backgroundColor: '#f9f9f9'
    }}>
      <h1>Login to Dify Workflow Frontend</h1>
      <p>Choose your authentication provider:</p>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '2rem' }}>
        <button
          onClick={() => handleLogin('azure')}
          style={{
            padding: '0.75rem 1rem',
            backgroundColor: '#0078d4',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '1rem'
          }}
        >
          Login with Azure AD
        </button>
        
        <button
          onClick={() => handleLogin('github')}
          style={{
            padding: '0.75rem 1rem',
            backgroundColor: '#24292e',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '1rem'
          }}
        >
          Login with GitHub
        </button>
        
        <button
          onClick={() => handleLogin('google')}
          style={{
            padding: '0.75rem 1rem',
            backgroundColor: '#4285f4',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '1rem'
          }}
        >
          Login with Google
        </button>
      </div>
    </div>
  );
}

export default function Login(): React.ReactElement {
  return (
    <PublicLayout 
      title="Login"
      routeName="Login"
    >
      <LoginContent />
    </PublicLayout>
  );
}