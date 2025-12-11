'use client';

/**
 * Number Field Renderer
 * Handles: number, currency, percent, rating
 */

import React from 'react';
import { Input } from '@/ui-components/input';
import { Label } from '@/ui-components/label';
import { cn } from '@/lib/utils';
import { Star } from 'lucide-react';
import type { FieldRendererProps } from '../types';
import { FIELD_TYPES } from '@/types/field-types';

const NUMBER_SUBTYPES = [
  FIELD_TYPES.NUMBER,
  FIELD_TYPES.CURRENCY,
  FIELD_TYPES.PERCENT,
  FIELD_TYPES.RATING,
  'integer',
  'decimal',
] as const;

function formatValue(value: any, fieldTypeId: string, config: Record<string, any>): string {
  if (value === null || value === undefined || value === '') return '';
  
  const numValue = Number(value);
  if (isNaN(numValue)) return String(value);

  switch (fieldTypeId) {
    case FIELD_TYPES.CURRENCY:
    case 'currency': {
      const currency = config?.currency || 'USD';
      const locale = config?.locale || 'en-US';
      try {
        return new Intl.NumberFormat(locale, {
          style: 'currency',
          currency,
        }).format(numValue);
      } catch {
        return `$${numValue.toFixed(2)}`;
      }
    }
    
    case FIELD_TYPES.PERCENT:
    case 'percent': {
      const decimals = config?.decimals ?? 0;
      return `${numValue.toFixed(decimals)}%`;
    }
    
    default: {
      const decimals = config?.decimals;
      if (decimals !== undefined) {
        return numValue.toFixed(decimals);
      }
      return String(numValue);
    }
  }
}

function RatingDisplay({ value, max = 5, size = 16 }: { value: number; max?: number; size?: number }) {
  const stars = [];
  for (let i = 1; i <= max; i++) {
    stars.push(
      <Star
        key={i}
        size={size}
        className={cn(
          'transition-colors',
          i <= value ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'
        )}
      />
    );
  }
  return <div className="flex gap-0.5">{stars}</div>;
}

function RatingInput({ 
  value, 
  onChange, 
  max = 5, 
  disabled = false,
  size = 20 
}: { 
  value: number; 
  onChange?: (v: number) => void; 
  max?: number; 
  disabled?: boolean;
  size?: number;
}) {
  const [hovered, setHovered] = React.useState<number | null>(null);
  
  const stars = [];
  for (let i = 1; i <= max; i++) {
    const filled = hovered !== null ? i <= hovered : i <= value;
    stars.push(
      <Star
        key={i}
        size={size}
        className={cn(
          'transition-colors cursor-pointer',
          filled ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300 hover:text-yellow-300',
          disabled && 'cursor-not-allowed opacity-50'
        )}
        onMouseEnter={() => !disabled && setHovered(i)}
        onMouseLeave={() => setHovered(null)}
        onClick={() => !disabled && onChange?.(i === value ? 0 : i)}
      />
    );
  }
  
  return <div className="flex gap-0.5">{stars}</div>;
}

export function NumberRenderer(props: FieldRendererProps): React.ReactElement | null {
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

  const fieldTypeId = field.field_type_id || field.type || 'number';
  const isRating = fieldTypeId === FIELD_TYPES.RATING || fieldTypeId === 'rating';
  const isCurrency = fieldTypeId === FIELD_TYPES.CURRENCY || fieldTypeId === 'currency';
  const isPercent = fieldTypeId === FIELD_TYPES.PERCENT || fieldTypeId === 'percent';
  
  const min = config?.min;
  const max = config?.max ?? (isRating ? 5 : undefined);
  const step = config?.step ?? (isCurrency ? 0.01 : 1);
  const currencySymbol = config?.currencySymbol || '$';

  // Display mode
  if (mode === 'display' || mode === 'compact') {
    if (value === null || value === undefined || value === '') {
      return (
        <span className={cn('text-gray-400 text-sm', className)}>
          {mode === 'compact' ? '—' : 'Empty'}
        </span>
      );
    }

    if (isRating) {
      return (
        <div className={className}>
          <RatingDisplay value={Number(value)} max={max} size={mode === 'compact' ? 12 : 16} />
        </div>
      );
    }

    return (
      <span className={cn('text-gray-900 tabular-nums', className)}>
        {formatValue(value, fieldTypeId, config)}
      </span>
    );
  }

  // Edit mode - inline editing
  if (mode === 'edit') {
    if (isRating) {
      return (
        <div className={className}>
          <RatingInput
            value={Number(value) || 0}
            onChange={onChange}
            max={max}
            disabled={disabled}
            size={18}
          />
        </div>
      );
    }

    return (
      <div className={cn('relative', className)}>
        {isCurrency && (
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500 text-sm">
            {currencySymbol}
          </span>
        )}
        <Input
          type="number"
          value={value ?? ''}
          onChange={(e) => onChange?.(e.target.value === '' ? null : Number(e.target.value))}
          disabled={disabled}
          placeholder={placeholder}
          min={min}
          max={max}
          step={step}
          className={cn(
            'w-full h-8 text-sm tabular-nums',
            isCurrency && 'pl-6',
            isPercent && 'pr-6'
          )}
        />
        {isPercent && (
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 text-sm">
            %
          </span>
        )}
      </div>
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
        
        {isRating ? (
          <RatingInput
            value={Number(value) || 0}
            onChange={onChange}
            max={max}
            disabled={disabled}
          />
        ) : (
          <div className="relative">
            {isCurrency && (
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                {currencySymbol}
              </span>
            )}
            <Input
              id={field.name}
              type="number"
              value={value ?? ''}
              onChange={(e) => onChange?.(e.target.value === '' ? null : Number(e.target.value))}
              disabled={disabled}
              required={required}
              placeholder={placeholder || config?.placeholder}
              min={min}
              max={max}
              step={step}
              className={cn(
                'tabular-nums',
                isCurrency && 'pl-8',
                isPercent && 'pr-8',
                error && 'border-red-500'
              )}
            />
            {isPercent && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">
                %
              </span>
            )}
          </div>
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
        
        {isRating ? (
          <RatingDisplay value={3} max={max} />
        ) : (
          <Input
            type="number"
            disabled
            placeholder={placeholder || `Enter ${fieldTypeId}...`}
            className="bg-gray-50"
          />
        )}
      </div>
    );
  }

  return null;
}

export const NUMBER_FIELD_TYPES = NUMBER_SUBTYPES;
