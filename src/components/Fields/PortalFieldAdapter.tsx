/**
 * Portal Field Adapter
 * 
 * Bridges the portal Field type (from @/types/portal) to the unified FieldRenderer system.
 * This allows gradual migration of portal forms to use the unified field rendering.
 */

'use client';

import React from 'react';
import { FieldRenderer } from '@/components/Fields';
import type { FieldRendererProps, FieldRenderMode } from '@/components/Fields/types';
import type { Field } from '@/types/field-types';
import type { Field as PortalField } from '@/types/portal';

interface PortalFieldAdapterProps {
  /** Portal field definition */
  field: PortalField;
  /** Current field value */
  value: unknown;
  /** Change handler */
  onChange: (value: unknown) => void;
  /** Render mode - defaults to 'form' */
  mode?: FieldRenderMode;
  /** Optional theme color for styling */
  themeColor?: string;
  /** Whether field is disabled */
  disabled?: boolean;
  /** All fields for cross-field references (e.g., rank field source) */
  allFields?: PortalField[];
  /** All form data for dynamic options */
  formData?: Record<string, unknown>;
  /** Form ID for file uploads */
  formId?: string;
  /** Hide the label (when label is rendered separately) */
  hideLabel?: boolean;
}

/**
 * Maps portal field types to unified field_type_id values
 */
const PORTAL_TO_UNIFIED_TYPE: Record<string, string> = {
  // Text inputs
  text: 'text',
  textarea: 'long_text',
  email: 'email',
  phone: 'phone',
  url: 'url',
  
  // Numbers
  number: 'number',
  
  // Selection
  select: 'select',
  multiselect: 'multiselect',
  radio: 'radio',
  checkbox: 'checkbox',
  rank: 'rank',
  
  // Date/Time
  date: 'date',
  datetime: 'datetime',
  time: 'time',
  
  // Files
  file: 'file',
  image: 'image',
  signature: 'signature',
  
  // Special
  rating: 'rating',
  address: 'address',
  
  // Layout (map directly to layout types)
  divider: 'divider',
  heading: 'heading',
  paragraph: 'paragraph',
  callout: 'callout',
  
  // Containers
  group: 'group',
  repeater: 'repeater',
};

/**
 * Converts a portal Field to a Field definition for the unified renderer
 */
function portalFieldToDefinition(portalField: PortalField): Field {
  const fieldTypeId = PORTAL_TO_UNIFIED_TYPE[portalField.type] || 'text';
  
  return {
    id: portalField.id,
    table_id: '',  // Not applicable for portal fields
    field_type_id: fieldTypeId,
    type: portalField.type,  // Keep original for legacy compat
    name: portalField.id,
    label: portalField.label,
    description: portalField.description || portalField.placeholder,
    position: 0,
    width: 200,
    is_visible: true,
    is_primary: false,
    is_searchable: false,
    config: {
      // Preserve portal-specific config
      ...portalField.config,
      // Map options if present
      options: portalField.options?.map(opt => ({ value: opt, label: opt })),
      // Preserve original portal type for special handling
      portal_type: portalField.type,
      // Width mapping
      width: portalField.width,
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

/**
 * Adapter component that renders portal fields using the unified FieldRenderer
 * 
 * Usage:
 * ```tsx
 * <PortalFieldAdapter
 *   field={portalField}
 *   value={formData[portalField.id]}
 *   onChange={(val) => setFormData(prev => ({ ...prev, [portalField.id]: val }))}
 * />
 * ```
 */
export function PortalFieldAdapter({
  field,
  value,
  onChange,
  mode = 'form',
  themeColor,
  disabled = false,
  allFields,
  formData,
  formId,
  hideLabel = false,
}: PortalFieldAdapterProps): React.ReactElement | null {
  // Convert portal field to unified definition
  const fieldDefinition = portalFieldToDefinition(field);
  
  // Build view config with additional context
  const viewConfig = {
    themeColor,
    formId,
    hideLabel,
    // Include form context for cross-field references
    _formData: formData,
    _allFields: allFields?.map(portalFieldToDefinition),
  };

  // Handle group fields - render children in a grid layout
  if (field.type === 'group' && field.children && field.children.length > 0) {
    const columns = field.config?.columns || 2;
    const groupValue = (value as Record<string, unknown>) || {};
    
    return (
      <div className="rounded-lg border border-gray-200 p-4">
        {field.label && (
          <h4 className="font-medium text-gray-900 mb-3">{field.label}</h4>
        )}
        {field.description && (
          <p className="text-sm text-gray-500 mb-4">{field.description}</p>
        )}
        <div className={`grid gap-4 grid-cols-${columns}`} style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
          {field.children.map((child) => (
            <PortalFieldAdapter
              key={child.id}
              field={child}
              value={groupValue[child.id]}
              onChange={(val) => {
                onChange({ ...groupValue, [child.id]: val });
              }}
              mode={mode}
              themeColor={themeColor}
              disabled={disabled}
              allFields={allFields}
              formData={formData}
              formId={formId}
            />
          ))}
        </div>
      </div>
    );
  }

  // Handle repeater fields - render an array of child field sets
  if (field.type === 'repeater' && field.children && field.children.length > 0) {
    const items = Array.isArray(value) ? value : [];
    const minItems = field.config?.minItems ?? 0;
    const maxItems = field.config?.maxItems ?? 10;
    const itemLabel = field.config?.itemLabel ?? 'Item';

    const handleAddItem = () => {
      if (items.length >= maxItems) return;
      const newItem: Record<string, unknown> = { _id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}` };
      field.children?.forEach((child) => {
        newItem[child.id] = undefined;
      });
      onChange([...items, newItem]);
    };

    const handleRemoveItem = (index: number) => {
      if (items.length <= minItems) return;
      const newItems = items.filter((_, i) => i !== index);
      onChange(newItems.length > 0 ? newItems : []);
    };

    const handleItemChange = (index: number, childId: string, childValue: unknown) => {
      const newItems = [...items];
      newItems[index] = { ...newItems[index], [childId]: childValue };
      onChange(newItems);
    };

    return (
      <div className="rounded-lg border border-gray-200 p-4 space-y-4">
        {field.label && (
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-gray-900">{field.label}</h4>
            <span className="text-xs text-gray-400">{items.length} / {maxItems}</span>
          </div>
        )}
        {field.description && (
          <p className="text-sm text-gray-500">{field.description}</p>
        )}
        
        {items.map((item, index) => (
          <div key={item._id || index} className="relative rounded-md border border-gray-100 p-4 bg-gray-50">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-gray-600">{itemLabel} {index + 1}</span>
              {items.length > minItems && !disabled && (
                <button
                  type="button"
                  onClick={() => handleRemoveItem(index)}
                  className="text-xs text-red-500 hover:text-red-700"
                >
                  Remove
                </button>
              )}
            </div>
            <div className="space-y-4">
              {field.children?.map((child) => (
                <PortalFieldAdapter
                  key={child.id}
                  field={child}
                  value={item[child.id]}
                  onChange={(val) => handleItemChange(index, child.id, val)}
                  mode={mode}
                  themeColor={themeColor}
                  disabled={disabled}
                  allFields={allFields}
                  formData={formData}
                  formId={formId}
                />
              ))}
            </div>
          </div>
        ))}

        {items.length < maxItems && !disabled && (
          <button
            type="button"
            onClick={handleAddItem}
            className="w-full py-2 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-50 border border-dashed border-gray-300 rounded-md flex items-center justify-center gap-1"
          >
            <span>+</span>
            Add {itemLabel}
          </button>
        )}
      </div>
    );
  }

  return (
    <FieldRenderer
      field={fieldDefinition}
      value={value}
      onChange={onChange}
      mode={mode}
      viewConfig={viewConfig}
      context="portal"
      disabled={disabled}
      required={field.required}
    />
  );
}

/**
 * Check if a portal field type should use the unified renderer
 * All portal field types are now supported by the unified system
 */
export function canUseUnifiedRenderer(fieldType: string): boolean {
  return fieldType in PORTAL_TO_UNIFIED_TYPE;
}

/**
 * Helper to render a portal field with fallback
 * Uses unified renderer for supported types, falls back for others
 */
export function renderPortalField(
  field: PortalField,
  value: unknown,
  onChange: (value: unknown) => void,
  options?: {
    themeColor?: string;
    disabled?: boolean;
    allFields?: PortalField[];
    formData?: Record<string, unknown>;
    formId?: string;
    fallbackRenderer?: (field: PortalField, value: unknown, onChange: (v: unknown) => void) => React.ReactElement | null;
  }
): React.ReactElement | null {
  // For now, always use the adapter - it handles all types
  return (
    <PortalFieldAdapter
      field={field}
      value={value}
      onChange={onChange}
      themeColor={options?.themeColor}
      disabled={options?.disabled}
      allFields={options?.allFields}
      formData={options?.formData}
      formId={options?.formId}
    />
  );
}
