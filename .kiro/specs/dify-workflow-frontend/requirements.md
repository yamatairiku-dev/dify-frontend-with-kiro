# Requirements Document

## Introduction

DifyワークフローをバックエンドAPIとして利用するWebフロントエンドアプリケーションの開発。React Router、TypeScriptを使用し、Azure、GitHub、GoogleをIDプロバイダーとする認証システムと、ユーザー属性に基づくアクセス制御機能を実装する。

## Requirements

### Requirement 1

**User Story:** As a user, I want to authenticate using my Azure, GitHub, or Google account, so that I can securely access the application without creating a separate account.

#### Acceptance Criteria

1. WHEN a user visits the application THEN the system SHALL display authentication options for Azure, GitHub, and Google
2. WHEN a user selects an authentication provider THEN the system SHALL redirect to the provider's OAuth flow
3. WHEN authentication is successful THEN the system SHALL store the user's authentication token securely
4. WHEN authentication fails THEN the system SHALL display an appropriate error message and allow retry
5. IF a user is already authenticated THEN the system SHALL automatically redirect to the main application

### Requirement 2

**User Story:** As a system administrator, I want user access to be controlled based on their email address and profile attributes, so that only authorized users can access specific backend services.

#### Acceptance Criteria

1. WHEN a user successfully authenticates THEN the system SHALL extract email address and profile attributes from the ID provider
2. WHEN user attributes are received THEN the system SHALL determine available backend services based on predefined access rules
3. IF a user's email domain matches authorized domains THEN the system SHALL grant access to corresponding services
4. IF a user lacks required attributes THEN the system SHALL deny access and display appropriate messaging
5. WHEN access permissions change THEN the system SHALL update user's available services without requiring re-authentication

### Requirement 3

**User Story:** As a user, I want to interact with Dify workflows through a web interface, so that I can utilize backend AI services efficiently.

#### Acceptance Criteria

1. WHEN a user has valid access THEN the system SHALL display available Dify workflow endpoints
2. WHEN a user selects a workflow THEN the system SHALL provide an appropriate input interface
3. WHEN a user submits workflow input THEN the system SHALL send requests to the Dify backend API
4. WHEN the Dify API responds THEN the system SHALL display results in a user-friendly format
5. IF the Dify API is unavailable THEN the system SHALL display error status and retry options

### Requirement 4

**User Story:** As a user, I want to navigate between different sections of the application seamlessly, so that I can access various features efficiently.

#### Acceptance Criteria

1. WHEN a user is authenticated THEN the system SHALL provide navigation to all accessible sections
2. WHEN a user clicks navigation links THEN the system SHALL route to appropriate pages without full page reload
3. WHEN a user accesses a protected route without authentication THEN the system SHALL redirect to login
4. WHEN a user accesses a route they don't have permission for THEN the system SHALL display access denied message
5. IF a user's session expires THEN the system SHALL redirect to authentication flow

### Requirement 5

**User Story:** As a developer, I want the application to be built with TypeScript, so that we have type safety and better maintainability.

#### Acceptance Criteria

1. WHEN developing components THEN the system SHALL enforce TypeScript type checking
2. WHEN making API calls THEN the system SHALL use typed interfaces for request/response data
3. WHEN handling authentication tokens THEN the system SHALL use proper typing for security
4. WHEN building the application THEN the system SHALL compile without TypeScript errors
5. IF type errors exist THEN the system SHALL prevent successful compilation

### Requirement 6

**User Story:** As a user, I want my session to be managed securely, so that my authentication state persists appropriately and expires when needed.

#### Acceptance Criteria

1. WHEN a user authenticates THEN the system SHALL store session data securely in browser storage
2. WHEN a user closes and reopens the browser THEN the system SHALL restore valid sessions automatically
3. WHEN a session expires THEN the system SHALL clear stored credentials and redirect to login
4. WHEN a user logs out THEN the system SHALL clear all session data and revoke tokens
5. IF suspicious activity is detected THEN the system SHALL invalidate the session immediately
