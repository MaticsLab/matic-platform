'use client';

/**
 * Lookup Field Renderer
 * Handles: lookup (display values from linked records)
 * 
 * Lookup fields are read-only computed fields that display values
 * from a linked record's field.
 */

import React from 'react';
import { Label } from '@/ui-components/label';
import { cn } from '@/lib/utils';
import { Search, Link2 } from 'lucide-react';
import type { FieldRendererProps } from '../types';
import { safeFieldString } from '../types';
import { FIELD_TYPES } from '@/types/field-types';

const LOOKUP_SUBTYPES = [
  FIELD_TYPES.LOOKUP,
  'lookup_field',
] as const;

function formatLookupValue(value: any): string {
  if (value === null || value === undefined) return '';
  
  if (Array.isArray(value)) {
    return value.map(formatLookupValue).filter(Boolean).join(', ');
  }
  
  if (typeof value === 'object') {
    // Try to extract display value
    return value.display_value || value.value || JSON.stringify(value);
  }
  
  return String(value);
}

export function LookupRenderer(props: FieldRendererProps): React.ReactElement | null {
  const {
    field,
    value,
    mode,
    config,
    className,
  } = props;

  const lookupFieldName = config?.lookup_field || config?.lookupField;
  const displayValue = formatLookupValue(value);

  // Display mode (lookup fields are always read-only)
  if (mode === 'display' || mode === 'compact' || mode === 'edit') {
    if (!displayValue) {
      return (
        <span className={cn('text-gray-400 text-sm', className)}>
          {mode === 'compact' ? '—' : 'No value'}
        </span>
      );
    }

    return (
      <div className={cn('flex items-center gap-1.5', className)}>
        <Search size={12} className="text-gray-400 flex-shrink-0" />
        <span className="text-gray-700 text-sm truncate">{displayValue}</span>
      </div>
    );
  }

  // Form mode - show as read-only info
  if (mode === 'form') {
    const label = safeFieldString(field.label);
    const description = safeFieldString(field.description);
    return (
      <div className={cn('space-y-2', className)}>
        <Label className="flex items-center gap-1.5">
          <Search size={14} className="text-gray-400" />
          {label}
        </Label>
        
        {description && (
          <p className="text-sm text-gray-500">{description}</p>
        )}
        
        <div className="px-3 py-2 bg-gray-50 border rounded-md">
          {displayValue ? (
            <span className="text-gray-700">{displayValue}</span>
          ) : (
            <span className="text-gray-400 italic">
              Value will be looked up from linked record
            </span>
          )}
        </div>
        
        {lookupFieldName && (
          <p className="text-xs text-gray-400">
            Looking up: {lookupFieldName}
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
        <Label className="text-gray-500 flex items-center gap-1.5">
          <Search size={14} />
          {label}
        </Label>
        
        <div className="px-3 py-2 bg-gray-50 border rounded-md border-dashed">
          <span className="text-gray-400 text-sm italic">
            Lookup value from linked record
          </span>
        </div>
      </div>
    );
  }

  return null;
}

export const LOOKUP_FIELD_TYPES = LOOKUP_SUBTYPES;
