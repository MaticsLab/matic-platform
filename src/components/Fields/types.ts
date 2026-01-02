/**
 * Unified Field Renderer Types
 * 
 * This module provides a unified interface for rendering fields across all contexts:
 * - Table grid view
 * - Form/Portal input
 * - Review/display mode
 * - Inline editing
 */

import type { Field, FieldTypeRegistry, EffectiveFieldConfig } from '@/types/field-types';

/**
 * Safely convert a field label or description to a string.
 * Handles cases where the value might be an object (from translations)
 * to prevent React error #185 (Objects are not valid as a React child).
 */
export function safeFieldString(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') {
    // Handle translation objects with 'en' key or first available key
    const obj = value as Record<string, unknown>;
    if ('en' in obj && typeof obj.en === 'string') return obj.en;
    const firstKey = Object.keys(obj)[0];
    if (firstKey && typeof obj[firstKey] === 'string') return obj[firstKey] as string;
    return '';
  }
  return String(value);
}

/**
 * The rendering mode determines how a field is displayed
 */
export type FieldRenderMode = 
  | 'display'    // Read-only display (table cells, review)
  | 'edit'       // Inline editing (table cells)
  | 'form'       // Full form input with label, help text
  | 'compact'    // Compact display for cards/lists
  | 'preview';   // Preview in builder/editor

/**
 * The context where the field is being rendered
 */
export type FieldRenderContext = 
  | 'table'      // TableGridView
  | 'portal'     // Public portal form
  | 'form'       // Internal form view
  | 'review'     // Application review
  | 'builder'    // Portal/form builder
  | 'card'       // Kanban/gallery cards
  | 'filter';    // Filter dropdowns

/**
 * Props passed to all field renderers
 */
export interface FieldRendererProps {
  /** The field definition from table_fields */
  field: Field;
  
  /** The current value */
  value: any;
  
  /** Callback when value changes */
  onChange?: (value: any) => void;
  
  /** Rendering mode */
  mode: FieldRenderMode;
  
  /** Rendering context */
  context: FieldRenderContext;
  
  /** Whether the field is disabled */
  disabled?: boolean;
  
  /** Whether the field is required */
  required?: boolean;
  
  /** Merged configuration (registry defaults + instance config) */
  config: Record<string, any>;
  
  /** View-specific configuration overrides */
  viewConfig?: Record<string, any>;
  
  /** Validation errors */
  error?: string;
  
  /** Custom class name */
  className?: string;
  
  /** Placeholder text */
  placeholder?: string;
  
  /** For container fields - child field definitions */
  childFields?: Field[];
  
  /** For container fields - child field values */
  childValues?: Record<string, any>[];
  
  /** Callback when child values change (for repeaters) */
  onChildChange?: (index: number, fieldName: string, value: any) => void;
  
  /** For link fields - workspace context */
  workspaceId?: string;
  
  /** The full field type registry entry */
  fieldType?: FieldTypeRegistry;
  
  /** For recommendation fields - form ID */
  formId?: string;
  
  /** For recommendation fields - submission ID (row ID) */
  submissionId?: string;
}

/**
 * Interface that all field renderer components must implement
 */
export interface FieldRendererComponent {
  (props: FieldRendererProps): React.ReactElement | null;
}

/**
 * Registry entry for a field renderer
 */
export interface FieldRendererRegistryEntry {
  /** The field type ID this renderer handles */
  typeId: string;
  
  /** The renderer component */
  component: React.LazyExoticComponent<FieldRendererComponent> | FieldRendererComponent;
  
  /** Whether this renderer supports inline editing */
  supportsInlineEdit: boolean;
  
  /** Default width for table columns */
  defaultWidth: number;
  
  /** Whether to show label in form mode */
  showLabel: boolean;
}

/**
 * Configuration for merging field configs
 */
export interface MergedFieldConfig {
  /** Registry default config */
  defaults: Record<string, any>;
  
  /** Instance-level overrides */
  instance: Record<string, any>;
  
  /** View-level overrides */
  view: Record<string, any>;
  
  /** Final merged config */
  effective: Record<string, any>;
}
