'use client';

/**
 * Formula Field Renderer
 * Handles: formula (computed fields using expressions)
 * 
 * Formula fields display computed values based on other fields.
 * They are read-only and computed on the backend.
 */

import React from 'react';
import { Label } from '@/ui-components/label';
import { cn } from '@/lib/utils';
import { FunctionSquare, AlertCircle } from 'lucide-react';
import type { FieldRendererProps } from '../types';
import { safeFieldString } from '../types';
import { FIELD_TYPES } from '@/types/field-types';

const FORMULA_SUBTYPES = [
  FIELD_TYPES.FORMULA,
  'computed',
  'expression',
] as const;

function formatFormulaValue(value: any, config: Record<string, any>): string {
  if (value === null || value === undefined) return '';
  
  const resultType = config?.result_type || config?.resultType || 'text';
  
  switch (resultType) {
    case 'number':
      const decimals = config?.decimals ?? 2;
      return Number(value).toFixed(decimals);
    
    case 'currency':
      const currency = config?.currency || 'USD';
      try {
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency,
        }).format(Number(value));
      } catch {
        return `$${Number(value).toFixed(2)}`;
      }
    
    case 'percent':
      return `${Number(value).toFixed(config?.decimals ?? 0)}%`;
    
    case 'date':
      try {
        return new Date(value).toLocaleDateString();
      } catch {
        return String(value);
      }
    
    case 'boolean':
      return value ? 'Yes' : 'No';
    
    default:
      return String(value);
  }
}

export function FormulaRenderer(props: FieldRendererProps): React.ReactElement | null {
  const {
    field,
    value,
    mode,
    config,
    error,
    className,
  } = props;

  const formula = config?.formula || (field as any).formula;
  const displayValue = formatFormulaValue(value, config);
  const hasError = error || (value && typeof value === 'object' && value.error);
  const errorMessage = error || (value?.error);

  // Display mode (formula fields are always read-only)
  if (mode === 'display' || mode === 'compact' || mode === 'edit') {
    if (hasError) {
      return (
        <div className={cn('flex items-center gap-1.5 text-red-500', className)}>
          <AlertCircle size={12} />
          <span className="text-xs">{errorMessage || 'Error'}</span>
        </div>
      );
    }

    if (!displayValue) {
      return (
        <span className={cn('text-gray-400 text-sm', className)}>
          {mode === 'compact' ? '—' : 'No result'}
        </span>
      );
    }

    return (
      <div className={cn('flex items-center gap-1.5', className)}>
        <FunctionSquare size={12} className="text-orange-500 flex-shrink-0" />
        <span className="text-gray-900">{displayValue}</span>
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
          <FunctionSquare size={14} className="text-orange-500" />
          {label}
        </Label>
        
        {description && (
          <p className="text-sm text-gray-500">{description}</p>
        )}
        
        <div className={cn(
          'px-3 py-2 border rounded-md',
          hasError 
            ? 'bg-red-50 border-red-200' 
            : 'bg-orange-50 border-orange-100'
        )}>
          {hasError ? (
            <div className="flex items-center gap-2 text-red-600">
              <AlertCircle size={14} />
              <span className="text-sm">{errorMessage || 'Formula error'}</span>
            </div>
          ) : displayValue ? (
            <span className="text-gray-900">{displayValue}</span>
          ) : (
            <span className="text-gray-400 italic">
              Computed from formula
            </span>
          )}
        </div>
        
        {formula && (
          <div className="text-xs text-gray-500 font-mono bg-gray-50 px-2 py-1 rounded">
            = {formula}
          </div>
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
          <FunctionSquare size={14} />
          {label}
        </Label>
        
        <div className="px-3 py-2 bg-orange-50 border border-dashed border-orange-200 rounded-md">
          <span className="text-orange-600 text-sm font-mono">
            {formula || '= formula()'}
          </span>
        </div>
      </div>
    );
  }

  return null;
}

export const FORMULA_FIELD_TYPES = FORMULA_SUBTYPES;
