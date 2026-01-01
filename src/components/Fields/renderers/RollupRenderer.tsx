'use client';

/**
 * Rollup Field Renderer
 * Handles: rollup (aggregate values from linked records)
 * 
 * Rollup fields compute aggregate values (SUM, COUNT, AVG, etc.)
 * from a field in linked records.
 */

import React from 'react';
import { Label } from '@/ui-components/label';
import { cn } from '@/lib/utils';
import { Calculator } from 'lucide-react';
import type { FieldRendererProps } from '../types';
import { safeFieldString } from '../types';
import { FIELD_TYPES } from '@/types/field-types';

const ROLLUP_SUBTYPES = [
  FIELD_TYPES.ROLLUP,
  'rollup_field',
  'aggregate',
] as const;

type RollupFunction = 'sum' | 'avg' | 'min' | 'max' | 'count' | 'counta' | 'countall' | 'and' | 'or' | 'arrayCompact' | 'arrayUnique';

const ROLLUP_LABELS: Record<RollupFunction, string> = {
  sum: 'Sum',
  avg: 'Average',
  min: 'Minimum',
  max: 'Maximum',
  count: 'Count (non-empty)',
  counta: 'Count (all)',
  countall: 'Count (all records)',
  and: 'AND (all true)',
  or: 'OR (any true)',
  arrayCompact: 'Compact array',
  arrayUnique: 'Unique values',
};

function formatRollupValue(value: any, rollupFunction?: string): string {
  if (value === null || value === undefined) return '—';
  
  // For count functions, ensure integer display
  if (rollupFunction?.startsWith('count')) {
    return String(Math.round(Number(value)));
  }
  
  // For boolean functions
  if (rollupFunction === 'and' || rollupFunction === 'or') {
    return value ? 'Yes' : 'No';
  }
  
  // For average, show 2 decimal places
  if (rollupFunction === 'avg') {
    return Number(value).toFixed(2);
  }
  
  // For arrays
  if (Array.isArray(value)) {
    return value.join(', ');
  }
  
  // For numbers, format nicely
  if (typeof value === 'number') {
    return value.toLocaleString();
  }
  
  return String(value);
}

export function RollupRenderer(props: FieldRendererProps): React.ReactElement | null {
  const {
    field,
    value,
    mode,
    config,
    className,
  } = props;

  const rollupFunction = (config?.rollup_function || config?.rollupFunction || (field as any).rollup_function || 'count') as RollupFunction;
  const displayValue = formatRollupValue(value, rollupFunction);
  const functionLabel = ROLLUP_LABELS[rollupFunction] || rollupFunction;

  // Display mode (rollup fields are always read-only)
  if (mode === 'display' || mode === 'compact' || mode === 'edit') {
    if (value === null || value === undefined) {
      return (
        <span className={cn('text-gray-400 text-sm', className)}>
          {mode === 'compact' ? '—' : 'No data'}
        </span>
      );
    }

    return (
      <div className={cn('flex items-center gap-1.5', className)}>
        <Calculator size={12} className="text-purple-500 flex-shrink-0" />
        <span className="text-gray-900 font-medium tabular-nums">{displayValue}</span>
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
          <Calculator size={14} className="text-purple-500" />
          {label}
        </Label>
        
        {description && (
          <p className="text-sm text-gray-500">{description}</p>
        )}
        
        <div className="px-3 py-2 bg-purple-50 border border-purple-100 rounded-md">
          {value !== null && value !== undefined ? (
            <span className="text-gray-900 font-medium tabular-nums">{displayValue}</span>
          ) : (
            <span className="text-gray-400 italic">
              Computed from linked records
            </span>
          )}
        </div>
        
        <p className="text-xs text-purple-600 flex items-center gap-1">
          <Calculator size={12} />
          {functionLabel}
        </p>
      </div>
    );
  }

  // Preview mode
  if (mode === 'preview') {
    const label = safeFieldString(field.label);
    return (
      <div className={cn('space-y-2', className)}>
        <Label className="text-gray-500 flex items-center gap-1.5">
          <Calculator size={14} />
          {label}
        </Label>
        
        <div className="px-3 py-2 bg-purple-50 border border-dashed border-purple-200 rounded-md">
          <span className="text-purple-600 text-sm">
            {functionLabel} of linked records
          </span>
        </div>
      </div>
    );
  }

  return null;
}

export const ROLLUP_FIELD_TYPES = ROLLUP_SUBTYPES;
