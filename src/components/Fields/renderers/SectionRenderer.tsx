'use client';

/**
 * Section Field Renderer
 * Handles: section, group, fieldset (visual grouping containers)
 * 
 * Section fields are layout containers that group related fields together.
 * They don't store data themselves - they organize child fields visually.
 */

import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp, Folder, LayoutGrid } from 'lucide-react';
import type { FieldRendererProps } from '../types';
import { safeFieldString } from '../types';
import { FIELD_TYPES } from '@/types/field-types';

const SECTION_SUBTYPES = [
  FIELD_TYPES.SECTION,
  FIELD_TYPES.GROUP,
  'fieldset',
  'container',
] as const;

export function SectionRenderer(props: FieldRendererProps): React.ReactElement | null {
  const {
    field,
    mode,
    config,
    className,
    childFields = [],
    childValues = [],
  } = props;

  const [isExpanded, setIsExpanded] = useState(true);
  
  const collapsible = config?.collapsible ?? true;
  const defaultExpanded = config?.defaultExpanded ?? config?.default_expanded ?? true;
  const columns = config?.columns ?? 1;
  const showBorder = config?.showBorder ?? config?.show_border ?? true;
  const showHeader = config?.showHeader ?? config?.show_header ?? true;

  // Initialize expanded state
  React.useEffect(() => {
    setIsExpanded(defaultExpanded);
  }, [defaultExpanded]);

  const toggleExpand = () => {
    if (collapsible) {
      setIsExpanded((prev) => !prev);
    }
  };

  // Display mode - just show section info
  if (mode === 'display' || mode === 'compact') {
    if (mode === 'compact') {
      return (
        <div className={cn('flex items-center gap-1 text-gray-500', className)}>
          <Folder size={14} />
          <span className="text-sm">{safeFieldString(field.label)}</span>
        </div>
      );
    }

    return (
      <div className={cn('space-y-2', className)}>
        <div className="font-medium text-gray-700 flex items-center gap-2">
          <Folder size={16} className="text-gray-400" />
          {safeFieldString(field.label)}
        </div>
        {field.description && (
          <p className="text-sm text-gray-500">{safeFieldString(field.description)}</p>
        )}
        {childFields.length > 0 && (
          <p className="text-xs text-gray-400">
            Contains {childFields.length} field{childFields.length !== 1 ? 's' : ''}
          </p>
        )}
      </div>
    );
  }

  // Edit mode - not editable, just a container
  if (mode === 'edit') {
    return (
      <div className={cn('text-gray-500 text-sm', className)}>
        <Folder size={14} className="inline mr-1" />
        {safeFieldString(field.label)}
      </div>
    );
  }

  // Form mode - full section with header
  if (mode === 'form') {
    return (
      <div className={cn(
        'rounded-lg',
        showBorder && 'border',
        className
      )}>
        {/* Section header */}
        {showHeader && (
          <div
            className={cn(
              'flex items-center justify-between px-4 py-3',
              showBorder && 'border-b bg-gray-50',
              collapsible && 'cursor-pointer hover:bg-gray-100'
            )}
            onClick={toggleExpand}
          >
            <div>
              <h3 className="font-medium text-gray-900 flex items-center gap-2">
                <LayoutGrid size={18} className="text-gray-400" />
                {safeFieldString(field.label)}
              </h3>
              {field.description && (
                <p className="text-sm text-gray-500 mt-0.5">{safeFieldString(field.description)}</p>
              )}
            </div>
            
            {collapsible && (
              <button type="button" className="text-gray-400 hover:text-gray-600">
                {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
              </button>
            )}
          </div>
        )}
        
        {/* Section content */}
        {isExpanded && (
          <div className={cn(
            'p-4',
            columns > 1 && `grid gap-4`,
            columns === 2 && 'grid-cols-2',
            columns === 3 && 'grid-cols-3',
            columns === 4 && 'grid-cols-4'
          )}>
            {childFields.length > 0 ? (
              // Child fields would be rendered by parent component
              <div className="space-y-4">
                {/* Placeholder for child fields */}
                <p className="text-sm text-gray-400 italic">
                  {childFields.length} field{childFields.length !== 1 ? 's' : ''} in this section
                </p>
              </div>
            ) : (
              <p className="text-sm text-gray-400 italic text-center py-4">
                No fields in this section
              </p>
            )}
          </div>
        )}
      </div>
    );
  }

  // Preview mode - show section structure
  if (mode === 'preview') {
    return (
      <div className={cn(
        'border-2 border-dashed rounded-lg overflow-hidden',
        className
      )}>
        <div className="px-4 py-3 bg-gray-50 border-b border-dashed">
          <div className="flex items-center gap-2 text-gray-500">
            <LayoutGrid size={16} />
            <span className="font-medium">{safeFieldString(field.label) || 'Section'}</span>
            {collapsible && (
              <span className="text-xs text-gray-400">(collapsible)</span>
            )}
          </div>
          {field.description && (
            <p className="text-xs text-gray-400 mt-1">{safeFieldString(field.description)}</p>
          )}
        </div>
        
        <div className={cn(
          'p-4 min-h-[60px]',
          columns > 1 && `grid gap-2`,
          columns === 2 && 'grid-cols-2',
          columns === 3 && 'grid-cols-3'
        )}>
          {childFields.length > 0 ? (
            childFields.slice(0, 4).map((cf) => (
              <div
                key={cf.id || cf.name}
                className="h-8 bg-gray-100 rounded flex items-center px-2 text-xs text-gray-400"
              >
                {cf.label}
              </div>
            ))
          ) : (
            <div className="flex items-center justify-center text-gray-400 text-sm">
              Drop fields here
            </div>
          )}
          {childFields.length > 4 && (
            <div className="col-span-full text-xs text-gray-400 text-center">
              +{childFields.length - 4} more fields
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
}

export const SECTION_FIELD_TYPES = SECTION_SUBTYPES;
