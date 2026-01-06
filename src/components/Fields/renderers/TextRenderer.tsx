'use client';

/**
 * Text Field Renderer
 * Handles: text, long_text, email, url, phone
 */

import React from 'react';
import { Input } from '@/ui-components/input';
import { Textarea } from '@/ui-components/textarea';
import { Label } from '@/ui-components/label';
import { cn } from '@/lib/utils';
import type { FieldRendererProps } from '../types';
import { safeFieldString } from '../types';
import { FIELD_TYPES } from '@/types/field-types';

// Sub-types that this renderer handles
const TEXT_SUBTYPES = [
  FIELD_TYPES.TEXT,
  FIELD_TYPES.LONG_TEXT,
  'single_line_text',
  'textarea',
  FIELD_TYPES.EMAIL,
  FIELD_TYPES.URL,
  FIELD_TYPES.PHONE,
] as const;

type TextFieldType = typeof TEXT_SUBTYPES[number];

function getInputType(fieldTypeId: string): string {
  switch (fieldTypeId) {
    case FIELD_TYPES.EMAIL:
    case 'email':
      return 'email';
    case FIELD_TYPES.URL:
    case 'url':
      return 'url';
    case FIELD_TYPES.PHONE:
    case 'phone':
      return 'tel';
    default:
      return 'text';
  }
}

function isLongText(fieldTypeId: string): boolean {
  return fieldTypeId === FIELD_TYPES.LONG_TEXT || 
         fieldTypeId === 'long_text' || 
         fieldTypeId === 'textarea';
}

export function TextRenderer(props: FieldRendererProps): React.ReactElement | null {
  const {
    field,
    value,
    onChange,
    mode,
    context,
    disabled = false,
    required = false,
    config,
    error,
    className,
    placeholder,
  } = props;

  const fieldTypeId = field.field_type_id || field.type || 'text';
  const inputType = getInputType(fieldTypeId);
  const isTextarea = isLongText(fieldTypeId);
  const maxLength = config?.maxLength || config?.max_length;
  const minLength = config?.minLength || config?.min_length;
  const minWords = config?.minWords || config?.min_words || field.validation?.minWords || field.validation?.min_words;
  const maxWords = config?.maxWords || config?.max_words || field.validation?.maxWords || field.validation?.max_words;
  const rows = config?.rows || 4;

  // Display mode - just show the value
  if (mode === 'display' || mode === 'compact') {
    if (!value) {
      return (
        <span className={cn('text-gray-400 text-sm', className)}>
          {mode === 'compact' ? '—' : 'Empty'}
        </span>
      );
    }

    // For URLs, make them clickable
    if (fieldTypeId === FIELD_TYPES.URL || fieldTypeId === 'url') {
      return (
        <a
          href={value}
          target="_blank"
          rel="noopener noreferrer"
          className={cn('text-blue-600 hover:underline truncate block', className)}
        >
          {value}
        </a>
      );
    }

    // For emails, make them clickable
    if (fieldTypeId === FIELD_TYPES.EMAIL || fieldTypeId === 'email') {
      return (
        <a
          href={`mailto:${value}`}
          className={cn('text-blue-600 hover:underline', className)}
        >
          {value}
        </a>
      );
    }

    // For phones, make them clickable
    if (fieldTypeId === FIELD_TYPES.PHONE || fieldTypeId === 'phone') {
      return (
        <a
          href={`tel:${value}`}
          className={cn('text-blue-600 hover:underline', className)}
        >
          {value}
        </a>
      );
    }

    // Regular text
    return (
      <span className={cn('text-gray-900', isTextarea && 'whitespace-pre-wrap', className)}>
        {isTextarea && mode === 'compact' 
          ? (value?.length > 50 ? value.slice(0, 50) + '...' : value)
          : value}
      </span>
    );
  }

  // Edit mode - inline editing for table cells
  if (mode === 'edit') {
    if (isTextarea) {
      return (
        <Textarea
          value={value || ''}
          onChange={(e) => onChange?.(e.target.value)}
          disabled={disabled}
          placeholder={placeholder}
          rows={2}
          className={cn('w-full min-h-[60px] text-sm', className)}
          maxLength={maxLength}
          minLength={minLength}
        />
      );
    }

    return (
      <Input
        type={inputType}
        value={value || ''}
        onChange={(e) => onChange?.(e.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        className={cn('w-full h-8 text-sm', className)}
        maxLength={maxLength}
        minLength={minLength}
      />
    );
  }

  // Form mode - full form input with label
  if (mode === 'form') {
    const label = safeFieldString(field.label);
    const description = safeFieldString(field.description);
    return (
      <div className={cn('space-y-2', className)}>
        <Label htmlFor={field.name}>
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </Label>
        
        {description && (
          <p className="text-sm text-gray-500">{description}</p>
        )}
        
        {isTextarea ? (
          (() => {
            const wordCount = (value || '').trim().split(/\s+/).filter(Boolean).length;
            let wordError = '';
            if (typeof minWords === 'number' && wordCount < minWords) {
              wordError = `Must be at least ${minWords} words.`;
            } else if (typeof maxWords === 'number' && wordCount > maxWords) {
              wordError = `Must be at most ${maxWords} words.`;
            }
            return (
              <>
                <Textarea
                  id={field.name}
                  value={value || ''}
                  onChange={(e) => onChange?.(e.target.value)}
                  disabled={disabled}
                  required={required}
                  placeholder={placeholder || config?.placeholder}
                  rows={rows}
                  maxLength={maxLength}
                  minLength={minLength}
                  className={cn((error || wordError) && 'border-red-500')}
                />
                <div className="flex justify-between items-center mt-1">
                  <span className="text-xs text-gray-400">{wordCount} word{wordCount === 1 ? '' : 's'}</span>
                  {(minWords || maxWords) && (
                    <span className="text-xs text-gray-400">
                      {minWords && `Min: ${minWords} `}
                      {maxWords && `Max: ${maxWords}`}
                    </span>
                  )}
                </div>
                {(error || wordError) && (
                  <p className="text-sm text-red-500">{error || wordError}</p>
                )}
              </>
            );
          })()
        ) : (
          <Input
            id={field.name}
            type={inputType}
            value={value || ''}
            onChange={(e) => onChange?.(e.target.value)}
            disabled={disabled}
            required={required}
            placeholder={placeholder || config?.placeholder}
            maxLength={maxLength}
            minLength={minLength}
            className={cn(error && 'border-red-500')}
          />
        )}
        
        {error && (
          <p className="text-sm text-red-500">{error}</p>
        )}
        
        {maxLength && !isTextarea && (
          <p className="text-xs text-gray-400 text-right">
            {(value?.length || 0)} / {maxLength}
          </p>
        )}
      </div>
    );
  }

  // Preview mode - for builder
  if (mode === 'preview') {
    const label = safeFieldString(field.label);
    return (
      <div className={cn('space-y-2', className)}>
        <Label className="text-gray-500 flex items-center gap-1">
          {label}
          {required && <span className="text-red-500">*</span>}
        </Label>
        
        {isTextarea ? (
          <Textarea
            disabled
            placeholder={placeholder || 'Enter text...'}
            rows={rows}
            className="bg-gray-50"
          />
        ) : (
          <Input
            type={inputType}
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

// Export supported types for registration
export const TEXT_FIELD_TYPES = TEXT_SUBTYPES;
