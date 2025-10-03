import React, { useState } from 'react';
import { Navigation, Breadcrumb, MobileNavigation } from './Navigation';
import { RouteErrorBoundary } from './RouteErrorBoundary';
import { useAuth } from '../context/AuthContext';

/**
 * Layout component props
 */
interface LayoutProps {
  children: React.ReactNode;
  title?: string;
  breadcrumbs?: Array<{ label: string; path?: string }>;
  showNavigation?: boolean;
  navigationVariant?: 'horizontal' | 'vertical';
  routeName?: string;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Main application layout component with navigation and error boundaries
 */
export const Layout: React.FC<LayoutProps> = ({
  children,
  title,
  breadcrumbs,
  showNavigation = true,
  navigationVariant = 'horizontal',
  routeName,
  className,
  style
}) => {
  const { isAuthenticated } = useAuth();
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  const layoutStyles: React.CSSProperties = {
    minHeight: '100vh',
    fontFamily: 'system-ui, sans-serif',
    backgroundColor: '#ffffff',
    ...style
  };

  const contentStyles: React.CSSProperties = {
    flex: 1,
    padding: navigationVariant === 'vertical' ? '2rem' : '1rem 2rem',
    maxWidth: '100%',
    overflow: 'auto'
  };

  const mainStyles: React.CSSProperties = {
    display: 'flex',
    flexDirection: navigationVariant === 'vertical' ? 'row' : 'column',
    minHeight: '100vh'
  };

  // Mobile breakpoint detection
  const [isMobile, setIsMobile] = useState(false);

  React.useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return (
    <div className={className} style={layoutStyles}>
      <RouteErrorBoundary routeName={routeName || 'Application Layout'}>
        <div style={mainStyles}>
          {/* Navigation */}
          {showNavigation && isAuthenticated && (
            <>
              {isMobile ? (
                <div style={{ 
                  padding: '1rem',
                  backgroundColor: '#f8f9fa',
                  borderBottom: '1px solid #dee2e6',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div style={{ fontWeight: 'bold', fontSize: '1.2rem' }}>
                    Dify Workflow Frontend
                  </div>
                  <MobileNavigation
                    isOpen={isMobileNavOpen}
                    onToggle={() => setIsMobileNavOpen(!isMobileNavOpen)}
                  >
                    <Navigation variant="vertical" />
                  </MobileNavigation>
                </div>
              ) : (
                <Navigation variant={navigationVariant} />
              )}
            </>
          )}

          {/* Main content area */}
          <main style={contentStyles}>
            {/* Page title */}
            {title && (
              <div style={{ marginBottom: '1rem' }}>
                <h1 style={{ 
                  margin: '0 0 0.5rem 0',
                  fontSize: '2rem',
                  fontWeight: 'bold',
                  color: '#212529'
                }}>
                  {title}
                </h1>
              </div>
            )}

            {/* Breadcrumbs */}
            {breadcrumbs && breadcrumbs.length > 0 && (
              <div style={{ marginBottom: '1.5rem' }}>
                <Breadcrumb items={breadcrumbs} />
              </div>
            )}

            {/* Page content with error boundary */}
            <RouteErrorBoundary routeName={routeName || 'Page Content'}>
              {children}
            </RouteErrorBoundary>
          </main>
        </div>
      </RouteErrorBoundary>
    </div>
  );
};

/**
 * Protected layout that requires authentication
 */
export const ProtectedLayout: React.FC<LayoutProps> = (props) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        fontFamily: 'system-ui, sans-serif'
      }}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '1rem'
        }}>
          <div style={{
            width: '50px',
            height: '50px',
            border: '4px solid #f3f3f3',
            borderTop: '4px solid #0078d4',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }}></div>
          <span>Loading application...</span>
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

  if (!isAuthenticated) {
    return (
      <Layout {...props} showNavigation={false}>
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '50vh',
          textAlign: 'center'
        }}>
          <div>
            <h2>Authentication Required</h2>
            <p>Please log in to access this page.</p>
            <a 
              href="/login"
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: '#0078d4',
                color: 'white',
                textDecoration: 'none',
                borderRadius: '4px',
                display: 'inline-block'
              }}
            >
              Go to Login
            </a>
          </div>
        </div>
      </Layout>
    );
  }

  return <Layout {...props} />;
};

/**
 * Simple layout for public pages (login, error pages, etc.)
 */
export const PublicLayout: React.FC<Omit<LayoutProps, 'showNavigation'>> = (props) => {
  return <Layout {...props} showNavigation={false} />;
};

/**
 * Dashboard layout with sidebar navigation
 */
export const DashboardLayout: React.FC<LayoutProps> = (props) => {
  return (
    <ProtectedLayout 
      {...props} 
      navigationVariant="vertical"
      routeName={props.routeName || 'Dashboard'}
    />
  );
};

/**
 * Full-width layout for workflow execution and similar pages
 */
export const FullWidthLayout: React.FC<LayoutProps> = (props) => {
  return (
    <ProtectedLayout 
      {...props}
      style={{
        ...props.style,
        maxWidth: '100%'
      }}
    />
  );
};

export default Layout;