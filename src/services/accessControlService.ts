import { User, Permission, AccessCondition } from '../types/auth';

/**
 * Dify workflow interface for access control
 */
export interface DifyWorkflow {
  id: string;
  name: string;
  description: string;
  requiredPermissions: string[];
  allowedDomains?: string[];
  allowedRoles?: string[];
  inputSchema?: any;
  outputSchema?: any;
}

/**
 * Domain-based service mapping configuration
 */
export interface DomainServiceMapping {
  domain: string;
  allowedServices: string[];
  defaultPermissions: Permission[];
  roleBasedPermissions?: Record<string, Permission[]>;
}

/**
 * Access control configuration
 */
export interface AccessControlConfig {
  domainMappings: DomainServiceMapping[];
  globalPermissions: Permission[];
  workflows: DifyWorkflow[];
}

/**
 * Access control result
 */
export interface AccessResult {
  allowed: boolean;
  reason?: string;
  requiredPermissions?: string[];
  missingConditions?: AccessCondition[];
}

/**
 * Service for managing access control and permissions
 */
export class AccessControlService {
  private config: AccessControlConfig;

  constructor(config?: AccessControlConfig) {
    this.config = config || this.getDefaultConfig();
  }

  /**
   * Check if user has access to a specific resource and action
   */
  checkAccess(user: User, resource: string, action: string): AccessResult {
    // Check if user has any permissions for this resource
    const relevantPermissions = user.permissions.filter(
      permission => permission.resource === resource || permission.resource === '*'
    );

    if (relevantPermissions.length === 0) {
      return {
        allowed: false,
        reason: `No permissions found for resource: ${resource}`,
        requiredPermissions: [resource],
      };
    }

    // Check if any permission allows the requested action
    for (const permission of relevantPermissions) {
      if (permission.actions.includes(action) || permission.actions.includes('*')) {
        // Check conditions if they exist
        if (permission.conditions && permission.conditions.length > 0) {
          const conditionResult = this.evaluateConditions(user, permission.conditions);
          if (!conditionResult.allowed) {
            return {
              allowed: false,
              reason: `Access denied due to unmet conditions for resource: ${resource}`,
              missingConditions: conditionResult.missingConditions,
            };
          }
        }
        
        return { allowed: true };
      }
    }

    return {
      allowed: false,
      reason: `Action '${action}' not allowed for resource: ${resource}`,
      requiredPermissions: [`${resource}:${action}`],
    };
  }

  /**
   * Get available workflows for a user based on their permissions and attributes
   */
  getAvailableWorkflows(user: User): DifyWorkflow[] {
    return this.config.workflows.filter(workflow => {
      // Check domain restrictions
      if (workflow.allowedDomains && workflow.allowedDomains.length > 0) {
        if (!workflow.allowedDomains.includes(user.attributes.domain)) {
          return false;
        }
      }

      // Check role restrictions
      if (workflow.allowedRoles && workflow.allowedRoles.length > 0) {
        const hasRequiredRole = workflow.allowedRoles.some(role =>
          user.attributes.roles.includes(role)
        );
        if (!hasRequiredRole) {
          return false;
        }
      }

      // Check required permissions
      if (workflow.requiredPermissions && workflow.requiredPermissions.length > 0) {
        return workflow.requiredPermissions.every(requiredPermission => {
          const [resource, action] = requiredPermission.split(':');
          return this.checkAccess(user, resource, action).allowed;
        });
      }

      return true;
    });
  }

  /**
   * Update user permissions based on their attributes and domain mappings
   */
  updateUserPermissions(user: User): User {
    const domainMapping = this.getDomainMapping(user.attributes.domain);
    
    if (!domainMapping) {
      // No specific mapping found, use global permissions only
      return {
        ...user,
        permissions: [...this.config.globalPermissions],
      };
    }

    // Start with default permissions for the domain
    let permissions = [...domainMapping.defaultPermissions];

    // Add role-based permissions if available
    if (domainMapping.roleBasedPermissions) {
      for (const role of user.attributes.roles) {
        const rolePermissions = domainMapping.roleBasedPermissions[role];
        if (rolePermissions) {
          permissions = [...permissions, ...rolePermissions];
        }
      }
    }

    // Add global permissions
    permissions = [...permissions, ...this.config.globalPermissions];

    // Remove duplicates based on resource and actions
    const uniquePermissions = this.deduplicatePermissions(permissions);

    return {
      ...user,
      permissions: uniquePermissions,
    };
  }

  /**
   * Add or update domain service mapping
   */
  updateDomainMapping(mapping: DomainServiceMapping): void {
    const existingIndex = this.config.domainMappings.findIndex(
      m => m.domain === mapping.domain
    );

    if (existingIndex >= 0) {
      this.config.domainMappings[existingIndex] = mapping;
    } else {
      this.config.domainMappings.push(mapping);
    }
  }

  /**
   * Add or update workflow configuration
   */
  updateWorkflow(workflow: DifyWorkflow): void {
    const existingIndex = this.config.workflows.findIndex(
      w => w.id === workflow.id
    );

    if (existingIndex >= 0) {
      this.config.workflows[existingIndex] = workflow;
    } else {
      this.config.workflows.push(workflow);
    }
  }

  /**
   * Get services available to a user based on their domain
   */
  getAvailableServices(user: User): string[] {
    const domainMapping = this.getDomainMapping(user.attributes.domain);
    return domainMapping ? domainMapping.allowedServices : [];
  }

  /**
   * Check if user can access a specific service
   */
  canAccessService(user: User, serviceName: string): boolean {
    const availableServices = this.getAvailableServices(user);
    return availableServices.includes(serviceName) || availableServices.includes('*');
  }

  /**
   * Evaluate access conditions against user attributes
   */
  private evaluateConditions(
    user: User,
    conditions: AccessCondition[]
  ): { allowed: boolean; missingConditions?: AccessCondition[] } {
    const missingConditions: AccessCondition[] = [];

    for (const condition of conditions) {
      if (!this.evaluateCondition(user, condition)) {
        missingConditions.push(condition);
      }
    }

    return {
      allowed: missingConditions.length === 0,
      missingConditions: missingConditions.length > 0 ? missingConditions : undefined,
    };
  }

  /**
   * Evaluate a single access condition
   */
  private evaluateCondition(user: User, condition: AccessCondition): boolean {
    const attributeValue = this.getAttributeValue(user, condition.attribute);

    if (attributeValue === undefined || attributeValue === null) {
      return false;
    }

    switch (condition.operator) {
      case 'equals':
        if (Array.isArray(condition.value)) {
          return condition.value.includes(String(attributeValue));
        }
        return String(attributeValue) === String(condition.value);

      case 'contains':
        if (Array.isArray(attributeValue)) {
          if (Array.isArray(condition.value)) {
            return condition.value.some(val => attributeValue.includes(val));
          }
          return attributeValue.includes(String(condition.value));
        }
        return String(attributeValue).includes(String(condition.value));

      case 'matches':
        const regex = new RegExp(String(condition.value));
        return regex.test(String(attributeValue));

      default:
        return false;
    }
  }

  /**
   * Get attribute value from user using dot notation
   */
  private getAttributeValue(user: User, attributePath: string): any {
    const parts = attributePath.split('.');
    let value: any = user;

    for (const part of parts) {
      if (value && typeof value === 'object' && part in value) {
        value = value[part];
      } else {
        return undefined;
      }
    }

    return value;
  }

  /**
   * Get domain mapping for a specific domain
   */
  private getDomainMapping(domain: string): DomainServiceMapping | undefined {
    return this.config.domainMappings.find(mapping => mapping.domain === domain);
  }

  /**
   * Remove duplicate permissions based on resource and actions
   */
  private deduplicatePermissions(permissions: Permission[]): Permission[] {
    const permissionMap = new Map<string, Permission>();

    for (const permission of permissions) {
      const key = permission.resource;
      const existing = permissionMap.get(key);

      if (existing) {
        // Merge actions and conditions
        const mergedActions = Array.from(new Set([...existing.actions, ...permission.actions]));
        const mergedConditions = [
          ...(existing.conditions || []),
          ...(permission.conditions || []),
        ];

        permissionMap.set(key, {
          resource: permission.resource,
          actions: mergedActions,
          conditions: mergedConditions.length > 0 ? mergedConditions : undefined,
        });
      } else {
        permissionMap.set(key, permission);
      }
    }

    return Array.from(permissionMap.values());
  }

  /**
   * Get default access control configuration
   */
  private getDefaultConfig(): AccessControlConfig {
    return {
      domainMappings: [
        {
          domain: 'example.com',
          allowedServices: ['dify-workflow', 'analytics'],
          defaultPermissions: [
            {
              resource: 'workflow',
              actions: ['read', 'execute'],
            },
          ],
          roleBasedPermissions: {
            admin: [
              {
                resource: 'workflow',
                actions: ['*'],
              },
              {
                resource: 'user',
                actions: ['read', 'update'],
              },
            ],
            developer: [
              {
                resource: 'workflow',
                actions: ['read', 'execute', 'create'],
              },
            ],
          },
        },
        {
          domain: 'company.org',
          allowedServices: ['dify-workflow'],
          defaultPermissions: [
            {
              resource: 'workflow',
              actions: ['read'],
              conditions: [
                {
                  attribute: 'attributes.department',
                  operator: 'equals',
                  value: ['engineering', 'product'],
                },
              ],
            },
          ],
        },
      ],
      globalPermissions: [
        {
          resource: 'profile',
          actions: ['read', 'update'],
        },
      ],
      workflows: [
        {
          id: 'text-analysis',
          name: 'Text Analysis Workflow',
          description: 'Analyze text content for sentiment and keywords',
          requiredPermissions: ['workflow:execute'],
          allowedDomains: ['example.com', 'company.org'],
          allowedRoles: ['developer', 'analyst', 'admin'],
        },
        {
          id: 'data-processing',
          name: 'Data Processing Workflow',
          description: 'Process and transform data files',
          requiredPermissions: ['workflow:execute', 'data:read'],
          allowedDomains: ['example.com'],
          allowedRoles: ['admin', 'data_engineer'],
        },
      ],
    };
  }

  /**
   * Get current configuration (for testing and debugging)
   */
  getConfig(): AccessControlConfig {
    return { ...this.config };
  }

  /**
   * Update entire configuration (for testing and advanced use cases)
   */
  updateConfig(config: AccessControlConfig): void {
    this.config = config;
  }
}

export const accessControlService = new AccessControlService();