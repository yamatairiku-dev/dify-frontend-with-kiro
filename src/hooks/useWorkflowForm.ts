import { useState, useCallback, useEffect } from 'react';
import { workflowExecutionService } from '../services/workflowExecutionService';
import type {
  WorkflowInput,
  JSONSchema,
  DifyWorkflow,
} from '../types/dify';
import type { ValidationResult, ValidationError } from '../services/workflowExecutionService';

/**
 * Custom hook for workflow form handling with validation and submission
 * Implements form state management, validation, and API integration for SPA mode
 */

// Form field configuration
export interface FormField {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  label: string;
  description?: string;
  required: boolean;
  validation?: {
    minLength?: number;
    maxLength?: number;
    minimum?: number;
    maximum?: number;
    pattern?: string;
    enum?: string[];
  };
  defaultValue?: any;
}

// Form state interface
export interface WorkflowFormState {
  values: WorkflowInput;
  errors: Record<string, string>;
  touched: Record<string, boolean>;
  isValid: boolean;
  isSubmitting: boolean;
  submitError: string | null;
  submitResult: any;
}

// Form actions interface
export interface WorkflowFormActions {
  setValue: (field: string, value: any) => void;
  setValues: (values: WorkflowInput) => void;
  setFieldTouched: (field: string, touched?: boolean) => void;
  setFieldError: (field: string, error: string) => void;
  clearFieldError: (field: string) => void;
  clearAllErrors: () => void;
  validateField: (field: string) => string | null;
  validateForm: () => boolean;
  handleSubmit: (onSubmit?: (values: WorkflowInput) => Promise<any>) => Promise<void>;
  reset: () => void;
}

// Combined hook return type
export interface UseWorkflowFormReturn extends WorkflowFormState, WorkflowFormActions {
  fields: FormField[];
}

/**
 * Hook for managing workflow form state and validation
 */
export function useWorkflowForm(
  workflow: DifyWorkflow | null,
  initialValues: WorkflowInput = {}
): UseWorkflowFormReturn {
  // Form state
  const [values, setValues] = useState<WorkflowInput>(initialValues);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitResult, setSubmitResult] = useState<any>(null);

  // Generate form fields from workflow schema
  const fields: FormField[] = workflow?.inputSchema ? 
    generateFormFields(workflow.inputSchema) : [];

  // Validate individual field
  const validateField = useCallback((field: string): string | null => {
    if (!workflow?.inputSchema) return null;

    const value = getNestedValue(values, field);
    const fieldSchema = getFieldSchema(workflow.inputSchema, field);
    
    if (!fieldSchema) return null;

    // Check required fields
    if (workflow.inputSchema.required?.includes(field.split('.')[0])) {
      if (value === undefined || value === null || value === '') {
        return `${field} is required`;
      }
    }

    // Type validation
    const expectedType = fieldSchema.type;
    const actualType = Array.isArray(value) ? 'array' : typeof value;
    
    if (value !== undefined && value !== null && value !== '' && expectedType !== actualType) {
      return `Expected ${expectedType} but got ${actualType}`;
    }

    // String validations
    if (fieldSchema.type === 'string' && typeof value === 'string') {
      if ((fieldSchema as any).minLength && value.length < (fieldSchema as any).minLength) {
        return `Must be at least ${(fieldSchema as any).minLength} characters`;
      }
      if ((fieldSchema as any).maxLength && value.length > (fieldSchema as any).maxLength) {
        return `Must be at most ${(fieldSchema as any).maxLength} characters`;
      }
      if ((fieldSchema as any).pattern && !new RegExp((fieldSchema as any).pattern).test(value)) {
        return `Invalid format`;
      }
    }

    // Number validations
    if (fieldSchema.type === 'number' && typeof value === 'number') {
      if ((fieldSchema as any).minimum !== undefined && value < (fieldSchema as any).minimum) {
        return `Must be at least ${(fieldSchema as any).minimum}`;
      }
      if ((fieldSchema as any).maximum !== undefined && value > (fieldSchema as any).maximum) {
        return `Must be at most ${(fieldSchema as any).maximum}`;
      }
    }

    // Enum validation
    if ((fieldSchema as any).enum && value !== undefined && value !== null && value !== '' && !(fieldSchema as any).enum.includes(value)) {
      return `Must be one of: ${(fieldSchema as any).enum.join(', ')}`;
    }

    return null;
  }, [workflow, values]);

  // Validate entire form
  const validateForm = useCallback((): boolean => {
    if (!workflow?.inputSchema) return false;

    const newErrors: Record<string, string> = {};
    let isValid = true;

    // Validate using workflow execution service
    const validationResult = workflowExecutionService.validateWorkflowInput(
      values,
      workflow.inputSchema
    );

    if (!validationResult.valid) {
      validationResult.errors.forEach((error: ValidationError) => {
        newErrors[error.field] = error.message;
        isValid = false;
      });
    }

    setErrors(newErrors);
    return isValid;
  }, [workflow, values]);

  // Form actions
  const setValue = useCallback((field: string, value: any) => {
    setValues(prev => setNestedValue(prev, field, value));
    
    // Clear field error when value changes
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  }, [errors]);

  const setFormValues = useCallback((newValues: WorkflowInput) => {
    setValues(newValues);
    setErrors({});
    setTouched({});
  }, []);

  const setFieldTouched = useCallback((field: string, isTouched = true) => {
    setTouched(prev => ({ ...prev, [field]: isTouched }));
    
    // Validate field when it becomes touched
    if (isTouched) {
      const fieldError = validateField(field);
      if (fieldError) {
        setErrors(prev => ({ ...prev, [field]: fieldError }));
      }
    }
  }, [validateField]);

  const setFieldError = useCallback((field: string, error: string) => {
    setErrors(prev => ({ ...prev, [field]: error }));
  }, []);

  const clearFieldError = useCallback((field: string) => {
    setErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[field];
      return newErrors;
    });
  }, []);

  const clearAllErrors = useCallback(() => {
    setErrors({});
    setSubmitError(null);
  }, []);

  const handleSubmit = useCallback(async (
    onSubmit?: (values: WorkflowInput) => Promise<any>
  ) => {
    setIsSubmitting(true);
    setSubmitError(null);
    setSubmitResult(null);

    try {
      // Mark all fields as touched
      const allFields = fields.map(field => field.name);
      const touchedState = allFields.reduce((acc, field) => {
        acc[field] = true;
        return acc;
      }, {} as Record<string, boolean>);
      setTouched(touchedState);

      // Validate form
      const isValid = validateForm();
      if (!isValid) {
        setSubmitError('Please fix the validation errors before submitting');
        return;
      }

      // Execute custom submit handler if provided
      if (onSubmit) {
        const result = await onSubmit(values);
        setSubmitResult(result);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Submission failed';
      setSubmitError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  }, [validateForm, values]);

  const reset = useCallback(() => {
    setValues(initialValues);
    setErrors({});
    setTouched({});
    setIsSubmitting(false);
    setSubmitError(null);
    setSubmitResult(null);
  }, [initialValues]);

  // Computed properties
  const isValid = Object.keys(errors).length === 0;

  // Update form when workflow changes
  useEffect(() => {
    if (workflow && Object.keys(values).length === 0) {
      // Initialize form with default values from schema
      const defaultValues = generateDefaultValues(workflow.inputSchema);
      setValues({ ...defaultValues, ...initialValues });
    }
  }, [workflow, initialValues, values]);

  return {
    // State
    values,
    errors,
    touched,
    isValid,
    isSubmitting,
    submitError,
    submitResult,
    fields,
    
    // Actions
    setValue,
    setValues: setFormValues,
    setFieldTouched,
    setFieldError,
    clearFieldError,
    clearAllErrors,
    validateField,
    validateForm,
    handleSubmit,
    reset,
  };
}

/**
 * Generate form fields from JSON schema
 */
function generateFormFields(schema: JSONSchema, prefix = ''): FormField[] {
  const fields: FormField[] = [];
  
  if (!schema.properties) return fields;

  Object.entries(schema.properties).forEach(([key, propSchema]) => {
    const fieldName = prefix ? `${prefix}.${key}` : key;
    const isRequired = schema.required?.includes(key) || false;

    if (propSchema.type === 'object' && propSchema.properties) {
      // Handle nested objects recursively
      const nestedFields = generateFormFields(propSchema, fieldName);
      fields.push(...nestedFields);
    } else {
      fields.push({
        name: fieldName,
        type: propSchema.type as FormField['type'],
        label: (propSchema as any).title || key,
        description: propSchema.description,
        required: isRequired,
        validation: {
          minLength: propSchema.minLength,
          maxLength: propSchema.maxLength,
          minimum: propSchema.minimum,
          maximum: propSchema.maximum,
          pattern: propSchema.pattern,
          enum: propSchema.enum,
        },
      });
    }
  });

  return fields;
}

/**
 * Generate default values from JSON schema
 */
function generateDefaultValues(schema: JSONSchema): WorkflowInput {
  const defaults: WorkflowInput = {};
  
  if (!schema.properties) return defaults;

  Object.entries(schema.properties).forEach(([key, propSchema]) => {
    if (propSchema.type === 'boolean') {
      defaults[key] = false;
    } else if (propSchema.type === 'number') {
      defaults[key] = propSchema.minimum || 0;
    } else if (propSchema.type === 'string') {
      if (propSchema.enum && propSchema.enum.length > 0) {
        defaults[key] = propSchema.enum[0];
      } else {
        defaults[key] = '';
      }
    } else if (propSchema.type === 'array') {
      defaults[key] = [];
    } else if (propSchema.type === 'object' && propSchema.properties) {
      defaults[key] = generateDefaultValues(propSchema);
    }
  });

  return defaults;
}

/**
 * Get nested value from object using dot notation
 */
function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => {
    return current && current[key] !== undefined ? current[key] : undefined;
  }, obj);
}

/**
 * Set nested value in object using dot notation
 */
function setNestedValue(obj: any, path: string, value: any): any {
  const keys = path.split('.');
  const result = { ...obj };
  
  let current = result;
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (!current[key] || typeof current[key] !== 'object') {
      current[key] = {};
    } else {
      current[key] = { ...current[key] };
    }
    current = current[key];
  }
  
  current[keys[keys.length - 1]] = value;
  return result;
}

/**
 * Get field schema from JSON schema using dot notation path
 */
function getFieldSchema(schema: JSONSchema, path: string): any {
  const keys = path.split('.');
  let current = schema;
  
  for (const key of keys) {
    if (current.properties && current.properties[key]) {
      current = current.properties[key];
    } else {
      return null;
    }
  }
  
  return current;
}

/**
 * Hook for managing multiple forms (batch operations)
 */
export function useMultipleWorkflowForms(workflows: DifyWorkflow[]) {
  const [activeForms, setActiveForms] = useState<Record<string, UseWorkflowFormReturn>>({});
  
  const createForm = useCallback((workflowId: string, initialValues?: WorkflowInput) => {
    const workflow = workflows.find(w => w.id === workflowId);
    if (!workflow) return null;
    
    // This would need to be implemented with a form factory pattern
    // For now, return a placeholder
    return null;
  }, [workflows]);
  
  const removeForm = useCallback((workflowId: string) => {
    setActiveForms(prev => {
      const newForms = { ...prev };
      delete newForms[workflowId];
      return newForms;
    });
  }, []);
  
  const submitAllForms = useCallback(async () => {
    const results = await Promise.allSettled(
      Object.values(activeForms).map(form => 
        form.handleSubmit()
      )
    );
    
    return results;
  }, [activeForms]);
  
  return {
    activeForms,
    createForm,
    removeForm,
    submitAllForms,
  };
}