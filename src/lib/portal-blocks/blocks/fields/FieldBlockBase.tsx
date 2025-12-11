'use client';

/**
 * Field Block Base
 * 
 * Base component for all field blocks that bridges to the unified FieldRenderer.
 * This ensures field blocks use the same rendering as the rest of the app.
 */

import React from 'react';
import { cn } from '@/lib/utils';
import { FieldRenderer } from '@/components/Fields/FieldRenderer';
import { FIELD_TYPES } from '@/types/field-types';
import type { BlockComponentProps } from '../../BlockRenderer';
import type { FieldBlockConfig } from '@/types/portal-blocks';

export interface FieldBlockProps extends Omit<BlockComponentProps, 'block'> {
  block: {
    id: string;
    type: string;
    category: 'field';
    position: number;
    config: FieldBlockConfig;
    visibility?: Record<string, unknown>;
  };
  /** The unified field type ID */
  fieldTypeId: string;
}

export function FieldBlockBase({ 
  block, 
  mode, 
  values, 
  onChange, 
  themeColor,
  fieldTypeId,
  className 
}: FieldBlockProps) {
  const { 
    label, 
    name, 
    description, 
    placeholder, 
    required, 
    disabled,
    width = 'full',
  } = block.config;
  
  const value = values?.[name];
  
  // Convert block config to unified Field format
  const fieldDefinition = {
    id: block.id,
    table_id: '',
    field_type_id: fieldTypeId,
    type: fieldTypeId,
    name: name || block.id,
    label: label,
    description,
    position: block.position,
    width: 200,
    is_visible: true,
    is_primary: false,
    is_searchable: true,
    config: {
      placeholder,
      ...block.config,
    },
    created_at: '',
    updated_at: '',
  };
  
  const widthClass = {
    full: 'w-full',
    half: 'w-1/2',
    third: 'w-1/3',
    quarter: 'w-1/4',
  }[width];
  
  // Determine render mode based on block mode
  // Use 'form' mode so the FieldRenderer shows labels
  const renderMode = mode === 'view' ? 'form' : 'form';
  
  return (
    <div className={cn(widthClass, 'inline-block align-top', className)}>
      {/* FieldRenderer handles label/description in form mode */}
      <FieldRenderer
        field={fieldDefinition}
        value={value}
        onChange={(newValue) => onChange?.(name, newValue)}
        mode={renderMode}
        context="portal"
        disabled={disabled || mode === 'preview'}
        required={required}
        viewConfig={{ themeColor }}
      />
    </div>
  );
}
