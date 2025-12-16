'use client';

/**
 * Select Field Renderer
 * Handles: select, multiselect, radio
 */

import React, { useState } from 'react';
import { Label } from '@/ui-components/label';
import { Badge } from '@/ui-components/badge';
import { Checkbox } from '@/ui-components/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/ui-components/select';
import { cn } from '@/lib/utils';
import { Check, ChevronDown, X } from 'lucide-react';
import type { FieldRendererProps } from '../types';
import { FIELD_TYPES } from '@/types/field-types';

const SELECT_SUBTYPES = [
  FIELD_TYPES.SELECT,
  FIELD_TYPES.MULTISELECT,
  'single_select',
  'multiple_select',
  'radio',
  'dropdown',
] as const;

interface SelectOption {
  value: string;
  label?: string;
  color?: string;
}

function normalizeOptions(config: Record<string, any>): SelectOption[] {
  const rawOptions = config?.options || [];
  
  // Ensure rawOptions is actually an array
  if (!Array.isArray(rawOptions)) {
    return [];
  }
  
  return rawOptions
    .filter((opt): opt is string | SelectOption => opt != null)
    .map((opt: string | SelectOption) => {
      if (typeof opt === 'string') {
        return { value: opt, label: opt };
      }
      if (typeof opt === 'object' && opt.value != null) {
        return { value: String(opt.value), label: opt.label || String(opt.value), color: opt.color };
      }
      return null;
    })
    .filter((opt): opt is SelectOption => opt !== null && opt.value !== '');
}

function getOptionColor(option: SelectOption): string {
  if (option.color) return option.color;
  
  // Generate consistent color from string hash
  let hash = 0;
  for (let i = 0; i < option.value.length; i++) {
    hash = option.value.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  const colors = [
    'bg-blue-100 text-blue-800',
    'bg-green-100 text-green-800',
    'bg-purple-100 text-purple-800',
    'bg-yellow-100 text-yellow-800',
    'bg-pink-100 text-pink-800',
    'bg-indigo-100 text-indigo-800',
    'bg-orange-100 text-orange-800',
    'bg-teal-100 text-teal-800',
  ];
  
  return colors[Math.abs(hash) % colors.length];
}

function OptionBadge({ option, onRemove }: { option: SelectOption; onRemove?: () => void }) {
  const colorClass = getOptionColor(option);
  
  return (
    <Badge
      variant="secondary"
      className={cn('text-xs font-normal', colorClass)}
    >
      {option.label || option.value}
      {onRemove && (
        <X
          size={12}
          className="ml-1 cursor-pointer hover:opacity-70"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
        />
      )}
    </Badge>
  );
}

function isMultiSelect(fieldTypeId: string): boolean {
  return (
    fieldTypeId === FIELD_TYPES.MULTISELECT ||
    fieldTypeId === 'multiselect' ||
    fieldTypeId === 'multiple_select'
  );
}

export function SelectRenderer(props: FieldRendererProps): React.ReactElement | null {
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

  const fieldTypeId = field.field_type_id || field.type || 'select';
  const isMulti = isMultiSelect(fieldTypeId);
  const options = normalizeOptions(config || {});
  const [isOpen, setIsOpen] = useState(false);
  
  // Early return for disabled state in form mode - show simple placeholder instead of Radix Select
  // This avoids Radix UI issues when the component is just being used for preview
  if (disabled && (mode === 'form' || mode === 'edit') && !value) {
    return (
      <div className={cn('space-y-2', className)}>
        {mode === 'form' && field.label && (
          <Label className="text-gray-500">
            {field.label}
            {required && <span className="text-red-500 ml-1">*</span>}
          </Label>
        )}
        <div className="h-9 px-3 py-2 border rounded-md bg-gray-50 text-sm text-gray-400 flex items-center">
          {placeholder || (isMulti ? 'Select options...' : 'Select an option...')}
        </div>
      </div>
    );
  }

  // Normalize value to array for multiselect
  const normalizedValue: string[] = isMulti
    ? (Array.isArray(value) ? value : value ? [value] : [])
    : [];

  const selectedOptions = isMulti
    ? options.filter((opt) => normalizedValue.includes(opt.value))
    : options.find((opt) => opt.value === value);

  // Display mode
  if (mode === 'display' || mode === 'compact') {
    if (!value || (Array.isArray(value) && value.length === 0)) {
      return (
        <span className={cn('text-gray-400 text-sm', className)}>
          {mode === 'compact' ? '—' : 'Empty'}
        </span>
      );
    }

    if (isMulti) {
      return (
        <div className={cn('flex flex-wrap gap-1', className)}>
          {(selectedOptions as SelectOption[]).map((opt) => (
            <OptionBadge key={opt.value} option={opt} />
          ))}
        </div>
      );
    }

    const singleOption = selectedOptions as SelectOption | undefined;
    if (singleOption) {
      return (
        <div className={className}>
          <OptionBadge option={singleOption} />
        </div>
      );
    }

    return <span className={cn('text-gray-900', className)}>{value}</span>;
  }

  // Edit mode - inline editing
  if (mode === 'edit') {
    if (isMulti) {
      return (
        <div className={cn('relative', className)}>
          <div
            className={cn(
              'min-h-[32px] px-2 py-1 border rounded-md cursor-pointer bg-white',
              'flex flex-wrap gap-1 items-center',
              disabled && 'opacity-50 cursor-not-allowed'
            )}
            onClick={() => !disabled && setIsOpen(!isOpen)}
          >
            {(selectedOptions as SelectOption[]).length > 0 ? (
              (selectedOptions as SelectOption[]).map((opt) => (
                <OptionBadge
                  key={opt.value}
                  option={opt}
                  onRemove={() => {
                    const newValue = normalizedValue.filter((v) => v !== opt.value);
                    onChange?.(newValue);
                  }}
                />
              ))
            ) : (
              <span className="text-gray-400 text-sm">{placeholder || 'Select...'}</span>
            )}
            <ChevronDown size={14} className="ml-auto text-gray-400" />
          </div>
          
          {isOpen && !disabled && (
            <div className="absolute z-50 mt-1 w-full bg-white border rounded-md shadow-lg max-h-48 overflow-auto">
              {options.map((opt) => {
                const isSelected = normalizedValue.includes(opt.value);
                return (
                  <div
                    key={opt.value}
                    className={cn(
                      'px-3 py-2 cursor-pointer flex items-center gap-2',
                      'transition-colors duration-150',
                      isSelected ? 'bg-blue-50 border-l-2 border-l-blue-500' : 'hover:bg-gray-100',
                    )}
                    onClick={() => {
                      const newValue = isSelected
                        ? normalizedValue.filter((v) => v !== opt.value)
                        : [...normalizedValue, opt.value];
                      onChange?.(newValue);
                    }}
                  >
                    <Checkbox checked={isSelected} />
                    <span className="text-sm">{opt.label || opt.value}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      );
    }

    // Single select
    return (
      <Select
        value={value || undefined}
        onValueChange={onChange}
        disabled={disabled}
      >
        <SelectTrigger className={cn('h-8 text-sm', className)}>
          <SelectValue placeholder={placeholder || 'Select...'} />
        </SelectTrigger>
        <SelectContent>
          {options.length > 0 ? (
            options.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label || opt.value}
              </SelectItem>
            ))
          ) : (
            <SelectItem value="__no_options" disabled>
              No options available
            </SelectItem>
          )}
        </SelectContent>
      </Select>
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
        
        {isMulti ? (
          <div className="space-y-2">
            {options.map((opt) => {
              const isSelected = normalizedValue.includes(opt.value);
              return (
                <div key={opt.value} className="flex items-center gap-2">
                  <Checkbox
                    id={`${field.name}-${opt.value}`}
                    checked={isSelected}
                    disabled={disabled}
                    onCheckedChange={(checked) => {
                      const newValue = checked
                        ? [...normalizedValue, opt.value]
                        : normalizedValue.filter((v) => v !== opt.value);
                      onChange?.(newValue);
                    }}
                  />
                  <Label
                    htmlFor={`${field.name}-${opt.value}`}
                    className="text-sm font-normal cursor-pointer"
                  >
                    {opt.label || opt.value}
                  </Label>
                </div>
              );
            })}
          </div>
        ) : (
          <Select
            value={value || undefined}
            onValueChange={onChange}
            disabled={disabled}
            required={required}
          >
            <SelectTrigger className={cn(error && 'border-red-500')}>
              <SelectValue placeholder={placeholder || 'Select an option'} />
            </SelectTrigger>
            <SelectContent>
              {options.length > 0 ? (
                options.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label || opt.value}
                  </SelectItem>
                ))
              ) : (
                <SelectItem value="__no_options" disabled>
                  No options available
                </SelectItem>
              )}
            </SelectContent>
          </Select>
        )}
        
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
        
        <Select disabled>
          <SelectTrigger className="bg-gray-50">
            <SelectValue placeholder={isMulti ? 'Select options...' : 'Select an option...'} />
          </SelectTrigger>
          <SelectContent>
            {options.length > 0 ? (
              options.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label || opt.value}
                </SelectItem>
              ))
            ) : (
              <SelectItem value="__placeholder" disabled>
                No options
              </SelectItem>
            )}
          </SelectContent>
        </Select>
      </div>
    );
  }

  return null;
}

export const SELECT_FIELD_TYPES = SELECT_SUBTYPES;
