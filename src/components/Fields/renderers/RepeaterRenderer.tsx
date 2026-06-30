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
import { safeFieldString } from '../types';
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
        <span className={cn('text-gray-400 dark:text-gray-500 text-sm', className)}>
          {mode === 'compact' ? '—' : 'No items'}
        </span>
      );
    }

    if (mode === 'compact') {
      return (
        <div className={cn('flex items-center gap-1', className)}>
          <List size={14} className="text-gray-400 dark:text-gray-500" />
          <span className="text-sm">{items.length} {itemLabel}{items.length !== 1 ? 's' : ''}</span>
        </div>
      );
    }

    return (
      <div className={cn('space-y-2', className)}>
        {items.map((item, index) => (
          <div key={item.id || index} className="border border-gray-200 dark:border-gray-700 rounded-md p-3 bg-gray-50 dark:bg-gray-900">
            <div className="font-medium text-sm text-gray-700 dark:text-gray-300 mb-2">
              {getItemSummary(item, index)}
            </div>
            <div className="space-y-1">
              {childFields.map((cf) => (
                <div key={cf.id || cf.name} className="flex gap-2 text-sm">
                  <span className="text-gray-500 dark:text-gray-400">{cf.label}:</span>
                  <span className="text-gray-900 dark:text-white">
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
        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
          <List size={14} />
          <span>{items.length} {itemLabel}{items.length !== 1 ? 's' : ''}</span>
        </div>
        {/* Full editing would open a modal or expand inline */}
      </div>
    );
  }

  // Form mode - full repeater editor
  if (mode === 'form') {
    const label = safeFieldString(field.label);
    const description = safeFieldString(field.description);
    return (
      <div className={cn('space-y-3', className)}>
        <div className="flex items-center justify-between">
          <Label>
            {label}
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
        
        {description && (
          <p className="text-sm text-gray-500 dark:text-gray-400">{description}</p>
        )}
        
        {items.length === 0 ? (
          <div className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg p-6 text-center bg-gray-50 dark:bg-gray-900">
            <List className="mx-auto h-8 w-8 text-gray-300 dark:text-gray-600 mb-2" />
            <p className="text-sm text-gray-500 dark:text-gray-400">No items yet</p>
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
                  className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
                >
                  {/* Item header */}
                  <div className={cn(
                    'flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-900',
                    collapsible && 'cursor-pointer'
                  )}
                  onClick={() => collapsible && toggleExpand(index)}
                  >
                    {allowReorder && (
                      <GripVertical size={16} className="text-gray-400 dark:text-gray-500 cursor-grab" />
                    )}
                    
                    <span className="flex-1 font-medium text-sm text-gray-900 dark:text-white">
                      {getItemSummary(item, index)}
                    </span>
                    
                    {!disabled && items.length > minItems && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400"
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
                    <div className="p-3 space-y-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950">
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
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-600"
                              placeholder={`Enter ${cf.label.toLowerCase()}`}
                            />
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-gray-400 dark:text-gray-500 italic">
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
          <p className="text-xs text-amber-600 dark:text-amber-400">
            Minimum {minItems} {itemLabel.toLowerCase()}{minItems !== 1 ? 's' : ''} required
          </p>
        )}
      </div>
    );
  }

  // Preview mode
  if (mode === 'preview') {
    const label = safeFieldString(field.label);
    return (
      <div className={cn('space-y-2', className)}>
        <Label className="text-gray-500 dark:text-gray-400">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </Label>
        
        <div className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-900">
          <div className="flex items-center gap-2 text-gray-400 dark:text-gray-500">
            <List size={16} />
            <span className="text-sm">Repeating section</span>
          </div>
          {childFields.length > 0 && (
            <div className="mt-2 pl-6 border-l-2 border-gray-200 dark:border-gray-700">
              {childFields.slice(0, 3).map((cf) => (
                <p key={cf.id || cf.name} className="text-xs text-gray-400 dark:text-gray-500">
                  • {cf.label}
                </p>
              ))}
              {childFields.length > 3 && (
                <p className="text-xs text-gray-400 dark:text-gray-500">
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
