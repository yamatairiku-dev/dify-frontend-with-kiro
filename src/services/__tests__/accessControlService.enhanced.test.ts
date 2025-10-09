/**
 * Enhanced unit tests for access control service
 * Task 9.1: Write tests for access control logic
 */

import { 
  AccessControlService,
  AccessResult,
  DomainServiceMapping,
  AccessControlConfig,
  DifyWorkflow,
} from '../accessControlService';
import { UserAttributeService } from '../userAttributeService';
import {
  User,
  Permission,
} from '../../types/auth';

// Mock UserAttributeService
jest.mock('../userAttributeService');

describe('Access Control Service - Enhanced Tests', () => {
  let accessControlService: AccessControlService;
  const mockUserAttributeService = UserAttributeService as jest.Mocked<typeof UserAttributeService>;

  const mockUser: User = {
    id: 'user-1',
    email: 'john.doe@company.com',
    name: 'John Doe',
    provider: 'azure',
    attributes: {
      domain: 'company.com',
      roles: ['developer', 'user'],
      department: 'engineering',
      organization: 'Company Inc',
    },
    permissions: [
      {
        resource: 'workflow',
        actions: ['read', 'execute'],
        conditions: [
          {
            attribute: 'attributes.department',
            operator: 'equals',
            value: 'engineering',
          },
        ],
      },
    ],
  };

  const mockWorkflows: DifyWorkflow[] = [
    {
      id: 'workflow-1',
      name: 'Data Processing',
      description: 'Process data files',
      inputSchema: { type: 'object', properties: {} },
      outputSchema: { type: 'object', properties: {} },
      requiredPermissions: ['workflow:execute'],
      allowedDomains: ['company.com'],
      allowedRoles: ['developer', 'user'],
    },
    {
      id: 'workflow-2',
      name: 'Admin Workflow',
      description: 'Administrative tasks',
      inputSchema: { type: 'object', properties: {} },
      outputSchema: { type: 'object', properties: {} },
      requiredPermissions: ['admin:manage'],
      allowedRoles: ['admin'],
    },
  ];

  const mockDomainMappings: DomainServiceMapping[] = [
    {
      domain: 'company.com',
      allowedServices: ['workflow-service', 'data-service'],
      defaultPermissions: [
        {
          resource: 'workflow',
          actions: ['read'],
          conditions: [],
        },
      ],
      roleBasedPermissions: {
        developer: [
          {
            resource: 'workflow',
            actions: ['read', 'execute'],
            conditions: [],
          },
        ],
        admin: [
          {
            resource: '*',
            actions: ['*'],
            conditions: [],
          },
        ],
      },
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    accessControlService = new AccessControlService();
    
    // Setup default configuration
    const config: AccessControlConfig = {
      domainMappings: mockDomainMappings,
      globalPermissions: [],
      workflows: mockWorkflows,
    };
    
    accessControlService.updateConfig(config);
  });

  describe('Permission Checking', () => {
    it('should allow access when user has required permissions', () => {
      const result = accessControlService.checkAccess(mockUser, 'workflow', 'read');
      
      expect(result.allowed).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should deny access when user lacks required permissions', () => {
      const result = accessControlService.checkAccess(mockUser, 'admin', 'manage');
      
      expect(result.allowed).toBe(false);
      expect(result.reason).toBeDefined();
      expect(result.requiredPermissions).toContain('admin:manage');
    });

    it('should handle wildcard permissions correctly', () => {
      const adminUser: User = {
        ...mockUser,
        permissions: [
          {
            resource: '*',
            actions: ['*'],
            conditions: [],
          },
        ],
      };

      const result = accessControlService.checkAccess(adminUser, 'any-resource', 'any-action');
      
      expect(result.allowed).toBe(true);
    });

    it('should evaluate conditions correctly', () => {
      const userWithConditions: User = {
        ...mockUser,
        attributes: {
          ...mockUser.attributes,
          department: 'marketing',
        },
      };

      const result = accessControlService.checkAccess(userWithConditions, 'workflow', 'execute');
      
      expect(result.allowed).toBe(false);
      expect(result.missingConditions).toBeDefined();
    });

    it('should handle multiple conditions with AND logic', () => {
      const userWithMultipleConditions: User = {
        ...mockUser,
        permissions: [
          {
            resource: 'workflow',
            actions: ['execute'],
            conditions: [
              {
                attribute: 'attributes.department',
                operator: 'equals',
                value: 'engineering',
              },
              {
                attribute: 'attributes.roles',
                operator: 'contains',
                value: 'developer',
              },
            ],
          },
        ],
      };

      const result = accessControlService.checkAccess(userWithMultipleConditions, 'workflow', 'execute');
      
      expect(result.allowed).toBe(true);
    });
  });

  describe('Workflow Access Control', () => {
    it('should return workflows user has access to', () => {
      const availableWorkflows = accessControlService.getAvailableWorkflows(mockUser);
      
      expect(availableWorkflows).toHaveLength(1);
      expect(availableWorkflows[0].id).toBe('workflow-1');
    });

    it('should filter out workflows user cannot access', () => {
      const limitedUser: User = {
        ...mockUser,
        permissions: [], // No permissions
      };

      const availableWorkflows = accessControlService.getAvailableWorkflows(limitedUser);
      
      expect(availableWorkflows).toHaveLength(0);
    });

    it('should include inactive workflows for admin users', () => {
      const adminUser: User = {
        ...mockUser,
        permissions: [
          {
            resource: '*',
            actions: ['*'],
            conditions: [],
          },
        ],
      };

      const workflowsWithInactive = [
        ...mockWorkflows,
        {
          id: 'workflow-3',
          name: 'Inactive Workflow',
          description: 'Inactive workflow',
          inputSchema: { type: 'object', properties: {} },
          outputSchema: { type: 'object', properties: {} },
          requiredPermissions: ['workflow:execute'],
        },
      ];

      accessControlService.updateConfig({
        domainMappings: mockDomainMappings,
        globalPermissions: [],
        workflows: workflowsWithInactive,
      });

      const availableWorkflows = accessControlService.getAvailableWorkflows(adminUser);
      
      expect(availableWorkflows.length).toBeGreaterThan(mockWorkflows.length);
    });
  });

  describe('Domain-Based Access Control', () => {
    it('should grant access based on email domain', () => {
      const services = accessControlService.getAvailableServices(mockUser);
      
      expect(services).toContain('workflow-service');
      expect(services).toContain('data-service');
    });

    it('should deny access for unauthorized domains', () => {
      const externalUser: User = {
        ...mockUser,
        email: 'external@other.com',
        attributes: {
          ...mockUser.attributes,
          domain: 'other.com',
        },
      };

      const services = accessControlService.getAvailableServices(externalUser);
      
      expect(services).toHaveLength(0);
    });

    it('should apply role-based permissions from domain mapping', () => {
      const developerUser: User = {
        ...mockUser,
        attributes: {
          ...mockUser.attributes,
          roles: ['developer'],
        },
        permissions: [], // Start with no permissions
      };

      const updatedUser = accessControlService.updateUserPermissions(developerUser);
      
      expect(updatedUser.permissions.length).toBeGreaterThan(0);
      expect(updatedUser.permissions.some(p => p.resource === 'workflow' && p.actions.includes('execute'))).toBe(true);
    });
  });

  describe('Dynamic Permission Updates', () => {
    it('should update user permissions without re-authentication', () => {
      const userWithLimitedPermissions: User = {
        ...mockUser,
        permissions: [
          {
            resource: 'workflow',
            actions: ['read'],
            conditions: [],
          },
        ],
      };

      const updatedUser = accessControlService.updateUserPermissions(userWithLimitedPermissions);
      
      expect(updatedUser.permissions.length).toBeGreaterThanOrEqual(userWithLimitedPermissions.permissions.length);
    });

    it('should merge permissions from multiple sources', () => {
      const userWithExistingPermissions: User = {
        ...mockUser,
        permissions: [
          {
            resource: 'custom',
            actions: ['read'],
            conditions: [],
          },
        ],
      };

      const updatedUser = accessControlService.updateUserPermissions(userWithExistingPermissions);
      
      // Should have both existing and new permissions
      expect(updatedUser.permissions.some(p => p.resource === 'custom')).toBe(true);
      expect(updatedUser.permissions.some(p => p.resource === 'workflow')).toBe(true);
    });
  });

  describe('Configuration Management', () => {
    it('should update domain mappings dynamically', () => {
      const newMapping: DomainServiceMapping = {
        domain: 'newcompany.com',
        allowedServices: ['new-service'],
        defaultPermissions: [
          {
            resource: 'new-resource',
            actions: ['read'],
            conditions: [],
          },
        ],
      };

      accessControlService.updateDomainMapping(newMapping);
      
      const newUser: User = {
        ...mockUser,
        email: 'user@newcompany.com',
        attributes: {
          ...mockUser.attributes,
          domain: 'newcompany.com',
        },
      };

      const services = accessControlService.getAvailableServices(newUser);
      expect(services).toContain('new-service');
    });

    it('should update workflow configurations', () => {
      const newWorkflow: DifyWorkflow = {
        id: 'workflow-new',
        name: 'New Workflow',
        description: 'Newly added workflow',
        inputSchema: { type: 'object', properties: {} },
        outputSchema: { type: 'object', properties: {} },
        requiredPermissions: ['workflow:execute'],
      };

      accessControlService.updateWorkflow(newWorkflow);
      
      const availableWorkflows = accessControlService.getAvailableWorkflows(mockUser);
      expect(availableWorkflows.some(w => w.id === 'workflow-new')).toBe(true);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle users with no permissions gracefully', () => {
      const userWithNoPermissions: User = {
        ...mockUser,
        permissions: [],
      };

      const result = accessControlService.checkAccess(userWithNoPermissions, 'workflow', 'read');
      
      expect(result.allowed).toBe(false);
      expect(result.reason).toBeDefined();
    });

    it('should handle invalid attribute paths in conditions', () => {
      const userWithInvalidCondition: User = {
        ...mockUser,
        permissions: [
          {
            resource: 'workflow',
            actions: ['read'],
            conditions: [
              {
                attribute: 'invalid.path',
                operator: 'equals',
                value: 'test',
              },
            ],
          },
        ],
      };

      const result = accessControlService.checkAccess(userWithInvalidCondition, 'workflow', 'read');
      
      expect(result.allowed).toBe(false);
    });

    it('should handle empty domain mappings', () => {
      accessControlService.updateConfig({
        domainMappings: [],
        globalPermissions: [],
        workflows: mockWorkflows,
      });

      const services = accessControlService.getAvailableServices(mockUser);
      expect(services).toHaveLength(0);
    });

    it('should handle malformed permissions gracefully', () => {
      const userWithMalformedPermissions: User = {
        ...mockUser,
        permissions: [
          {
            resource: '',
            actions: [],
            conditions: [],
          },
        ],
      };

      const result = accessControlService.checkAccess(userWithMalformedPermissions, 'workflow', 'read');
      
      expect(result.allowed).toBe(false);
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle large numbers of permissions efficiently', () => {
      const manyPermissions: Permission[] = Array.from({ length: 1000 }, (_, i) => ({
        resource: `resource-${i}`,
        actions: ['read'],
        conditions: [],
      }));

      const userWithManyPermissions: User = {
        ...mockUser,
        permissions: manyPermissions,
      };

      const startTime = Date.now();
      const result = accessControlService.checkAccess(userWithManyPermissions, 'resource-500', 'read');
      const endTime = Date.now();

      expect(result.allowed).toBe(true);
      expect(endTime - startTime).toBeLessThan(100); // Should complete within 100ms
    });

    it('should cache permission evaluations for repeated checks', () => {
      // First check
      const result1 = accessControlService.checkAccess(mockUser, 'workflow', 'read');
      
      // Second check (should be faster due to caching)
      const startTime = Date.now();
      const result2 = accessControlService.checkAccess(mockUser, 'workflow', 'read');
      const endTime = Date.now();

      expect(result1.allowed).toBe(result2.allowed);
      expect(endTime - startTime).toBeLessThan(10); // Should be very fast due to caching
    });
  });
});