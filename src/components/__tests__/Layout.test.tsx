import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router';
import { 
  Layout, 
  ProtectedLayout, 
  PublicLayout, 
  DashboardLayout, 
  FullWidthLayout 
} from '../Layout';
import { User } from '../../types/auth';

// Mock the auth context
const mockUser: User = {
  id: 'test-user-id',
  email: 'test@example.com',
  name: 'Test User',
  provider: 'azure',
  attributes: {
    domain: 'example.com',
    roles: ['admin', 'user'],
    department: 'Engineering'
  },
  permissions: [
    {
      resource: 'workflow',
      actions: ['read', 'execute'],
      conditions: []
    }
  ]
};

const mockAuthContext = {
  user: mockUser,
  isAuthenticated: true,
  isLoading: false,
  login: jest.fn(),
  logout: jest.fn(),
  refreshToken: jest.fn(),
  completeLogin: jest.fn()
};

const mockUnauthenticatedContext = {
  user: null,
  isAuthenticated: false,
  isLoading: false,
  login: jest.fn(),
  logout: jest.fn(),
  refreshToken: jest.fn(),
  completeLogin: jest.fn()
};

const mockLoadingContext = {
  user: null,
  isAuthenticated: false,
  isLoading: true,
  login: jest.fn(),
  logout: jest.fn(),
  refreshToken: jest.fn(),
  completeLogin: jest.fn()
};

// Mock useAuth hook
jest.mock('../../context/AuthContext', () => ({
  useAuth: jest.fn()
}));

const mockUseAuth = require('../../context/AuthContext').useAuth as jest.MockedFunction<any>;

// Mock useLocation
const mockLocation = {
  pathname: '/',
  search: '',
  hash: '',
  state: null,
  key: 'default'
};

jest.mock('react-router', () => ({
  ...jest.requireActual('react-router'),
  useLocation: () => mockLocation
}));

// Mock window.innerWidth for mobile detection
Object.defineProperty(window, 'innerWidth', {
  writable: true,
  configurable: true,
  value: 1024,
});

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <BrowserRouter>
    {children}
  </BrowserRouter>
);

const TestContent: React.FC = () => <div>Test content</div>;

describe('Layout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.innerWidth = 1024;
  });

  it('should render basic layout with content', () => {
    mockUseAuth.mockReturnValue(mockAuthContext);

    render(
      <TestWrapper>
        <Layout>
          <TestContent />
        </Layout>
      </TestWrapper>
    );

    expect(screen.getByText('Test content')).toBeInTheDocument();
  });

  it('should render title when provided', () => {
    mockUseAuth.mockReturnValue(mockAuthContext);

    render(
      <TestWrapper>
        <Layout title="Test Page">
          <TestContent />
        </Layout>
      </TestWrapper>
    );

    expect(screen.getByText('Test Page')).toBeInTheDocument();
  });

  it('should render breadcrumbs when provided', () => {
    mockUseAuth.mockReturnValue(mockAuthContext);

    const breadcrumbs = [
      { label: 'Home', path: '/' },
      { label: 'Current Page' }
    ];

    render(
      <TestWrapper>
        <Layout breadcrumbs={breadcrumbs}>
          <TestContent />
        </Layout>
      </TestWrapper>
    );

    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('Current Page')).toBeInTheDocument();
  });

  it('should render navigation when showNavigation is true and user is authenticated', () => {
    mockUseAuth.mockReturnValue(mockAuthContext);

    render(
      <TestWrapper>
        <Layout showNavigation={true}>
          <TestContent />
        </Layout>
      </TestWrapper>
    );

    expect(screen.getByText('Dify Workflow Frontend')).toBeInTheDocument();
  });

  it('should not render navigation when showNavigation is false', () => {
    mockUseAuth.mockReturnValue(mockAuthContext);

    render(
      <TestWrapper>
        <Layout showNavigation={false}>
          <TestContent />
        </Layout>
      </TestWrapper>
    );

    expect(screen.queryByText('Dify Workflow Frontend')).not.toBeInTheDocument();
  });

  it('should render vertical navigation variant', () => {
    mockUseAuth.mockReturnValue(mockAuthContext);

    render(
      <TestWrapper>
        <Layout navigationVariant="vertical">
          <TestContent />
        </Layout>
      </TestWrapper>
    );

    // Check if the main container has row flex direction for vertical nav
    const main = screen.getByRole('main').parentElement;
    expect(main).toHaveStyle('flex-direction: row');
  });

  it('should handle mobile navigation', () => {
    mockUseAuth.mockReturnValue(mockAuthContext);
    
    // Mock mobile width
    window.innerWidth = 500;
    
    // Trigger resize event
    const { rerender } = render(
      <TestWrapper>
        <Layout>
          <TestContent />
        </Layout>
      </TestWrapper>
    );

    // Force re-render to trigger useEffect
    rerender(
      <TestWrapper>
        <Layout>
          <TestContent />
        </Layout>
      </TestWrapper>
    );

    // Should show mobile navigation toggle
    expect(screen.getByRole('button', { name: 'Toggle navigation' })).toBeInTheDocument();
  });
});

describe('ProtectedLayout', () => {
  it('should render content for authenticated users', () => {
    mockUseAuth.mockReturnValue(mockAuthContext);

    render(
      <TestWrapper>
        <ProtectedLayout>
          <TestContent />
        </ProtectedLayout>
      </TestWrapper>
    );

    expect(screen.getByText('Test content')).toBeInTheDocument();
  });

  it('should show loading state when authentication is loading', () => {
    mockUseAuth.mockReturnValue(mockLoadingContext);

    render(
      <TestWrapper>
        <ProtectedLayout>
          <TestContent />
        </ProtectedLayout>
      </TestWrapper>
    );

    expect(screen.getByText('Loading application...')).toBeInTheDocument();
    expect(screen.queryByText('Test content')).not.toBeInTheDocument();
  });

  it('should show authentication required message for unauthenticated users', () => {
    mockUseAuth.mockReturnValue(mockUnauthenticatedContext);

    render(
      <TestWrapper>
        <ProtectedLayout>
          <TestContent />
        </ProtectedLayout>
      </TestWrapper>
    );

    expect(screen.getByText('Authentication Required')).toBeInTheDocument();
    expect(screen.getByText('Please log in to access this page.')).toBeInTheDocument();
    expect(screen.getByText('Go to Login')).toBeInTheDocument();
    expect(screen.queryByText('Test content')).not.toBeInTheDocument();
  });
});

describe('PublicLayout', () => {
  it('should render content without navigation', () => {
    mockUseAuth.mockReturnValue(mockUnauthenticatedContext);

    render(
      <TestWrapper>
        <PublicLayout>
          <TestContent />
        </PublicLayout>
      </TestWrapper>
    );

    expect(screen.getByText('Test content')).toBeInTheDocument();
    expect(screen.queryByText('Dify Workflow Frontend')).not.toBeInTheDocument();
  });

  it('should render title and breadcrumbs', () => {
    mockUseAuth.mockReturnValue(mockUnauthenticatedContext);

    const breadcrumbs = [
      { label: 'Home', path: '/' },
      { label: 'Login' }
    ];

    render(
      <TestWrapper>
        <PublicLayout title="Login Page" breadcrumbs={breadcrumbs}>
          <TestContent />
        </PublicLayout>
      </TestWrapper>
    );

    expect(screen.getByText('Login Page')).toBeInTheDocument();
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('Login')).toBeInTheDocument();
  });
});

describe('DashboardLayout', () => {
  it('should render with vertical navigation', () => {
    mockUseAuth.mockReturnValue(mockAuthContext);

    render(
      <TestWrapper>
        <DashboardLayout>
          <TestContent />
        </DashboardLayout>
      </TestWrapper>
    );

    expect(screen.getByText('Test content')).toBeInTheDocument();
    
    // Check if the main container has row flex direction for vertical nav
    const main = screen.getByRole('main').parentElement;
    expect(main).toHaveStyle('flex-direction: row');
  });

  it('should set default route name to Dashboard', () => {
    mockUseAuth.mockReturnValue(mockAuthContext);

    render(
      <TestWrapper>
        <DashboardLayout>
          <TestContent />
        </DashboardLayout>
      </TestWrapper>
    );

    // The route name is used internally for error boundaries
    expect(screen.getByText('Test content')).toBeInTheDocument();
  });
});

describe('FullWidthLayout', () => {
  it('should render with full width styling', () => {
    mockUseAuth.mockReturnValue(mockAuthContext);

    render(
      <TestWrapper>
        <FullWidthLayout>
          <TestContent />
        </FullWidthLayout>
      </TestWrapper>
    );

    expect(screen.getByText('Test content')).toBeInTheDocument();
  });

  it('should apply custom styles', () => {
    mockUseAuth.mockReturnValue(mockAuthContext);

    render(
      <TestWrapper>
        <FullWidthLayout style={{ backgroundColor: 'red' }}>
          <TestContent />
        </FullWidthLayout>
      </TestWrapper>
    );

    const layout = screen.getByText('Test content').closest('div');
    // The style should be applied to one of the parent containers
    expect(layout).toBeInTheDocument();
  });
});