'use client';

/**
 * Address Field Renderer
 * Handles: address with Mapbox autocomplete integration
 */

import React from 'react';
import { Label } from '@/ui-components/label';
import { cn } from '@/lib/utils';
import type { FieldRendererProps } from '../types';
import { AddressField, AddressValue } from '@/components/Tables/AddressField';
import { MapPin } from 'lucide-react';

const ADDRESS_SUBTYPES = [
  'address',
] as const;

function formatAddress(value: AddressValue | string | null): string {
  if (!value) return '';
  
  if (typeof value === 'string') return value;
  
  // Use the full_address if available
  if (value.full_address) return value.full_address;
  
  const parts = [];
  if (value.street_address) parts.push(value.street_address);
  if (value.city) parts.push(value.city);
  if (value.state) parts.push(value.state);
  if (value.postal_code) parts.push(value.postal_code);
  if (value.country && value.country !== 'United States') parts.push(value.country);
  
  return parts.join(', ');
}

export function AddressRenderer(props: FieldRendererProps): React.ReactElement | null {
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

  const addressValue = value as AddressValue | string | null;
  const formattedAddress = formatAddress(addressValue);

  // Display mode - just show the formatted address
  if (mode === 'display' || mode === 'compact') {
    if (!formattedAddress) {
      return (
        <span className={cn('text-gray-400 text-sm', className)}>
          {mode === 'compact' ? '—' : 'No address'}
        </span>
      );
    }

    return (
      <div className={cn('flex items-start gap-2', className)}>
        <MapPin className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
        <span className="text-gray-900 text-sm">{formattedAddress}</span>
      </div>
    );
  }

  // Edit mode - inline editing for table cells
  if (mode === 'edit') {
    return (
      <AddressField
        value={addressValue}
        onChange={(newValue) => onChange?.(newValue)}
        placeholder={placeholder || 'Start typing an address...'}
        isTableCell={true}
        className={className}
      />
    );
  }

  // Form mode - full form input with label
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
        
        <AddressField
          value={addressValue}
          onChange={(newValue) => onChange?.(newValue)}
          placeholder={placeholder || config?.placeholder || 'Start typing an address...'}
          isTableCell={false}
        />
        
        {error && (
          <p className="text-sm text-red-500">{error}</p>
        )}
      </div>
    );
  }

  // Preview mode - for builder
  if (mode === 'preview') {
    return (
      <div className={cn('space-y-2', className)}>
        <Label className="text-gray-500">
          {field.label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </Label>
        <div className="relative">
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <div className="h-10 px-3 pl-10 border rounded-md bg-gray-50 flex items-center text-gray-400 text-sm">
            {placeholder || 'Start typing an address...'}
          </div>
        </div>
      </div>
    );
  }

  return null;
}

// Export supported types for registration
export const ADDRESS_FIELD_TYPES = ADDRESS_SUBTYPES;
