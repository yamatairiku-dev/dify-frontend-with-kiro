import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router';
import { Navigation, Breadcrumb, MobileNavigation } from '../Navigation';
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
    },
    {
      resource: 'admin',
      actions: ['access'],
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

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <BrowserRouter>
    {children}
  </BrowserRouter>
);

describe('Navigation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLocation.pathname = '/';
  });

  it('should render navigation when user is authenticated', () => {
    mockUseAuth.mockReturnValue(mockAuthContext);

    render(
      <TestWrapper>
        <Navigation />
      </TestWrapper>
    );

    expect(screen.getByText('Dify Workflow Frontend')).toBeInTheDocument();
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Workflows')).toBeInTheDocument();
    expect(screen.getByText('Test User')).toBeInTheDocument();
    expect(screen.getByText('test@example.com')).toBeInTheDocument();
    expect(screen.getByText('Logout')).toBeInTheDocument();
  });

  it('should not render navigation when user is not authenticated', () => {
    mockUseAuth.mockReturnValue(mockUnauthenticatedContext);

    render(
      <TestWrapper>
        <Navigation />
      </TestWrapper>
    );

    expect(screen.queryByText('Dify Workflow Frontend')).not.toBeInTheDocument();
  });

  it('should highlight active navigation item', () => {
    mockUseAuth.mockReturnValue(mockAuthContext);
    mockLocation.pathname = '/workflows';

    render(
      <TestWrapper>
        <Navigation />
      </TestWrapper>
    );

    const workflowsLink = screen.getByText('Workflows').closest('a');
    expect(workflowsLink).toHaveStyle('background-color: #0078d4');
  });

  it('should call logout when logout button is clicked', () => {
    mockUseAuth.mockReturnValue(mockAuthContext);

    render(
      <TestWrapper>
        <Navigation />
      </TestWrapper>
    );

    fireEvent.click(screen.getByText('Logout'));
    expect(mockAuthContext.logout).toHaveBeenCalled();
  });

  it('should render vertical navigation variant', () => {
    mockUseAuth.mockReturnValue(mockAuthContext);

    render(
      <TestWrapper>
        <Navigation variant="vertical" />
      </TestWrapper>
    );

    const nav = screen.getByRole('navigation');
    expect(nav).toHaveStyle('flex-direction: column');
  });

  it('should hide user info when showUserInfo is false', () => {
    mockUseAuth.mockReturnValue(mockAuthContext);

    render(
      <TestWrapper>
        <Navigation showUserInfo={false} />
      </TestWrapper>
    );

    expect(screen.queryByText('Test User')).not.toBeInTheDocument();
    expect(screen.queryByText('Logout')).not.toBeInTheDocument();
  });

  it('should filter navigation items based on permissions', () => {
    const limitedUser = {
      ...mockUser,
      permissions: [] // No permissions
    };

    mockUseAuth.mockReturnValue({
      ...mockAuthContext,
      user: limitedUser
    });

    render(
      <TestWrapper>
        <Navigation />
      </TestWrapper>
    );

    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.queryByText('Workflows')).not.toBeInTheDocument();
  });
});

describe('Breadcrumb', () => {
  it('should render breadcrumb items', () => {
    const items = [
      { label: 'Home', path: '/' },
      { label: 'Workflows', path: '/workflows' },
      { label: 'Current Page' }
    ];

    render(
      <TestWrapper>
        <Breadcrumb items={items} />
      </TestWrapper>
    );

    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('Workflows')).toBeInTheDocument();
    expect(screen.getByText('Current Page')).toBeInTheDocument();
  });

  it('should render links for items with paths', () => {
    const items = [
      { label: 'Home', path: '/' },
      { label: 'Current Page' }
    ];

    render(
      <TestWrapper>
        <Breadcrumb items={items} />
      </TestWrapper>
    );

    const homeLink = screen.getByText('Home');
    expect(homeLink.closest('a')).toHaveAttribute('href', '/');

    const currentPage = screen.getByText('Current Page');
    expect(currentPage.closest('a')).toBeNull();
  });

  it('should use custom separator', () => {
    const items = [
      { label: 'Home', path: '/' },
      { label: 'Current Page' }
    ];

    render(
      <TestWrapper>
        <Breadcrumb items={items} separator=">" />
      </TestWrapper>
    );

    expect(screen.getByText('>')).toBeInTheDocument();
  });

  it('should render empty breadcrumb for empty items', () => {
    render(
      <TestWrapper>
        <Breadcrumb items={[]} />
      </TestWrapper>
    );

    const breadcrumb = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(breadcrumb).toBeInTheDocument();
    expect(breadcrumb.querySelector('ol')).toBeEmptyDOMElement();
  });
});

describe('MobileNavigation', () => {
  it('should render toggle button', () => {
    const mockOnToggle = jest.fn();

    render(
      <MobileNavigation isOpen={false} onToggle={mockOnToggle}>
        <div>Navigation content</div>
      </MobileNavigation>
    );

    const toggleButton = screen.getByRole('button', { name: 'Toggle navigation' });
    expect(toggleButton).toBeInTheDocument();
    expect(toggleButton).toHaveTextContent('☰');
  });

  it('should call onToggle when toggle button is clicked', () => {
    const mockOnToggle = jest.fn();

    render(
      <MobileNavigation isOpen={false} onToggle={mockOnToggle}>
        <div>Navigation content</div>
      </MobileNavigation>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Toggle navigation' }));
    expect(mockOnToggle).toHaveBeenCalled();
  });

  it('should show navigation content when open', () => {
    const mockOnToggle = jest.fn();

    render(
      <MobileNavigation isOpen={true} onToggle={mockOnToggle}>
        <div>Navigation content</div>
      </MobileNavigation>
    );

    expect(screen.getByText('Navigation content')).toBeInTheDocument();
    expect(screen.getAllByText('✕')).toHaveLength(2); // Toggle and close buttons
  });

  it('should hide navigation content when closed', () => {
    const mockOnToggle = jest.fn();

    render(
      <MobileNavigation isOpen={false} onToggle={mockOnToggle}>
        <div>Navigation content</div>
      </MobileNavigation>
    );

    expect(screen.queryByText('Navigation content')).not.toBeInTheDocument();
  });

  it('should call onToggle when close button is clicked', () => {
    const mockOnToggle = jest.fn();

    render(
      <MobileNavigation isOpen={true} onToggle={mockOnToggle}>
        <div>Navigation content</div>
      </MobileNavigation>
    );

    // Find the close button (there are two ✕ buttons, get the one inside the overlay)
    const closeButtons = screen.getAllByText('✕');
    fireEvent.click(closeButtons[1]); // The second one is inside the overlay

    expect(mockOnToggle).toHaveBeenCalled();
  });
});