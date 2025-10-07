/**
 * Session Management Route
 * Provides users with session information and management controls
 */

import React from 'react';
import { useAuth } from '../../src/context/AuthContext';
import { ProtectedLayout } from '../../src/components/Layout';
import { SessionManagement } from '../../src/components/SessionManagement';

export default function SessionManagementRoute(): React.ReactElement {
  const { user, isAuthenticated } = useAuth();

  // Redirect to login if not authenticated
  if (!isAuthenticated || !user) {
    return (
      <ProtectedLayout 
        title="Session Management" 
        routeName="Session Management"
      >
        <div style={{ 
          textAlign: 'center', 
          padding: '2rem',
          color: '#6b7280'
        }}>
          <p>Please log in to access session management.</p>
        </div>
      </ProtectedLayout>
    );
  }

  return (
    <ProtectedLayout 
      title="Session Management" 
      routeName="Session Management"
      breadcrumbs={[
        { label: 'Dashboard', path: '/' },
        { label: 'Session Management' }
      ]}
    >
      <SessionManagement />
    </ProtectedLayout>
  );
}