'use client';

/**
 * Checkbox Field Renderer
 * Handles: checkbox, boolean, toggle
 */

import React from 'react';
import { Label } from '@/ui-components/label';
import { Checkbox } from '@/ui-components/checkbox';
import { Switch } from '@/ui-components/switch';
import { cn } from '@/lib/utils';
import { Check, X } from 'lucide-react';
import type { FieldRendererProps } from '../types';
import { safeFieldString } from '../types';
import { FIELD_TYPES } from '@/types/field-types';

const CHECKBOX_SUBTYPES = [
  FIELD_TYPES.CHECKBOX,
  'boolean',
  'toggle',
] as const;

function normalizeValue(value: any): boolean {
  if (typeof value === 'boolean') return value;
  if (value === 'true' || value === 1 || value === '1') return true;
  return false;
}

export function CheckboxRenderer(props: FieldRendererProps): React.ReactElement | null {
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
  } = props;

  const checked = normalizeValue(value);
  const useSwitch = config?.style === 'switch' || config?.style === 'toggle';
  const showAsIcon = config?.displayStyle === 'icon';

  // Display mode
  if (mode === 'display' || mode === 'compact') {
    if (showAsIcon) {
      return (
        <div className={cn('flex items-center justify-center', className)}>
          {checked ? (
            <Check size={16} className="text-green-500" />
          ) : (
            <X size={16} className="text-gray-300" />
          )}
        </div>
      );
    }

    if (mode === 'compact') {
      return (
        <div className={cn('flex items-center justify-center', className)}>
          <div
            className={cn(
              'w-4 h-4 rounded border flex items-center justify-center',
              checked ? 'bg-blue-500 border-blue-500' : 'border-gray-300'
            )}
          >
            {checked && <Check size={12} className="text-white" />}
          </div>
        </div>
      );
    }

    return (
      <span className={cn('text-sm', checked ? 'text-green-600' : 'text-gray-400', className)}>
        {checked ? 'Yes' : 'No'}
      </span>
    );
  }

  // Edit mode - inline editing
  if (mode === 'edit') {
    if (useSwitch) {
      return (
        <Switch
          checked={checked}
          onCheckedChange={onChange}
          disabled={disabled}
          className={className}
        />
      );
    }

    return (
      <div className={cn('flex items-center justify-center', className)}>
        <Checkbox
          checked={checked}
          onCheckedChange={onChange}
          disabled={disabled}
        />
      </div>
    );
  }

  // Form mode
  if (mode === 'form') {
    const label = safeFieldString(field.label);
    const description = safeFieldString(field.description);
    return (
      <div className={cn('space-y-2', className)}>
        <div className="flex items-center gap-3">
          {useSwitch ? (
            <Switch
              id={field.name}
              checked={checked}
              onCheckedChange={onChange}
              disabled={disabled}
            />
          ) : (
            <Checkbox
              id={field.name}
              checked={checked}
              onCheckedChange={onChange}
              disabled={disabled}
            />
          )}
          
          <Label htmlFor={field.name} className="cursor-pointer">
            {label}
            {required && <span className="text-red-500 ml-1">*</span>}
          </Label>
        </div>
        
        {description && (
          <p className="text-sm text-gray-500 ml-7">{description}</p>
        )}
        
        {error && (
          <p className="text-sm text-red-500 ml-7">{error}</p>
        )}
      </div>
    );
  }

  // Preview mode
  if (mode === 'preview') {
    const label = safeFieldString(field.label);
    return (
      <div className={cn('flex items-center gap-3', className)}>
        {useSwitch ? (
          <Switch disabled className="opacity-50" />
        ) : (
          <Checkbox disabled className="opacity-50" />
        )}
        <Label className="text-gray-500">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </Label>
      </div>
    );
  }

  return null;
}

export const CHECKBOX_FIELD_TYPES = CHECKBOX_SUBTYPES;
