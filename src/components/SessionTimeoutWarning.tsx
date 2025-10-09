/**
 * Session Timeout Warning Component
 * Displays warnings when session is about to expire or when user is idle
 */

import React, { useState, useEffect } from 'react';
import { useSessionTimeoutWarning, useIdleTimeout } from '../hooks/useSessionSecurity';

// Warning modal props
interface SessionWarningModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  timeRemaining: number;
  onExtend: () => void;
  onLogout: () => void;
  onDismiss: () => void;
  type: 'timeout' | 'idle';
}

// Session warning modal component
const SessionWarningModal: React.FC<SessionWarningModalProps> = ({
  isOpen,
  title,
  message,
  timeRemaining,
  onExtend,
  onLogout,
  onDismiss,
  type,
}) => {
  const [countdown, setCountdown] = useState(timeRemaining);

  // Update countdown every second
  useEffect(() => {
    if (!isOpen) return;

    setCountdown(timeRemaining);
    
    const interval = setInterval(() => {
      setCountdown(prev => {
        const newValue = prev - 1000;
        if (newValue <= 0) {
          // Auto-logout when countdown reaches zero
          onLogout();
          return 0;
        }
        return newValue;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen, timeRemaining, onLogout]);

  // Format countdown time
  const formatCountdown = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    
    if (minutes > 0) {
      return `${minutes}:${(seconds % 60).toString().padStart(2, '0')}`;
    }
    return `${seconds}s`;
  };

  if (!isOpen) return null;

  return (
    <div className="session-warning-overlay">
      <div className="session-warning-modal">
        <div className={`session-warning-header ${type}`}>
          <h3>{title}</h3>
          <button 
            className="session-warning-close"
            onClick={onDismiss}
            aria-label="Close warning"
          >
            ×
          </button>
        </div>
        
        <div className="session-warning-content">
          <div className="session-warning-icon">
            {type === 'timeout' ? '⏰' : '😴'}
          </div>
          
          <p className="session-warning-message">{message}</p>
          
          <div className="session-warning-countdown">
            <span className="countdown-label">Time remaining:</span>
            <span className={`countdown-time ${countdown <= 60000 ? 'critical' : ''}`}>
              {formatCountdown(countdown)}
            </span>
          </div>
        </div>
        
        <div className="session-warning-actions">
          <button 
            className="btn btn-primary"
            onClick={onExtend}
          >
            Stay Logged In
          </button>
          <button 
            className="btn btn-secondary"
            onClick={onLogout}
          >
            Logout Now
          </button>
        </div>
      </div>
      
      <style>{`
        .session-warning-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.7);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10000;
          backdrop-filter: blur(4px);
        }
        
        .session-warning-modal {
          background: white;
          border-radius: 12px;
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
          max-width: 480px;
          width: 90%;
          max-height: 90vh;
          overflow: hidden;
          animation: slideIn 0.3s ease-out;
        }
        
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(-20px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        
        .session-warning-header {
          padding: 20px 24px 16px;
          border-bottom: 1px solid #e5e7eb;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        
        .session-warning-header.timeout {
          background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
          border-bottom-color: #f59e0b;
        }
        
        .session-warning-header.idle {
          background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
          border-bottom-color: #3b82f6;
        }
        
        .session-warning-header h3 {
          margin: 0;
          font-size: 1.25rem;
          font-weight: 600;
          color: #1f2937;
        }
        
        .session-warning-close {
          background: none;
          border: none;
          font-size: 1.5rem;
          cursor: pointer;
          color: #6b7280;
          padding: 4px;
          border-radius: 4px;
          transition: all 0.2s;
        }
        
        .session-warning-close:hover {
          background: rgba(0, 0, 0, 0.1);
          color: #374151;
        }
        
        .session-warning-content {
          padding: 24px;
          text-align: center;
        }
        
        .session-warning-icon {
          font-size: 3rem;
          margin-bottom: 16px;
        }
        
        .session-warning-message {
          font-size: 1rem;
          color: #4b5563;
          margin: 0 0 24px 0;
          line-height: 1.5;
        }
        
        .session-warning-countdown {
          background: #f9fafb;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 16px;
          margin-bottom: 24px;
        }
        
        .countdown-label {
          display: block;
          font-size: 0.875rem;
          color: #6b7280;
          margin-bottom: 8px;
        }
        
        .countdown-time {
          font-size: 2rem;
          font-weight: 700;
          color: #1f2937;
          font-family: 'Courier New', monospace;
          transition: color 0.3s;
        }
        
        .countdown-time.critical {
          color: #dc2626;
          animation: pulse 1s infinite;
        }
        
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
        
        .session-warning-actions {
          padding: 0 24px 24px;
          display: flex;
          gap: 12px;
          justify-content: center;
        }
        
        .btn {
          padding: 12px 24px;
          border: none;
          border-radius: 8px;
          font-size: 0.875rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          min-width: 120px;
        }
        
        .btn-primary {
          background: #3b82f6;
          color: white;
        }
        
        .btn-primary:hover {
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
        
        @media (max-width: 640px) {
          .session-warning-modal {
            width: 95%;
            margin: 20px;
          }
          
          .session-warning-actions {
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

// Main session timeout warning component
export const SessionTimeoutWarning: React.FC = () => {
  const timeoutWarning = useSessionTimeoutWarning(5); // 5 minutes warning
  const idleWarning = useIdleTimeout(30, 2); // 30 minutes idle, 2 minutes warning
  const [dismissedTimeout, setDismissedTimeout] = useState(false);
  const [dismissedIdle, setDismissedIdle] = useState(false);

  // Reset dismissed state when warnings change
  useEffect(() => {
    if (!timeoutWarning.showWarning) {
      setDismissedTimeout(false);
    }
  }, [timeoutWarning.showWarning]);

  useEffect(() => {
    if (!idleWarning.showWarning) {
      setDismissedIdle(false);
    }
  }, [idleWarning.showWarning]);

  const handleExtendSession = () => {
    timeoutWarning.extendSession();
    idleWarning.extendSession();
    setDismissedTimeout(false);
    setDismissedIdle(false);
  };

  const handleLogout = () => {
    // This will be handled by the auth context
    window.location.href = '/login';
  };

  const handleDismissTimeout = () => {
    timeoutWarning.dismissWarning();
    setDismissedTimeout(true);
  };

  const handleDismissIdle = () => {
    idleWarning.dismissWarning();
    setDismissedIdle(true);
  };

  // Show timeout warning (higher priority)
  if (timeoutWarning.showWarning && !dismissedTimeout) {
    return (
      <SessionWarningModal
        isOpen={true}
        title="Session Expiring Soon"
        message="Your session will expire soon due to security policies. Would you like to extend your session?"
        timeRemaining={timeoutWarning.timeRemaining || 0}
        onExtend={handleExtendSession}
        onLogout={handleLogout}
        onDismiss={handleDismissTimeout}
        type="timeout"
      />
    );
  }

  // Show idle warning
  if (idleWarning.showWarning && !dismissedIdle) {
    return (
      <SessionWarningModal
        isOpen={true}
        title="Session Idle"
        message="You've been inactive for a while. Your session will expire soon to protect your account."
        timeRemaining={idleWarning.timeUntilIdle || 0}
        onExtend={handleExtendSession}
        onLogout={handleLogout}
        onDismiss={handleDismissIdle}
        type="idle"
      />
    );
  }

  return null;
};

export default SessionTimeoutWarning;