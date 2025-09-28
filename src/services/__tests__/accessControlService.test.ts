import { AccessControlService, DifyWorkflow, DomainServiceMapping, AccessControlConfig } from '../accessControlService';
import { User, Permission, AccessCondition } from '../../types/auth';

describe('AccessControlService', () => {
  let service: AccessControlService;
  let mockUser: User;
  let mockAdminUser: User;
  let mockExternalUser: User;

  beforeEach(() => {
    service = new AccessControlService();
    
    mockUser = {
      id: '1',
      email: 'user@example.com',
      name: 'Test User',
      provider: 'azure',
      attributes: {
        domain: 'example.com',
        roles: ['developer'],
        department: 'engineering',
        organization: 'Example Corp',
      },
      permissions: [
        {
          resource: 'workflow',
          actions: ['read', 'execute'],
        },
      ],
    };

    mockAdminUser = {
      id: '2',
      email: 'admin@example.com',
      name: 'Admin User',
      provider: 'azure',
      attributes: {
        domain: 'example.com',
        roles: ['admin', 'developer'],
        department: 'engineering',
        organization: 'Example Corp',
      },
      permissions: [
        {
          resource: 'workflow',
          actions: ['*'],
        },
        {
          resource: 'user',
          actions: ['read', 'update'],
        },
      ],
    };

    mockExternalUser = {
      id: '3',
      email: 'external@external.com',
      name: 'External User',
      provider: 'github',
      attributes: {
        domain: 'external.com',
        roles: ['user'],
      },
      permissions: [],
    };
  });

  describe('checkAccess', () => {
    it('should allow access when user has required permission', () => {
      const result = service.checkAccess(mockUser, 'workflow', 'read');
      
      expect(result.allowed).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should deny access when user lacks required permission', () => {
      const result = service.checkAccess(mockUser, 'workflow', 'delete');
      
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('not allowed');
      expect(result.requiredPermissions).toEqual(['workflow:delete']);
    });

    it('should deny access when user has no permissions for resource', () => {
      const result = service.checkAccess(mockUser, 'admin', 'read');
      
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('No permissions found');
      expect(result.requiredPermissions).toEqual(['admin']);
    });

    it('should allow access with wildcard resource permission', () => {
      const userWithWildcard = {
        ...mockUser,
        permissions: [
          {
            resource: '*',
            actions: ['read'],
          },
        ],
      };

      const result = service.checkAccess(userWithWildcard, 'anything', 'read');
      
      expect(result.allowed).toBe(true);
    });

    it('should allow access with wildcard action permission', () => {
      const result = service.checkAccess(mockAdminUser, 'workflow', 'delete');
      
      expect(result.allowed).toBe(true);
    });

    it('should evaluate conditions correctly', () => {
      const userWithConditions = {
        ...mockUser,
        permissions: [
          {
            resource: 'sensitive',
            actions: ['read'],
            conditions: [
              {
                attribute: 'attributes.department',
                operator: 'equals' as const,
                value: 'engineering',
              },
            ],
          },
        ],
      };

      const result = service.checkAccess(userWithConditions, 'sensitive', 'read');
      
      expect(result.allowed).toBe(true);
    });

    it('should deny access when conditions are not met', () => {
      const userWithConditions = {
        ...mockUser,
        attributes: {
          ...mockUser.attributes,
          department: 'marketing',
        },
        permissions: [
          {
            resource: 'sensitive',
            actions: ['read'],
            conditions: [
              {
                attribute: 'attributes.department',
                operator: 'equals' as const,
                value: 'engineering',
              },
            ],
          },
        ],
      };

      const result = service.checkAccess(userWithConditions, 'sensitive', 'read');
      
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('unmet conditions');
      expect(result.missingConditions).toHaveLength(1);
    });
  });

  describe('getAvailableWorkflows', () => {
    it('should return workflows available to user based on domain and roles', () => {
      const workflows = service.getAvailableWorkflows(mockUser);
      
      expect(workflows).toHaveLength(1);
      expect(workflows[0].id).toBe('text-analysis');
    });

    it('should return admin-only workflows for admin users', () => {
      // Add the required permission for data-processing workflow
      const adminUserWithDataPermission = {
        ...mockAdminUser,
        permissions: [
          ...mockAdminUser.permissions,
          {
            resource: 'data',
            actions: ['read'],
          },
        ],
      };
      
      const workflows = service.getAvailableWorkflows(adminUserWithDataPermission);
      
      expect(workflows).toHaveLength(2);
      expect(workflows.map(w => w.id)).toContain('data-processing');
    });

    it('should return empty array for users with no matching domain', () => {
      const workflows = service.getAvailableWorkflows(mockExternalUser);
      
      expect(workflows).toHaveLength(0);
    });

    it('should filter workflows by required permissions', () => {
      const userWithoutExecutePermission = {
        ...mockUser,
        permissions: [
          {
            resource: 'workflow',
            actions: ['read'], // missing 'execute'
          },
        ],
      };

      const workflows = service.getAvailableWorkflows(userWithoutExecutePermission);
      
      expect(workflows).toHaveLength(0);
    });
  });

  describe('updateUserPermissions', () => {
    it('should update user permissions based on domain mapping', () => {
      const updatedUser = service.updateUserPermissions(mockUser);
      
      // Should have workflow permission (merged from default + role-based) and profile permission (global)
      expect(updatedUser.permissions).toHaveLength(2);
      expect(updatedUser.permissions.some(p => p.resource === 'profile')).toBe(true);
      
      // Check that workflow permissions are merged correctly
      const workflowPermission = updatedUser.permissions.find(p => p.resource === 'workflow');
      expect(workflowPermission).toBeDefined();
      expect(workflowPermission?.actions).toEqual(expect.arrayContaining(['read', 'execute', 'create']));
    });

    it('should add role-based permissions for admin users', () => {
      const updatedUser = service.updateUserPermissions(mockAdminUser);
      
      const workflowPermission = updatedUser.permissions.find(p => p.resource === 'workflow');
      expect(workflowPermission?.actions).toContain('*');
    });

    it('should use global permissions only for unmapped domains', () => {
      const updatedUser = service.updateUserPermissions(mockExternalUser);
      
      expect(updatedUser.permissions).toHaveLength(1);
      expect(updatedUser.permissions[0].resource).toBe('profile');
    });

    it('should deduplicate permissions correctly', () => {
      const userWithDuplicateRoles = {
        ...mockUser,
        attributes: {
          ...mockUser.attributes,
          roles: ['developer', 'admin'], // both have workflow permissions
        },
      };

      const updatedUser = service.updateUserPermissions(userWithDuplicateRoles);
      
      const workflowPermissions = updatedUser.permissions.filter(p => p.resource === 'workflow');
      expect(workflowPermissions).toHaveLength(1);
      expect(workflowPermissions[0].actions).toContain('*');
    });
  });

  describe('getAvailableServices', () => {
    it('should return services for mapped domain', () => {
      const services = service.getAvailableServices(mockUser);
      
      expect(services).toEqual(['dify-workflow', 'analytics']);
    });

    it('should return empty array for unmapped domain', () => {
      const services = service.getAvailableServices(mockExternalUser);
      
      expect(services).toEqual([]);
    });
  });

  describe('canAccessService', () => {
    it('should allow access to mapped services', () => {
      const canAccess = service.canAccessService(mockUser, 'dify-workflow');
      
      expect(canAccess).toBe(true);
    });

    it('should deny access to unmapped services', () => {
      const canAccess = service.canAccessService(mockUser, 'restricted-service');
      
      expect(canAccess).toBe(false);
    });

    it('should allow access with wildcard service', () => {
      const config = service.getConfig();
      config.domainMappings[0].allowedServices = ['*'];
      service.updateConfig(config);

      const canAccess = service.canAccessService(mockUser, 'any-service');
      
      expect(canAccess).toBe(true);
    });
  });

  describe('updateDomainMapping', () => {
    it('should add new domain mapping', () => {
      const newMapping: DomainServiceMapping = {
        domain: 'newdomain.com',
        allowedServices: ['new-service'],
        defaultPermissions: [
          {
            resource: 'new-resource',
            actions: ['read'],
          },
        ],
      };

      service.updateDomainMapping(newMapping);
      
      const config = service.getConfig();
      expect(config.domainMappings).toHaveLength(3);
      expect(config.domainMappings[2]).toEqual(newMapping);
    });

    it('should update existing domain mapping', () => {
      const updatedMapping: DomainServiceMapping = {
        domain: 'example.com',
        allowedServices: ['updated-service'],
        defaultPermissions: [
          {
            resource: 'updated-resource',
            actions: ['read', 'write'],
          },
        ],
      };

      service.updateDomainMapping(updatedMapping);
      
      const config = service.getConfig();
      const exampleMapping = config.domainMappings.find(m => m.domain === 'example.com');
      expect(exampleMapping?.allowedServices).toEqual(['updated-service']);
    });
  });

  describe('updateWorkflow', () => {
    it('should add new workflow', () => {
      const newWorkflow: DifyWorkflow = {
        id: 'new-workflow',
        name: 'New Workflow',
        description: 'A new workflow',
        requiredPermissions: ['workflow:execute'],
      };

      service.updateWorkflow(newWorkflow);
      
      const config = service.getConfig();
      expect(config.workflows).toHaveLength(3);
      expect(config.workflows[2]).toEqual(newWorkflow);
    });

    it('should update existing workflow', () => {
      const updatedWorkflow: DifyWorkflow = {
        id: 'text-analysis',
        name: 'Updated Text Analysis',
        description: 'Updated description',
        requiredPermissions: ['workflow:read'],
      };

      service.updateWorkflow(updatedWorkflow);
      
      const config = service.getConfig();
      const textAnalysisWorkflow = config.workflows.find(w => w.id === 'text-analysis');
      expect(textAnalysisWorkflow?.name).toBe('Updated Text Analysis');
    });
  });

  describe('condition evaluation', () => {
    let userForConditions: User;

    beforeEach(() => {
      userForConditions = {
        ...mockUser,
        attributes: {
          domain: 'example.com',
          roles: ['developer', 'tester'],
          department: 'engineering',
          organization: 'Example Corp',
        },
      };
    });

    it('should evaluate equals condition with string value', () => {
      const permission: Permission = {
        resource: 'test',
        actions: ['read'],
        conditions: [
          {
            attribute: 'attributes.department',
            operator: 'equals',
            value: 'engineering',
          },
        ],
      };

      userForConditions.permissions = [permission];
      const result = service.checkAccess(userForConditions, 'test', 'read');
      
      expect(result.allowed).toBe(true);
    });

    it('should evaluate equals condition with array value', () => {
      const permission: Permission = {
        resource: 'test',
        actions: ['read'],
        conditions: [
          {
            attribute: 'attributes.department',
            operator: 'equals',
            value: ['engineering', 'product'],
          },
        ],
      };

      userForConditions.permissions = [permission];
      const result = service.checkAccess(userForConditions, 'test', 'read');
      
      expect(result.allowed).toBe(true);
    });

    it('should evaluate contains condition with array attribute', () => {
      const permission: Permission = {
        resource: 'test',
        actions: ['read'],
        conditions: [
          {
            attribute: 'attributes.roles',
            operator: 'contains',
            value: 'developer',
          },
        ],
      };

      userForConditions.permissions = [permission];
      const result = service.checkAccess(userForConditions, 'test', 'read');
      
      expect(result.allowed).toBe(true);
    });

    it('should evaluate contains condition with array value', () => {
      const permission: Permission = {
        resource: 'test',
        actions: ['read'],
        conditions: [
          {
            attribute: 'attributes.roles',
            operator: 'contains',
            value: ['admin', 'developer'],
          },
        ],
      };

      userForConditions.permissions = [permission];
      const result = service.checkAccess(userForConditions, 'test', 'read');
      
      expect(result.allowed).toBe(true);
    });

    it('should evaluate matches condition with regex', () => {
      const permission: Permission = {
        resource: 'test',
        actions: ['read'],
        conditions: [
          {
            attribute: 'email',
            operator: 'matches',
            value: '.*@example\\.com$',
          },
        ],
      };

      userForConditions.permissions = [permission];
      const result = service.checkAccess(userForConditions, 'test', 'read');
      
      expect(result.allowed).toBe(true);
    });

    it('should handle nested attribute paths', () => {
      const permission: Permission = {
        resource: 'test',
        actions: ['read'],
        conditions: [
          {
            attribute: 'attributes.domain',
            operator: 'equals',
            value: 'example.com',
          },
        ],
      };

      userForConditions.permissions = [permission];
      const result = service.checkAccess(userForConditions, 'test', 'read');
      
      expect(result.allowed).toBe(true);
    });

    it('should handle missing attributes gracefully', () => {
      const permission: Permission = {
        resource: 'test',
        actions: ['read'],
        conditions: [
          {
            attribute: 'attributes.nonexistent',
            operator: 'equals',
            value: 'anything',
          },
        ],
      };

      userForConditions.permissions = [permission];
      const result = service.checkAccess(userForConditions, 'test', 'read');
      
      expect(result.allowed).toBe(false);
      expect(result.missingConditions).toHaveLength(1);
    });
  });

  describe('permission deduplication', () => {
    it('should merge actions for same resource', () => {
      const config: AccessControlConfig = {
        domainMappings: [
          {
            domain: 'test.com',
            allowedServices: ['service1'],
            defaultPermissions: [
              {
                resource: 'workflow',
                actions: ['read'],
              },
            ],
            roleBasedPermissions: {
              developer: [
                {
                  resource: 'workflow',
                  actions: ['execute'],
                },
              ],
            },
          },
        ],
        globalPermissions: [
          {
            resource: 'workflow',
            actions: ['list'],
          },
        ],
        workflows: [],
      };

      const testService = new AccessControlService(config);
      const testUser = {
        ...mockUser,
        attributes: {
          ...mockUser.attributes,
          domain: 'test.com',
          roles: ['developer'],
        },
      };

      const updatedUser = testService.updateUserPermissions(testUser);
      
      const workflowPermissions = updatedUser.permissions.filter(p => p.resource === 'workflow');
      expect(workflowPermissions).toHaveLength(1);
      expect(workflowPermissions[0].actions).toEqual(expect.arrayContaining(['read', 'execute', 'list']));
    });
  });

  describe('configuration management', () => {
    it('should return current configuration', () => {
      const config = service.getConfig();
      
      expect(config).toHaveProperty('domainMappings');
      expect(config).toHaveProperty('globalPermissions');
      expect(config).toHaveProperty('workflows');
    });

    it('should update entire configuration', () => {
      const newConfig: AccessControlConfig = {
        domainMappings: [],
        globalPermissions: [],
        workflows: [],
      };

      service.updateConfig(newConfig);
      
      const config = service.getConfig();
      expect(config.domainMappings).toHaveLength(0);
      expect(config.globalPermissions).toHaveLength(0);
      expect(config.workflows).toHaveLength(0);
    });
  });
});