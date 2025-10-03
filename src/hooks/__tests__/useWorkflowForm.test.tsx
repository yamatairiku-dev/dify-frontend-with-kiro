import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { useWorkflowForm } from '../useWorkflowForm';
import { workflowExecutionService } from '../../services/workflowExecutionService';
import type { DifyWorkflow, WorkflowInput } from '../../types/dify';

// Mock dependencies
jest.mock('../../services/workflowExecutionService');

const mockWorkflowExecutionService = workflowExecutionService as jest.Mocked<typeof workflowExecutionService>;

// Mock workflow data
const mockWorkflow: DifyWorkflow = {
  id: 'workflow-1',
  name: 'Test Workflow',
  description: 'Test workflow description',
  inputSchema: {
    type: 'object',
    properties: {
      text: {
        type: 'string',
        description: 'The text to process',
        minLength: 1,
        maxLength: 1000,
      },
      language: {
        type: 'string',
        description: 'Processing language',
        enum: ['en', 'es', 'fr', 'de'],
      },
      detailed: {
        type: 'boolean',
        description: 'Include detailed analysis',
      },
      count: {
        type: 'number',
        description: 'Number of items',
        minimum: 1,
        maximum: 100,
      },
    },
    required: ['text'],
  },
  outputSchema: {
    type: 'object',
    properties: {
      result: { type: 'string' }
    }
  },
  requiredPermissions: ['workflow:execute'],
};

describe('useWorkflowForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should initialize form with default values', () => {
    const { result } = renderHook(() => useWorkflowForm(mockWorkflow));

    expect(result.current.values).toEqual({
      text: '',
      language: 'en',
      detailed: false,
      count: 1,
    });
    expect(result.current.errors).toEqual({});
    expect(result.current.touched).toEqual({});
    expect(result.current.isSubmitting).toBe(false);
    expect(result.current.fields).toHaveLength(4);
  });

  it('should generate correct form fields from schema', () => {
    const { result } = renderHook(() => useWorkflowForm(mockWorkflow));

    const fields = result.current.fields;
    
    expect(fields[0]).toEqual({
      name: 'text',
      type: 'string',
      label: 'text',
      description: 'The text to process',
      required: true,
      validation: {
        minLength: 1,
        maxLength: 1000,
        minimum: undefined,
        maximum: undefined,
        pattern: undefined,
        enum: undefined,
      },
    });

    expect(fields[1]).toEqual({
      name: 'language',
      type: 'string',
      label: 'language',
      description: 'Processing language',
      required: false,
      validation: {
        minLength: undefined,
        maxLength: undefined,
        minimum: undefined,
        maximum: undefined,
        pattern: undefined,
        enum: ['en', 'es', 'fr', 'de'],
      },
    });

    expect(fields[2]).toEqual({
      name: 'detailed',
      type: 'boolean',
      label: 'detailed',
      description: 'Include detailed analysis',
      required: false,
      validation: {
        minLength: undefined,
        maxLength: undefined,
        minimum: undefined,
        maximum: undefined,
        pattern: undefined,
        enum: undefined,
      },
    });

    expect(fields[3]).toEqual({
      name: 'count',
      type: 'number',
      label: 'count',
      description: 'Number of items',
      required: false,
      validation: {
        minLength: undefined,
        maxLength: undefined,
        minimum: 1,
        maximum: 100,
        pattern: undefined,
        enum: undefined,
      },
    });
  });

  it('should handle value changes', () => {
    const { result } = renderHook(() => useWorkflowForm(mockWorkflow));

    act(() => {
      result.current.setValue('text', 'Hello world');
    });

    expect(result.current.values['text']).toBe('Hello world');
  });

  it('should handle nested value changes', () => {
    const nestedWorkflow: DifyWorkflow = {
      ...mockWorkflow,
      inputSchema: {
        type: 'object',
        properties: {
          config: {
            type: 'object',
            properties: {
              language: { type: 'string' },
              detailed: { type: 'boolean' },
            },
          },
        },
      },
    };

    const { result } = renderHook(() => useWorkflowForm(nestedWorkflow));

    act(() => {
      result.current.setValue('config.language', 'es');
    });

    expect(result.current.values['config']?.language).toBe('es');
  });

  it('should validate required fields', () => {
    mockWorkflowExecutionService.validateWorkflowInput.mockReturnValue({
      valid: false,
      errors: [
        {
          field: 'text',
          message: 'Required field \'text\' is missing',
        },
      ],
    });

    const { result } = renderHook(() => useWorkflowForm(mockWorkflow));

    act(() => {
      const isValid = result.current.validateForm();
      expect(isValid).toBe(false);
    });

    expect(result.current.errors['text']).toBe('Required field \'text\' is missing');
  });

  it('should validate field constraints', () => {
    const { result } = renderHook(() => useWorkflowForm(mockWorkflow));

    // Test string length validation
    act(() => {
      result.current.setValue('text', '');
      const error = result.current.validateField('text');
      expect(error).toBe('text is required');
    });

    // Test enum validation
    act(() => {
      result.current.setValue('language', 'invalid');
      const error = result.current.validateField('language');
      expect(error).toBe('Must be one of: en, es, fr, de');
    });

    // Test number range validation
    act(() => {
      result.current.setValue('count', 150);
    });
    
    act(() => {
      const error = result.current.validateField('count');
      expect(error).toBe('Must be at most 100');
    });
  });

  it('should handle form submission', async () => {
    mockWorkflowExecutionService.validateWorkflowInput.mockReturnValue({
      valid: true,
      errors: [],
    });

    const mockSubmit = jest.fn().mockResolvedValue({ success: true });
    const { result } = renderHook(() => useWorkflowForm(mockWorkflow));

    act(() => {
      result.current.setValue('text', 'Hello world');
    });

    await act(async () => {
      await result.current.handleSubmit(mockSubmit);
    });

    expect(mockSubmit).toHaveBeenCalledWith({
      text: 'Hello world',
      language: 'en',
      detailed: false,
      count: 1,
    });
    expect(result.current.submitResult).toEqual({ success: true });
    expect(result.current.submitError).toBe(null);
  });

  it('should handle form submission errors', async () => {
    mockWorkflowExecutionService.validateWorkflowInput.mockReturnValue({
      valid: true,
      errors: [],
    });

    const mockSubmit = jest.fn().mockRejectedValue(new Error('Submission failed'));
    const { result } = renderHook(() => useWorkflowForm(mockWorkflow));

    act(() => {
      result.current.setValue('text', 'Hello world');
    });

    await act(async () => {
      await result.current.handleSubmit(mockSubmit);
    });

    expect(result.current.submitError).toBe('Submission failed');
    expect(result.current.submitResult).toBe(null);
  });

  it('should prevent submission with validation errors', async () => {
    mockWorkflowExecutionService.validateWorkflowInput.mockReturnValue({
      valid: false,
      errors: [
        {
          field: 'text',
          message: 'Required field \'text\' is missing',
        },
      ],
    });

    const mockSubmit = jest.fn();
    const { result } = renderHook(() => useWorkflowForm(mockWorkflow));

    await act(async () => {
      await result.current.handleSubmit(mockSubmit);
    });

    expect(mockSubmit).not.toHaveBeenCalled();
    expect(result.current.submitError).toBe('Please fix the validation errors before submitting');
  });

  it('should handle field touched state', () => {
    const { result } = renderHook(() => useWorkflowForm(mockWorkflow));

    act(() => {
      result.current.setFieldTouched('text', true);
    });

    expect(result.current.touched['text']).toBe(true);
  });

  it('should clear field errors', () => {
    const { result } = renderHook(() => useWorkflowForm(mockWorkflow));

    act(() => {
      result.current.setFieldError('text', 'Test error');
    });

    expect(result.current.errors['text']).toBe('Test error');

    act(() => {
      result.current.clearFieldError('text');
    });

    expect(result.current.errors['text']).toBeUndefined();
  });

  it('should clear all errors', () => {
    const { result } = renderHook(() => useWorkflowForm(mockWorkflow));

    act(() => {
      result.current.setFieldError('text', 'Test error 1');
      result.current.setFieldError('language', 'Test error 2');
    });

    expect(Object.keys(result.current.errors)).toHaveLength(2);

    act(() => {
      result.current.clearAllErrors();
    });

    expect(result.current.errors).toEqual({});
    expect(result.current.submitError).toBe(null);
  });

  it('should reset form to initial state', () => {
    const initialValues = { text: 'Initial text' };
    const { result } = renderHook(() => useWorkflowForm(mockWorkflow, initialValues));

    act(() => {
      result.current.setValue('text', 'Changed text');
      result.current.setFieldError('text', 'Test error');
      result.current.setFieldTouched('text', true);
    });

    act(() => {
      result.current.reset();
    });

    expect(result.current.values).toEqual(initialValues);
    expect(result.current.errors).toEqual({});
    expect(result.current.touched).toEqual({});
    expect(result.current.isSubmitting).toBe(false);
    expect(result.current.submitError).toBe(null);
    expect(result.current.submitResult).toBe(null);
  });

  it('should handle null workflow', () => {
    const { result } = renderHook(() => useWorkflowForm(null));

    expect(result.current.fields).toEqual([]);
    expect(result.current.values).toEqual({});
    expect(result.current.isValid).toBe(true);
  });

  // TODO: Fix type issues with renderHook rerender function
  // it('should handle workflow changes', () => {
  //   const { result, rerender } = renderHook(
  //     ({ workflow }: { workflow: DifyWorkflow | null }) => useWorkflowForm(workflow),
  //     { initialProps: { workflow: mockWorkflow } }
  //   );

  //   expect(result.current.fields).toHaveLength(4);

  //   const newWorkflow: DifyWorkflow = {
  //     ...mockWorkflow,
  //     inputSchema: {
  //       type: 'object',
  //       properties: {
  //         data: { type: 'string' },
  //       },
  //       required: ['data'],
  //     },
  //   };

  //   rerender({ workflow: newWorkflow });

  //   expect(result.current.fields).toHaveLength(1);
  //   expect(result.current.fields[0].name).toBe('data');
  // });

  // it('should update values when workflow changes', () => {
  //   const { result, rerender } = renderHook(
  //     ({ workflow }: { workflow: DifyWorkflow | null }) => useWorkflowForm(workflow),
  //     { initialProps: { workflow: null } }
  //   );

  //   expect(result.current.values).toEqual({});

  //   rerender({ workflow: mockWorkflow });

  //   expect(result.current.values).toEqual({
  //     text: '',
  //     language: 'en',
  //     detailed: false,
  //     count: 1,
  //   });
  // });
});