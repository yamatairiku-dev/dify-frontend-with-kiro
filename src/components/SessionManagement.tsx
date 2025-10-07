/**
 * Session Management UI Component
 * Provides users with session information and management controls
 */

import React, { useState } from 'react';
import { useSessionSecurity } from '../hooks/useSessionSecurity';
import { useAuth } from '../context/AuthContext';
import { SessionSecurityEvent } from '../services/sessionSecurityService';

// Session info display props
interface SessionInfoDisplayProps {
  sessionInfo: any;
  className?: string;
}

// Session info display component
const SessionInfoDisplay: React.FC<SessionInfoDisplayProps> = ({ sessionInfo, className = '' }) => {
  if (!sessionInfo) {
    return (
      <div className={`session-info-display ${className}`}>
        <p className="no-session">No active session</p>
      </div>
    );
  }

  const getStatusColor = (timeRemaining: number, total: number): string => {
    const percentage = (timeRemaining / total) * 100;
    if (percentage > 50) return '#10b981'; // Green
    if (percentage > 25) return '#f59e0b'; // Yellow
    return '#ef4444'; // Red
  };

  return (
    <div className={`session-info-display ${className}`}>
      <div className="session-status">
        <div className="status-indicator active">
          <span className="status-dot"></span>
          Active Session
        </div>
        <div className="session-duration">
          Session Duration: {sessionInfo.sessionAgeFormatted}
        </div>
      </div>

      <div className="session-metrics">
        <div className="metric-card">
          <div className="metric-header">
            <h4>Session Timeout</h4>
            <span className="metric-value">{sessionInfo.timeUntilTimeoutFormatted}</span>
          </div>
          <div className="progress-bar">
            <div 
              className="progress-fill"
              style={{
                width: `${Math.max(0, (sessionInfo.timeUntilTimeout / (24 * 60 * 60 * 1000)) * 100)}%`,
                backgroundColor: getStatusColor(sessionInfo.timeUntilTimeout, 24 * 60 * 60 * 1000)
              }}
            ></div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <h4>Idle Timeout</h4>
            <span className="metric-value">{sessionInfo.timeUntilIdleFormatted}</span>
          </div>
          <div className="progress-bar">
            <div 
              className="progress-fill"
              style={{
                width: `${Math.max(0, (sessionInfo.timeUntilIdle / (30 * 60 * 1000)) * 100)}%`,
                backgroundColor: getStatusColor(sessionInfo.timeUntilIdle, 30 * 60 * 1000)
              }}
            ></div>
          </div>
        </div>
      </div>

      <div className="session-stats">
        <div className="stat-item">
          <span className="stat-label">Activity Count:</span>
          <span className="stat-value">{sessionInfo.activityCount.toLocaleString()}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Token Refreshes:</span>
          <span className="stat-value">{sessionInfo.refreshAttempts}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Last Activity:</span>
          <span className="stat-value">{sessionInfo.idleTimeFormatted} ago</span>
        </div>
      </div>

      <style jsx>{`
        .session-info-display {
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          padding: 20px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }

        .no-session {
          text-align: center;
          color: #6b7280;
          font-style: italic;
          margin: 0;
        }

        .session-status {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
          padding-bottom: 16px;
          border-bottom: 1px solid #f3f4f6;
        }

        .status-indicator {
          display: flex;
          align-items: center;
          gap: 8px;
          font-weight: 600;
          color: #059669;
        }

        .status-dot {
          width: 8px;
          height: 8px;
          background: #10b981;
          border-radius: 50%;
          animation: pulse 2s infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        .session-duration {
          color: #6b7280;
          font-size: 0.875rem;
        }

        .session-metrics {
          display: grid;
          gap: 16px;
          margin-bottom: 20px;
        }

        .metric-card {
          background: #f9fafb;
          border: 1px solid #f3f4f6;
          border-radius: 8px;
          padding: 16px;
        }

        .metric-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }

        .metric-header h4 {
          margin: 0;
          font-size: 0.875rem;
          font-weight: 600;
          color: #374151;
        }

        .metric-value {
          font-size: 0.875rem;
          font-weight: 600;
          color: #1f2937;
          font-family: 'Courier New', monospace;
        }

        .progress-bar {
          height: 6px;
          background: #e5e7eb;
          border-radius: 3px;
          overflow: hidden;
        }

        .progress-fill {
          height: 100%;
          transition: width 0.3s ease, background-color 0.3s ease;
          border-radius: 3px;
        }

        .session-stats {
          display: grid;
          gap: 8px;
        }

        .stat-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 0;
        }

        .stat-label {
          color: #6b7280;
          font-size: 0.875rem;
        }

        .stat-value {
          font-weight: 600;
          color: #1f2937;
          font-size: 0.875rem;
        }

        @media (max-width: 640px) {
          .session-status {
            flex-direction: column;
            align-items: flex-start;
            gap: 8px;
          }

          .metric-header {
            flex-direction: column;
            align-items: flex-start;
            gap: 4px;
          }
        }
      `}</style>
    </div>
  );
};

// Security events display component
interface SecurityEventsDisplayProps {
  events: Array<{
    event: SessionSecurityEvent;
    timestamp: number;
    data?: any;
  }>;
  className?: string;
}

const SecurityEventsDisplay: React.FC<SecurityEventsDisplayProps> = ({ events, className = '' }) => {
  const [showAll, setShowAll] = useState(false);
  const displayEvents = showAll ? events : events.slice(0, 5);

  const getEventIcon = (event: SessionSecurityEvent): string => {
    switch (event) {
      case SessionSecurityEvent.SESSION_TIMEOUT:
        return '⏰';
      case SessionSecurityEvent.IDLE_TIMEOUT:
        return '😴';
      case SessionSecurityEvent.SUSPICIOUS_ACTIVITY:
        return '⚠️';
      case SessionSecurityEvent.SESSION_WARNING:
        return '🔔';
      case SessionSecurityEvent.SESSION_RESTORED:
        return '✅';
      case SessionSecurityEvent.SESSION_INVALIDATED:
        return '❌';
      case SessionSecurityEvent.CONCURRENT_SESSION_DETECTED:
        return '👥';
      default:
        return 'ℹ️';
    }
  };

  const getEventColor = (event: SessionSecurityEvent): string => {
    switch (event) {
      case SessionSecurityEvent.SESSION_TIMEOUT:
      case SessionSecurityEvent.IDLE_TIMEOUT:
      case SessionSecurityEvent.SESSION_INVALIDATED:
        return '#ef4444';
      case SessionSecurityEvent.SUSPICIOUS_ACTIVITY:
      case SessionSecurityEvent.CONCURRENT_SESSION_DETECTED:
        return '#f59e0b';
      case SessionSecurityEvent.SESSION_RESTORED:
        return '#10b981';
      case SessionSecurityEvent.SESSION_WARNING:
        return '#3b82f6';
      default:
        return '#6b7280';
    }
  };

  const formatEventName = (event: SessionSecurityEvent): string => {
    return event.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
  };

  const formatTimestamp = (timestamp: number): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - timestamp;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString();
  };

  return (
    <div className={`security-events-display ${className}`}>
      <div className="events-header">
        <h3>Security Events</h3>
        {events.length > 5 && (
          <button 
            className="toggle-button"
            onClick={() => setShowAll(!showAll)}
          >
            {showAll ? 'Show Less' : `Show All (${events.length})`}
          </button>
        )}
      </div>

      {events.length === 0 ? (
        <p className="no-events">No security events recorded</p>
      ) : (
        <div className="events-list">
          {displayEvents.map((eventItem, index) => (
            <div key={index} className="event-item">
              <div className="event-icon" style={{ color: getEventColor(eventItem.event) }}>
                {getEventIcon(eventItem.event)}
              </div>
              <div className="event-content">
                <div className="event-name">
                  {formatEventName(eventItem.event)}
                </div>
                <div className="event-timestamp">
                  {formatTimestamp(eventItem.timestamp)}
                </div>
                {eventItem.data && (
                  <div className="event-details">
                    {typeof eventItem.data === 'object' 
                      ? JSON.stringify(eventItem.data, null, 2)
                      : String(eventItem.data)
                    }
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <style jsx>{`
        .security-events-display {
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          padding: 20px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }

        .events-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
          padding-bottom: 12px;
          border-bottom: 1px solid #f3f4f6;
        }

        .events-header h3 {
          margin: 0;
          font-size: 1.125rem;
          font-weight: 600;
          color: #1f2937;
        }

        .toggle-button {
          background: none;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          padding: 6px 12px;
          font-size: 0.75rem;
          color: #374151;
          cursor: pointer;
          transition: all 0.2s;
        }

        .toggle-button:hover {
          background: #f3f4f6;
          border-color: #9ca3af;
        }

        .no-events {
          text-align: center;
          color: #6b7280;
          font-style: italic;
          margin: 20px 0;
        }

        .events-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .event-item {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 12px;
          background: #f9fafb;
          border: 1px solid #f3f4f6;
          border-radius: 8px;
          transition: all 0.2s;
        }

        .event-item:hover {
          background: #f3f4f6;
          border-color: #e5e7eb;
        }

        .event-icon {
          font-size: 1.25rem;
          flex-shrink: 0;
          margin-top: 2px;
        }

        .event-content {
          flex: 1;
          min-width: 0;
        }

        .event-name {
          font-weight: 600;
          color: #1f2937;
          font-size: 0.875rem;
          margin-bottom: 4px;
        }

        .event-timestamp {
          color: #6b7280;
          font-size: 0.75rem;
          margin-bottom: 4px;
        }

        .event-details {
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 4px;
          padding: 8px;
          font-size: 0.75rem;
          color: #4b5563;
          font-family: 'Courier New', monospace;
          white-space: pre-wrap;
          word-break: break-word;
          max-height: 100px;
          overflow-y: auto;
        }

        @media (max-width: 640px) {
          .events-header {
            flex-direction: column;
            align-items: flex-start;
            gap: 8px;
          }

          .toggle-button {
            align-self: flex-end;
          }
        }
      `}</style>
    </div>
  );
};

// Main session management component
export const SessionManagement: React.FC = () => {
  const { user, logout } = useAuth();
  const {
    isMonitoring,
    formattedSessionInfo,
    securityEvents,
    extendSession,
    validateSession,
  } = useSessionSecurity();

  const [isValidating, setIsValidating] = useState(false);

  const handleExtendSession = () => {
    extendSession();
  };

  const handleValidateSession = async () => {
    setIsValidating(true);
    try {
      const isValid = await validateSession();
      if (!isValid) {
        alert('Session validation failed. You will be logged out.');
        logout();
      } else {
        alert('Session is valid and secure.');
      }
    } catch (error) {
      console.error('Session validation error:', error);
      alert('Session validation error occurred.');
    } finally {
      setIsValidating(false);
    }
  };

  const handleLogout = () => {
    if (confirm('Are you sure you want to logout?')) {
      logout();
    }
  };

  if (!user || !isMonitoring) {
    return (
      <div className="session-management">
        <div className="no-session-message">
          <h2>Session Management</h2>
          <p>No active session to manage. Please log in to view session information.</p>
        </div>
        
        <style jsx>{`
          .session-management {
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
          }

          .no-session-message {
            text-align: center;
            padding: 40px 20px;
            background: white;
            border: 1px solid #e5e7eb;
            border-radius: 12px;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
          }

          .no-session-message h2 {
            margin: 0 0 16px 0;
            color: #1f2937;
          }

          .no-session-message p {
            margin: 0;
            color: #6b7280;
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="session-management">
      <div className="session-header">
        <h2>Session Management</h2>
        <div className="session-actions">
          <button 
            className="btn btn-secondary"
            onClick={handleExtendSession}
          >
            Extend Session
          </button>
          <button 
            className="btn btn-primary"
            onClick={handleValidateSession}
            disabled={isValidating}
          >
            {isValidating ? 'Validating...' : 'Validate Session'}
          </button>
          <button 
            className="btn btn-danger"
            onClick={handleLogout}
          >
            Logout
          </button>
        </div>
      </div>

      <div className="session-content">
        <SessionInfoDisplay 
          sessionInfo={formattedSessionInfo}
          className="session-info-section"
        />
        
        <SecurityEventsDisplay 
          events={securityEvents}
          className="security-events-section"
        />
      </div>

      <style jsx>{`
        .session-management {
          max-width: 800px;
          margin: 0 auto;
          padding: 20px;
        }

        .session-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
          padding-bottom: 16px;
          border-bottom: 2px solid #f3f4f6;
        }

        .session-header h2 {
          margin: 0;
          color: #1f2937;
          font-size: 1.5rem;
          font-weight: 700;
        }

        .session-actions {
          display: flex;
          gap: 12px;
        }

        .btn {
          padding: 8px 16px;
          border: none;
          border-radius: 6px;
          font-size: 0.875rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          min-width: 100px;
        }

        .btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .btn-primary {
          background: #3b82f6;
          color: white;
        }

        .btn-primary:hover:not(:disabled) {
          background: #2563eb;
          transform: translateY(-1px);
        }

        .btn-secondary {
          background: #f3f4f6;
          color: #374151;
          border: 1px solid #d1d5db;
        }

        .btn-secondary:hover {
          background: #e5e7eb;
          transform: translateY(-1px);
        }

        .btn-danger {
          background: #ef4444;
          color: white;
        }

        .btn-danger:hover {
          background: #dc2626;
          transform: translateY(-1px);
        }

        .session-content {
          display: grid;
          gap: 24px;
        }

        .session-info-section,
        .security-events-section {
          width: 100%;
        }

        @media (max-width: 768px) {
          .session-header {
            flex-direction: column;
            align-items: flex-start;
            gap: 16px;
          }

          .session-actions {
            width: 100%;
            justify-content: flex-end;
          }

          .btn {
            flex: 1;
            min-width: auto;
          }
        }

        @media (max-width: 640px) {
          .session-actions {
            flex-direction: column;
          }

          .btn {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
};

export default SessionManagement;