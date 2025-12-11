'use client';

/**
 * Date Field Renderer
 * Handles: date, datetime, time
 */

import React from 'react';
import { Input } from '@/ui-components/input';
import { Label } from '@/ui-components/label';
import { cn } from '@/lib/utils';
import { Calendar, Clock } from 'lucide-react';
import type { FieldRendererProps } from '../types';
import { FIELD_TYPES } from '@/types/field-types';

const DATE_SUBTYPES = [
  FIELD_TYPES.DATE,
  FIELD_TYPES.DATETIME,
  'date_time',
  'time',
  FIELD_TYPES.CREATED_TIME,
  FIELD_TYPES.LAST_MODIFIED_TIME,
] as const;

function formatDate(value: any, fieldTypeId: string, config: Record<string, any>): string {
  if (!value) return '';
  
  try {
    const date = new Date(value);
    if (isNaN(date.getTime())) return String(value);
    
    const locale = config?.locale || 'en-US';
    const options: Intl.DateTimeFormatOptions = {};
    
    const isTimeOnly = fieldTypeId === 'time';
    const includesTime = fieldTypeId === FIELD_TYPES.DATETIME || 
                         fieldTypeId === 'datetime' || 
                         fieldTypeId === 'date_time' ||
                         fieldTypeId === FIELD_TYPES.CREATED_TIME ||
                         fieldTypeId === FIELD_TYPES.LAST_MODIFIED_TIME;
    
    if (!isTimeOnly) {
      options.year = 'numeric';
      options.month = config?.monthFormat || 'short';
      options.day = 'numeric';
    }
    
    if (includesTime || isTimeOnly) {
      options.hour = 'numeric';
      options.minute = '2-digit';
      if (config?.showSeconds) {
        options.second = '2-digit';
      }
    }
    
    return date.toLocaleDateString(locale, options);
  } catch {
    return String(value);
  }
}

function getInputType(fieldTypeId: string): 'date' | 'datetime-local' | 'time' {
  switch (fieldTypeId) {
    case FIELD_TYPES.DATETIME:
    case 'datetime':
    case 'date_time':
      return 'datetime-local';
    case 'time':
      return 'time';
    default:
      return 'date';
  }
}

function formatValueForInput(value: any, inputType: string): string {
  if (!value) return '';
  
  try {
    const date = new Date(value);
    if (isNaN(date.getTime())) return '';
    
    switch (inputType) {
      case 'datetime-local':
        return date.toISOString().slice(0, 16);
      case 'time':
        return date.toISOString().slice(11, 16);
      case 'date':
      default:
        return date.toISOString().slice(0, 10);
    }
  } catch {
    return String(value);
  }
}

export function DateRenderer(props: FieldRendererProps): React.ReactElement | null {
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
    placeholder,
  } = props;

  const fieldTypeId = field.field_type_id || field.type || 'date';
  const inputType = getInputType(fieldTypeId);
  const isTimeOnly = fieldTypeId === 'time';
  const includesTime = inputType === 'datetime-local' || inputType === 'time';
  
  const min = config?.min;
  const max = config?.max;

  // Check if this is a system field (read-only)
  const isSystemField = fieldTypeId === FIELD_TYPES.CREATED_TIME || 
                        fieldTypeId === FIELD_TYPES.LAST_MODIFIED_TIME;

  // Display mode
  if (mode === 'display' || mode === 'compact') {
    if (!value) {
      return (
        <span className={cn('text-gray-400 text-sm', className)}>
          {mode === 'compact' ? '—' : 'Empty'}
        </span>
      );
    }

    return (
      <span className={cn('text-gray-900 flex items-center gap-1.5', className)}>
        {!isTimeOnly && <Calendar size={14} className="text-gray-400" />}
        {isTimeOnly && <Clock size={14} className="text-gray-400" />}
        {formatDate(value, fieldTypeId, config)}
      </span>
    );
  }

  // Edit mode - inline editing
  if (mode === 'edit') {
    if (isSystemField) {
      return (
        <span className={cn('text-gray-500 text-sm', className)}>
          {formatDate(value, fieldTypeId, config)}
        </span>
      );
    }

    return (
      <Input
        type={inputType}
        value={formatValueForInput(value, inputType)}
        onChange={(e) => {
          const newValue = e.target.value;
          if (!newValue) {
            onChange?.(null);
          } else if (inputType === 'datetime-local') {
            onChange?.(new Date(newValue).toISOString());
          } else if (inputType === 'time') {
            onChange?.(newValue);
          } else {
            onChange?.(newValue);
          }
        }}
        disabled={disabled}
        min={min}
        max={max}
        className={cn('w-full h-8 text-sm', className)}
      />
    );
  }

  // Form mode
  if (mode === 'form') {
    return (
      <div className={cn('space-y-2', className)}>
        <Label htmlFor={field.name}>
          {field.label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </Label>
        
        {field.description && (
          <p className="text-sm text-gray-500">{field.description}</p>
        )}
        
        <Input
          id={field.name}
          type={inputType}
          value={formatValueForInput(value, inputType)}
          onChange={(e) => {
            const newValue = e.target.value;
            if (!newValue) {
              onChange?.(null);
            } else if (inputType === 'datetime-local') {
              onChange?.(new Date(newValue).toISOString());
            } else {
              onChange?.(newValue);
            }
          }}
          disabled={disabled || isSystemField}
          required={required}
          min={min}
          max={max}
          className={cn(error && 'border-red-500')}
        />
        
        {error && (
          <p className="text-sm text-red-500">{error}</p>
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
        
        <Input
          type={inputType}
          disabled
          placeholder={placeholder || `Select ${isTimeOnly ? 'time' : 'date'}...`}
          className="bg-gray-50"
        />
      </div>
    );
  }

  return null;
}

export const DATE_FIELD_TYPES = DATE_SUBTYPES;
