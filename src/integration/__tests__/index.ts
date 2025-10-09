/**
 * Integration Tests Index
 * 
 * This file exports all integration test suites for the Dify Workflow Frontend.
 * These tests verify end-to-end functionality across multiple components and services.
 * 
 * Test Categories:
 * 1. OAuth Authentication Flow - Complete OAuth flow from initiation to completion
 * 2. Protected Route Behavior - Authentication and authorization in routing
 * 3. Workflow Execution E2E - Complete workflow execution from discovery to results
 * 4. Error Recovery Scenarios - Comprehensive error handling and recovery mechanisms
 * 
 * Requirements Coverage:
 * - Requirement 1: OAuth authentication with Azure, GitHub, and Google
 * - Requirement 2: User access control based on attributes and permissions
 * - Requirement 3: Dify workflow interaction through web interface
 * - Requirement 4: Seamless navigation between application sections
 * - Requirement 5: TypeScript type safety and maintainability
 * - Requirement 6: Secure session management with appropriate persistence
 */

// OAuth Authentication Flow Integration Tests
export * from './oauth-authentication-flow.integration.test';

// Protected Route Behavior Integration Tests  
export * from './protected-route-behavior.integration.test';

// Workflow Execution End-to-End Integration Tests
export * from './workflow-execution-e2e.integration.test';

// Error Recovery Scenarios Integration Tests
export * from './error-recovery-scenarios.integration.test';

/**
 * Test Execution Notes:
 * 
 * These integration tests should be run with:
 * - npm test -- --testPathPattern=integration
 * - npm run test:integration (if configured)
 * 
 * Test Environment Requirements:
 * - Jest with React Testing Library
 * - jsdom environment for browser APIs
 * - Mock implementations for external services
 * - Proper TypeScript configuration
 * 
 * Coverage Areas:
 * - Authentication flows (OAuth 2.0/PKCE)
 * - Authorization and access control
 * - API integration (Dify workflows)
 * - Error handling and recovery
 * - Session management
 * - Route protection
 * - Component integration
 * - Service layer integration
 */