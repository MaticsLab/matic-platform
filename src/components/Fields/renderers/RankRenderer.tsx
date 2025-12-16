'use client';

/**
 * Rank Field Renderer
 * Handles: rank - ordered selection of multiple options
 */

import React from 'react';
import { Label } from '@/ui-components/label';
import { Button } from '@/ui-components/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/ui-components/select';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';
import type { FieldRendererProps } from '../types';
import { FIELD_TYPES } from '@/types/field-types';

const RANK_SUBTYPES = [
  'rank',
] as const;

interface RankOption {
  value: string;
  label?: string;
}

function normalizeOptions(config: Record<string, any>, formContext?: Record<string, any>): RankOption[] {
  let rawOptions = config?.options || config?.items || [];
  
  // Handle dynamic options from source field
  if (config?.sourceField && config?.dynamicOptions && formContext) {
    console.log('🔍 RankRenderer dynamic options debug:', {
      sourceField: config.sourceField,
      dynamicOptions: config.dynamicOptions,
      formDataKeys: formContext._formData ? Object.keys(formContext._formData) : 'no formData',
      portalFieldIds: formContext._portalFields?.map((f: any) => f.id) || 'no portalFields',
      allFieldIds: formContext._allFields?.map((f: any) => f.id) || 'no allFields',
    });
    
    let sourceData = formContext._formData?.[config.sourceField];
    
    // Try to find by field ID in portal fields (original fields)
    if (!sourceData && formContext._portalFields) {
      const portalField = formContext._portalFields.find((f: any) => f.id === config.sourceField);
      if (portalField && formContext._formData) {
        // Try field id first, then check if data is stored by id
        sourceData = formContext._formData[portalField.id];
      }
    }
    
    // Fallback: try unified field definitions
    if (!sourceData && formContext._allFields) {
      const sourceFieldDef = formContext._allFields.find((f: any) => f.id === config.sourceField);
      if (sourceFieldDef && formContext._formData) {
        sourceData = formContext._formData[sourceFieldDef.name || sourceFieldDef.id];
      }
    }
    
    console.log('🔍 RankRenderer sourceData found:', { sourceData, isArray: Array.isArray(sourceData) });
    
    if (sourceData && Array.isArray(sourceData)) {
      const key = config.sourceKey || '';
      rawOptions = sourceData
        .map((item: any) => {
          if (typeof item === 'object' && item !== null) {
            // If a specific key is configured, try it first
            if (key && item[key]) return item[key];
            
            // Skip internal keys like 'id' that are auto-generated
            const skipKeys = ['id', '_id', 'key', 'index'];
            
            // Find the first non-empty string value that's not an internal key
            const entries = Object.entries(item);
            for (const [entryKey, entryValue] of entries) {
              if (skipKeys.includes(entryKey)) continue;
              if (typeof entryValue === 'string' && entryValue.trim()) {
                return entryValue;
              }
            }
            
            // Fallback: try common field names
            if (item.name) return item.name;
            if (item.label) return item.label;
            if (item.title) return item.title;
            if (item.value) return item.value;
            
            // Last resort: find any non-empty string
            const firstString = Object.values(item).find(v => typeof v === 'string' && v.trim());
            return firstString || null;
          }
          return String(item);
        })
        .filter((val: string | null) => val && val.trim() !== '');
    }
  }
  
  return rawOptions.map((opt: string | RankOption) => {
    if (typeof opt === 'string') {
      return { value: opt, label: opt };
    }
    return { value: opt.value, label: opt.label || opt.value };
  });
}

export function RankRenderer(props: FieldRendererProps): React.ReactElement | null {
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
    viewConfig,
  } = props;

  const options = normalizeOptions(config, viewConfig);
  const maxSelections = config?.maxSelections || 3;
  const currentValues: string[] = Array.isArray(value) ? value.map(String) : [];
  const themeColor = viewConfig?.themeColor || '#000';

  // Display mode
  if (mode === 'display' || mode === 'compact') {
    if (currentValues.length === 0) {
      return (
        <span className={cn('text-gray-400 text-sm', className)}>
          {mode === 'compact' ? '—' : 'Not ranked'}
        </span>
      );
    }

    return (
      <div className={cn('flex flex-wrap gap-2', className)}>
        {currentValues.map((val, idx) => (
          <div key={idx} className="flex items-center gap-1.5">
            <span 
              className="w-5 h-5 rounded-full text-white text-xs font-bold flex items-center justify-center"
              style={{ backgroundColor: themeColor }}
            >
              {idx + 1}
            </span>
            <span className="text-sm text-gray-900">{val}</span>
          </div>
        ))}
      </div>
    );
  }

  // Edit and Form mode - ranked selection
  if (mode === 'edit' || mode === 'form') {
    const handleChange = (index: number, newValue: string) => {
      const newValues = [...currentValues];
      while (newValues.length < maxSelections) newValues.push('');
      newValues[index] = newValue;
      onChange?.(newValues);
    };

    const handleClear = (index: number) => {
      const newValues = [...currentValues];
      newValues[index] = '';
      onChange?.(newValues);
    };

    const content = (
      <div className="space-y-4">
        <div className={cn(
          'grid gap-4',
          maxSelections <= 3 ? 'grid-cols-1 md:grid-cols-3' : 'grid-cols-1 md:grid-cols-2'
        )}>
          {Array.from({ length: maxSelections }).map((_, index) => (
            <div key={index} className="relative group">
              <div 
                className="absolute -left-2 -top-2 w-7 h-7 rounded-full text-white font-bold text-xs flex items-center justify-center z-10 shadow-sm border-2 border-white"
                style={{ backgroundColor: themeColor }}
              >
                {index + 1}
              </div>
              
              <div className="bg-gray-50 p-3 rounded-xl border border-gray-200 pt-5 group-hover:border-gray-300 transition-colors">
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-xs text-gray-500 uppercase font-semibold">
                    Choice #{index + 1}
                  </Label>
                  {currentValues[index] && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs text-gray-500 hover:text-gray-900"
                      onClick={() => handleClear(index)}
                      disabled={disabled}
                    >
                      Clear
                    </Button>
                  )}
                </div>
                
                <Select
                  value={currentValues[index] || ''}
                  onValueChange={(v) => handleChange(index, v)}
                  disabled={disabled}
                >
                  <SelectTrigger className="bg-white border-gray-200">
                    <SelectValue placeholder="Select option" />
                  </SelectTrigger>
                  <SelectContent>
                    {options.length > 0 ? (
                      options.map((opt) => (
                        <SelectItem
                          key={opt.value}
                          value={opt.value}
                          disabled={currentValues.includes(opt.value) && currentValues[index] !== opt.value}
                        >
                          {opt.label}
                        </SelectItem>
                      ))
                    ) : (
                      <div className="px-2 py-1.5 text-sm text-gray-500">No options available</div>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ))}
        </div>
        
        {options.length === 0 && (
          <div className="text-sm text-gray-400 text-center py-4 bg-gray-50 rounded-lg border border-dashed">
            No options available. {config?.sourceField ? 'Add items to the source field first.' : 'Configure options in field settings.'}
          </div>
        )}
      </div>
    );

    if (mode === 'form') {
      return (
        <div className={cn('space-y-2', className)}>
          <Label>
            {field.label}
            {required && <span className="text-red-500 ml-1">*</span>}
          </Label>
          
          {field.description && (
            <p className="text-sm text-gray-500">{field.description}</p>
          )}
          
          {content}
          
          {error && (
            <p className="text-sm text-red-500">{error}</p>
          )}
        </div>
      );
    }

    return content;
  }

  // Preview mode - for builder
  if (mode === 'preview') {
    return (
      <div className={cn('space-y-2', className)}>
        <Label className="text-gray-500">
          {field.label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </Label>
        
        <div className="grid grid-cols-3 gap-4">
          {Array.from({ length: Math.min(maxSelections, 3) }).map((_, idx) => (
            <div key={idx} className="relative">
              <div 
                className="absolute -left-1 -top-1 w-5 h-5 rounded-full bg-gray-400 text-white text-xs font-bold flex items-center justify-center z-10"
              >
                {idx + 1}
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 pt-4">
                <div className="text-xs text-gray-400">Choice #{idx + 1}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return null;
}

// Export supported types for registration
export const RANK_FIELD_TYPES = RANK_SUBTYPES;
