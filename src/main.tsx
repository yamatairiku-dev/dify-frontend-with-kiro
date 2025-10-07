import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider, createBrowserRouter } from 'react-router';
import './index.css';

// Import routes from React Router v7
import routes from 'virtual:react-router/routes';

// Initialize security features
import { initializeSecurity } from './services/securityService';

// Initialize security features before creating router
initializeSecurity();

const router = createBrowserRouter(routes);

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found');
}

createRoot(rootElement).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>
);
