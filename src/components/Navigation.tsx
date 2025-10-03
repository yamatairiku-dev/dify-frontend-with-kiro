import React from 'react';
import { Link, useLocation } from 'react-router';
import { useAuth } from '../context/AuthContext';
import { usePermissionCheck } from '../hooks/useProtectedRoute';

/**
 * Navigation item interface
 */
interface NavigationItem {
  path: string;
  label: string;
  icon?: string;
  requiredPermission?: {
    resource: string;
    action: string;
  };
  requiredRole?: string[];
}

/**
 * Navigation component props
 */
interface NavigationProps {
  variant?: 'horizontal' | 'vertical';
  showUserInfo?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Main navigation component with permission-based visibility
 */
export const Navigation: React.FC<NavigationProps> = ({
  variant = 'horizontal',
  showUserInfo = true,
  className,
  style
}) => {
  const { user, logout, isAuthenticated } = useAuth();
  const location = useLocation();
  
  // Check permissions for navigation items
  const canViewWorkflows = usePermissionCheck('workflow', 'read');
  const canManageWorkflows = usePermissionCheck('workflow', 'manage');
  const canAccessAdmin = usePermissionCheck('admin', 'access');
  
  // Define navigation items with permission requirements
  const navigationItems: NavigationItem[] = [
    {
      path: '/',
      label: 'Dashboard',
      icon: '🏠'
    },
    {
      path: '/workflows',
      label: 'Workflows',
      icon: '⚙️',
      requiredPermission: {
        resource: 'workflow',
        action: 'read'
      }
    }
  ];

  // Filter navigation items based on user permissions
  const visibleItems = navigationItems.filter(item => {
    if (!item.requiredPermission && !item.requiredRole) {
      return true; // No permission required
    }
    
    if (item.requiredPermission) {
      const { resource, action } = item.requiredPermission;
      if (resource === 'workflow' && action === 'read') return canViewWorkflows;
      if (resource === 'workflow' && action === 'manage') return canManageWorkflows;
      if (resource === 'admin' && action === 'access') return canAccessAdmin;
    }
    
    if (item.requiredRole && user?.attributes.roles) {
      return item.requiredRole.some(role => user.attributes.roles?.includes(role));
    }
    
    return false;
  });

  if (!isAuthenticated) {
    return null;
  }

  const isActive = (path: string): boolean => {
    if (path === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(path);
  };

  const baseStyles: React.CSSProperties = {
    fontFamily: 'system-ui, sans-serif',
    ...style
  };

  const horizontalStyles: React.CSSProperties = {
    ...baseStyles,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '1rem 2rem',
    backgroundColor: '#f8f9fa',
    borderBottom: '1px solid #dee2e6'
  };

  const verticalStyles: React.CSSProperties = {
    ...baseStyles,
    display: 'flex',
    flexDirection: 'column',
    padding: '1rem',
    backgroundColor: '#f8f9fa',
    borderRight: '1px solid #dee2e6',
    minHeight: '100vh',
    width: '250px'
  };

  const navStyles = variant === 'horizontal' ? horizontalStyles : verticalStyles;

  const linkStyles: React.CSSProperties = {
    textDecoration: 'none',
    color: '#495057',
    padding: '0.5rem 1rem',
    borderRadius: '4px',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    transition: 'background-color 0.2s'
  };

  const activeLinkStyles: React.CSSProperties = {
    ...linkStyles,
    backgroundColor: '#0078d4',
    color: 'white'
  };

  const navListStyles: React.CSSProperties = {
    display: 'flex',
    flexDirection: variant === 'horizontal' ? 'row' : 'column',
    gap: variant === 'horizontal' ? '1rem' : '0.5rem',
    listStyle: 'none',
    margin: 0,
    padding: 0
  };

  return (
    <nav className={className} style={navStyles}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
        <div style={{ fontWeight: 'bold', fontSize: '1.2rem' }}>
          Dify Workflow Frontend
        </div>
        
        <ul style={navListStyles}>
          {visibleItems.map((item) => (
            <li key={item.path}>
              <Link
                to={item.path}
                style={isActive(item.path) ? activeLinkStyles : linkStyles}
                onMouseEnter={(e) => {
                  if (!isActive(item.path)) {
                    e.currentTarget.style.backgroundColor = '#e9ecef';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive(item.path)) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }
                }}
              >
                {item.icon && <span>{item.icon}</span>}
                <span>{item.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>

      {showUserInfo && user && (
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '1rem',
          flexDirection: variant === 'vertical' ? 'column' : 'row'
        }}>
          <div style={{ 
            textAlign: variant === 'vertical' ? 'center' : 'right',
            fontSize: '0.9rem'
          }}>
            <div style={{ fontWeight: 'bold' }}>{user.name}</div>
            <div style={{ color: '#666', fontSize: '0.8rem' }}>{user.email}</div>
            {user.attributes.department && (
              <div style={{ color: '#666', fontSize: '0.8rem' }}>
                {user.attributes.department}
              </div>
            )}
          </div>
          
          <button
            onClick={() => logout()}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#dc3545',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '0.9rem'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#c82333';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#dc3545';
            }}
          >
            Logout
          </button>
        </div>
      )}
    </nav>
  );
};

/**
 * Breadcrumb navigation component
 */
interface BreadcrumbItem {
  label: string;
  path?: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  separator?: string;
  className?: string;
  style?: React.CSSProperties;
}

export const Breadcrumb: React.FC<BreadcrumbProps> = ({
  items,
  separator = '/',
  className,
  style
}) => {
  const breadcrumbStyles: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    fontSize: '0.9rem',
    color: '#666',
    padding: '0.5rem 0',
    ...style
  };

  return (
    <nav className={className} style={breadcrumbStyles} aria-label="Breadcrumb">
      <ol style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '0.5rem',
        listStyle: 'none',
        margin: 0,
        padding: 0
      }}>
        {items.map((item, index) => (
          <li key={index} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {index > 0 && (
              <span style={{ color: '#ccc' }}>{separator}</span>
            )}
            {item.path ? (
              <Link 
                to={item.path}
                style={{ 
                  color: '#0078d4', 
                  textDecoration: 'none'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.textDecoration = 'underline';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.textDecoration = 'none';
                }}
              >
                {item.label}
              </Link>
            ) : (
              <span style={{ fontWeight: index === items.length - 1 ? 'bold' : 'normal' }}>
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
};

/**
 * Mobile-friendly navigation toggle
 */
interface MobileNavigationProps {
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

export const MobileNavigation: React.FC<MobileNavigationProps> = ({
  isOpen,
  onToggle,
  children
}) => {
  return (
    <>
      <button
        onClick={onToggle}
        style={{
          display: 'block',
          padding: '0.5rem',
          backgroundColor: 'transparent',
          border: '1px solid #dee2e6',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '1.2rem'
        }}
        aria-label="Toggle navigation"
        aria-expanded={isOpen}
      >
        {isOpen ? '✕' : '☰'}
      </button>
      
      {isOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          zIndex: 1000
        }}>
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '280px',
            height: '100%',
            backgroundColor: 'white',
            boxShadow: '2px 0 5px rgba(0, 0, 0, 0.1)'
          }}>
            <div style={{ padding: '1rem' }}>
              <button
                onClick={onToggle}
                style={{
                  float: 'right',
                  backgroundColor: 'transparent',
                  border: 'none',
                  fontSize: '1.5rem',
                  cursor: 'pointer'
                }}
              >
                ✕
              </button>
            </div>
            {children}
          </div>
        </div>
      )}
    </>
  );
};

export default Navigation;