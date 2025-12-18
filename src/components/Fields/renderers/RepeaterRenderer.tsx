'use client';

/**
 * Repeater Field Renderer
 * Handles: repeater, item_list (arrays of nested fields)
 * 
 * Repeater fields allow multiple instances of a group of fields.
 */

import React, { useState } from 'react';
import { Label } from '@/ui-components/label';
import { Button } from '@/ui-components/button';
import { cn } from '@/lib/utils';
import { Plus, Trash2, GripVertical, ChevronDown, ChevronUp, List } from 'lucide-react';
import type { FieldRendererProps } from '../types';
import { FIELD_TYPES } from '@/types/field-types';

const REPEATER_SUBTYPES = [
  FIELD_TYPES.REPEATER,
  FIELD_TYPES.ITEM_LIST,
  'array',
  'nested_array',
] as const;

interface RepeaterItem {
  id?: string;
  [key: string]: any;
}

function normalizeRepeaterValue(value: any): RepeaterItem[] {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  return [];
}

function generateItemId(): string {
  return `item_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function RepeaterRenderer(props: FieldRendererProps): React.ReactElement | null {
  const {
    field,
    value,
    onChange,
    mode,
    disabled = false,
    required = false,
    config,
    error,
    className,
    childFields = [],
    onChildChange,
  } = props;

  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set([0]));
  
  const items = normalizeRepeaterValue(value);
  const minItems = config?.minItems ?? config?.min_items ?? 0;
  const maxItems = config?.maxItems ?? config?.max_items ?? Infinity;
  const itemLabel = config?.itemLabel ?? config?.item_label ?? 'Item';
  const allowReorder = config?.allowReorder ?? config?.allow_reorder ?? true;
  const collapsible = config?.collapsible ?? true;

  const handleAddItem = () => {
    if (items.length >= maxItems) return;
    
    const newItem: RepeaterItem = { id: generateItemId() };
    // Initialize with empty values for each child field
    childFields.forEach((cf) => {
      newItem[cf.name] = null;
    });
    
    onChange?.([...items, newItem]);
    setExpandedItems((prev) => new Set([...prev, items.length]));
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= minItems) return;
    
    const newItems = items.filter((_, i) => i !== index);
    onChange?.(newItems.length > 0 ? newItems : null);
    
    setExpandedItems((prev) => {
      const next = new Set<number>();
      prev.forEach((i) => {
        if (i < index) next.add(i);
        else if (i > index) next.add(i - 1);
      });
      return next;
    });
  };

  const handleItemChange = (index: number, fieldName: string, fieldValue: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [fieldName]: fieldValue };
    onChange?.(newItems);
    
    // Also call the parent's onChildChange if provided
    onChildChange?.(index, fieldName, fieldValue);
  };

  const toggleExpand = (index: number) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const getItemSummary = (item: RepeaterItem, index: number): string => {
    // Try to find a display value from the first field
    const firstField = childFields[0];
    if (firstField && item[firstField.name]) {
      const val = item[firstField.name];
      if (typeof val === 'string') return val.slice(0, 30);
      if (typeof val === 'number') return String(val);
    }
    return `${itemLabel} ${index + 1}`;
  };

  // Display mode
  if (mode === 'display' || mode === 'compact') {
    if (items.length === 0) {
      return (
        <span className={cn('text-gray-400 text-sm', className)}>
          {mode === 'compact' ? '—' : 'No items'}
        </span>
      );
    }

    if (mode === 'compact') {
      return (
        <div className={cn('flex items-center gap-1', className)}>
          <List size={14} className="text-gray-400" />
          <span className="text-sm">{items.length} {itemLabel}{items.length !== 1 ? 's' : ''}</span>
        </div>
      );
    }

    return (
      <div className={cn('space-y-2', className)}>
        {items.map((item, index) => (
          <div key={item.id || index} className="border rounded-md p-3 bg-gray-50">
            <div className="font-medium text-sm text-gray-700 mb-2">
              {getItemSummary(item, index)}
            </div>
            <div className="space-y-1">
              {childFields.map((cf) => (
                <div key={cf.id || cf.name} className="flex gap-2 text-sm">
                  <span className="text-gray-500">{cf.label}:</span>
                  <span className="text-gray-900">
                    {item[cf.name] !== null && item[cf.name] !== undefined 
                      ? String(item[cf.name]) 
                      : '—'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Edit mode - simplified inline editor
  if (mode === 'edit') {
    return (
      <div className={cn('space-y-2', className)}>
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <List size={14} />
          <span>{items.length} {itemLabel}{items.length !== 1 ? 's' : ''}</span>
        </div>
        {/* Full editing would open a modal or expand inline */}
      </div>
    );
  }

  // Form mode - full repeater editor
  if (mode === 'form') {
    return (
      <div className={cn('space-y-3', className)}>
        <div className="flex items-center justify-between">
          <Label>
            {field.label}
            {required && <span className="text-red-500 ml-1">*</span>}
          </Label>
          
          {items.length < maxItems && !disabled && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddItem}
            >
              <Plus size={14} className="mr-1" />
              Add {itemLabel}
            </Button>
          )}
        </div>
        
        {field.description && (
          <p className="text-sm text-gray-500">{field.description}</p>
        )}
        
        {items.length === 0 ? (
          <div className="border-2 border-dashed rounded-lg p-6 text-center">
            <List className="mx-auto h-8 w-8 text-gray-300 mb-2" />
            <p className="text-sm text-gray-500">No items yet</p>
            {!disabled && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={handleAddItem}
              >
                <Plus size={14} className="mr-1" />
                Add first {itemLabel.toLowerCase()}
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item, index) => {
              const isExpanded = expandedItems.has(index);
              
              return (
                <div
                  key={item.id || index}
                  className="border rounded-lg overflow-hidden"
                >
                  {/* Item header */}
                  <div className={cn(
                    'flex items-center gap-2 px-3 py-2 bg-gray-50',
                    collapsible && 'cursor-pointer'
                  )}
                  onClick={() => collapsible && toggleExpand(index)}
                  >
                    {allowReorder && (
                      <GripVertical size={16} className="text-gray-400 cursor-grab" />
                    )}
                    
                    <span className="flex-1 font-medium text-sm">
                      {getItemSummary(item, index)}
                    </span>
                    
                    {!disabled && items.length > minItems && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-gray-400 hover:text-red-500"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveItem(index);
                        }}
                      >
                        <Trash2 size={14} />
                      </Button>
                    )}
                    
                    {collapsible && (
                      isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />
                    )}
                  </div>
                  
                  {/* Item content */}
                  {(!collapsible || isExpanded) && (
                    <div className="p-3 space-y-4 border-t">
                      {childFields.length > 0 ? (
                        childFields.map((cf) => (
                          <div key={cf.id || cf.name} className="space-y-1">
                            <Label className="text-sm">
                              {cf.label}
                              {cf.config?.required && (
                                <span className="text-red-500 ml-1">*</span>
                              )}
                            </Label>
                            {/* Child field would be rendered here using FieldRenderer */}
                            <input
                              type="text"
                              value={item[cf.name] || ''}
                              onChange={(e) => handleItemChange(index, cf.name, e.target.value)}
                              disabled={disabled}
                              className="w-full px-3 py-2 border rounded-md text-sm"
                              placeholder={`Enter ${cf.label.toLowerCase()}`}
                            />
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-gray-400 italic">
                          No child fields defined
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        
        {error && (
          <p className="text-sm text-red-500">{error}</p>
        )}
        
        {minItems > 0 && items.length < minItems && (
          <p className="text-xs text-amber-600">
            Minimum {minItems} {itemLabel.toLowerCase()}{minItems !== 1 ? 's' : ''} required
          </p>
        )}
      </div>
    );
  }

  // Preview mode
  if (mode === 'preview') {
    return (
      <div className={cn('space-y-2', className)}>
        <Label className="text-gray-500">
          {field.label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </Label>
        
        <div className="border-2 border-dashed rounded-lg p-4">
          <div className="flex items-center gap-2 text-gray-400">
            <List size={16} />
            <span className="text-sm">Repeating section</span>
          </div>
          {childFields.length > 0 && (
            <div className="mt-2 pl-6 border-l-2 border-gray-200">
              {childFields.slice(0, 3).map((cf) => (
                <p key={cf.id || cf.name} className="text-xs text-gray-400">
                  • {cf.label}
                </p>
              ))}
              {childFields.length > 3 && (
                <p className="text-xs text-gray-400">
                  +{childFields.length - 3} more fields
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
}

export const REPEATER_FIELD_TYPES = REPEATER_SUBTYPES;
