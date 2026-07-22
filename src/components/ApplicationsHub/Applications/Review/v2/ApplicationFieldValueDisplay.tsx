'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { NOT_PROVIDED } from '@/constants/fallbacks';
import {
  parseValueIfNeeded, isFileValue, InlineDocumentPreview,
} from './InlineDocumentPreview';

// Re-exported so existing call sites (`./ApplicationFieldValueDisplay`) keep working
// unchanged — the file/document-preview helpers now live in their own module
// (InlineDocumentPreview.tsx) purely to keep this file under the line-count target.
export { parseValueIfNeeded, isFileValue, getFileType, formatFileSize, InlineDocumentPreview } from './InlineDocumentPreview';

// Helper to format field labels nicely
export function formatFieldLabel(key: string, fieldMap?: Map<string, any>): string {
  // First try to look up the field in the map
  if (fieldMap) {
    // Try direct key match
    let fieldDef = fieldMap.get(key);

    // Try without "Field-" prefix
    if (!fieldDef && key.startsWith('Field-')) {
      const withoutPrefix = key.replace(/^Field-/, '');
      fieldDef = fieldMap.get(withoutPrefix);
    }

    // Try matching by ID or name (for repeater subfields that use field IDs/names as keys)
    if (!fieldDef) {
      for (const [mapKey, mapField] of fieldMap.entries()) {
        const mapFieldId = mapField.id || mapKey;
        const mapFieldName = mapField.name;

        // Exact match by ID
        if (mapFieldId === key || mapFieldId === key.replace(/^Field-/, '')) {
          fieldDef = mapField;
          break;
        }

        // Match by name (for repeater subfields)
        if (mapFieldName && (mapFieldName === key || mapFieldName.toLowerCase().replace(/\s+/g, '_') === key.toLowerCase())) {
          fieldDef = mapField;
          break;
        }

        // Try matching the base part (before the last segment) for complex IDs
        // e.g., "Field-1766110112708-zg4hskrds" might match a field with ID "Field-1766110112708-..."
        if (key.includes('-') && mapFieldId.includes('-')) {
          const keyParts = key.split('-');
          const mapIdParts = mapFieldId.split('-');
          // Match if first parts are similar (timestamp matching)
          if (keyParts.length >= 2 && mapIdParts.length >= 2 && keyParts[0] === mapIdParts[0]) {
            fieldDef = mapField;
            break;
          }
        }
      }
    }

    // If found, use the label
    if (fieldDef && (fieldDef.label || fieldDef.name)) {
      return fieldDef.label || fieldDef.name || key;
    }
  }

  // Fallback to formatting the key
  return key
    .replace(/^Field-/, '')
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^./, str => str.toUpperCase());
}

// Helper function to render field values properly (handles arrays, objects, repeaters, files)
export function renderFieldValue(value: any, depth: number = 0, fieldLabel?: string, fieldMap?: Map<string, any>): React.ReactNode {
  // Handle null/undefined/empty
  if (value === null || value === undefined || value === '') {
    return <span className="text-gray-400 italic">{NOT_PROVIDED}</span>;
  }

  // Try to parse JSON strings first
  const parsedValue = parseValueIfNeeded(value);

  // Check if this is a file/document - render with preview
  if (isFileValue(parsedValue)) {
    return <InlineDocumentPreview value={parsedValue} fieldLabel={fieldLabel} />;
  }

  // Handle booleans
  if (typeof parsedValue === 'boolean') {
    return <span className={parsedValue ? 'text-green-600' : 'text-gray-500'}>{parsedValue ? 'Yes' : 'No'}</span>;
  }

  // Handle numbers
  if (typeof parsedValue === 'number') {
    return <span className="font-medium">{parsedValue.toLocaleString()}</span>;
  }

  // Handle strings
  if (typeof parsedValue === 'string') {
    // Check if it's a URL to a file (but wasn't caught by isFileValue)
    if (parsedValue.startsWith('http://') || parsedValue.startsWith('https://')) {
      // Check if it looks like a file URL
      if (/\.(pdf|jpg|jpeg|png|gif|doc|docx|xls|xlsx)($|\?)/i.test(parsedValue)) {
        return <InlineDocumentPreview value={{ url: parsedValue, name: parsedValue.split('/').pop() || 'Document' }} />;
      }
      return (
        <a href={parsedValue} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline break-all">
          {parsedValue}
        </a>
      );
    }
    // Long text
    if (parsedValue.length > 200) {
      return <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">{parsedValue}</p>;
    }
    return <span className="text-gray-900">{parsedValue}</span>;
  }

  // Handle arrays
  if (Array.isArray(parsedValue)) {
    if (parsedValue.length === 0) {
      return <span className="text-gray-400 italic">None</span>;
    }

    // Check if it's an array of files
    if (isFileValue(parsedValue)) {
      return <InlineDocumentPreview value={parsedValue} fieldLabel={fieldLabel} />;
    }

    // Check if it's an array of primitives (strings, numbers)
    if (parsedValue.every(v => typeof v !== 'object' || v === null)) {
      // Filter out empty strings and join
      const filtered = parsedValue.filter(v => v !== null && v !== undefined && v !== '');
      if (filtered.length === 0) {
        return <span className="text-gray-400 italic">None</span>;
      }
      return <span className="text-gray-900">{filtered.join(', ')}</span>;
    }

    // Array of objects (repeater items)
    return (
      <div className="space-y-2 mt-1">
        {parsedValue.map((item, idx) => (
          <div key={idx} className="bg-gray-50 border border-gray-200 rounded-lg p-3">
            <div className="text-xs font-medium text-gray-500 uppercase mb-2">Item {idx + 1}</div>
            <div className="grid gap-2">
              {typeof item === 'object' && item !== null ? (
                Object.entries(item)
                  .filter(([k]) => !k.startsWith('_')) // Skip internal fields like _id
                  .map(([k, v]) => (
                    <div key={k} className="flex flex-wrap gap-x-2">
                      <span className="text-xs font-medium text-gray-500 min-w-[80px]">{formatFieldLabel(k, fieldMap)}:</span>
                      <span className="text-sm text-gray-900">{renderFieldValue(v, depth + 1, k, fieldMap)}</span>
                    </div>
                  ))
              ) : (
                <span className="text-sm text-gray-900">{String(item)}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Handle objects
  if (typeof parsedValue === 'object') {
    // Address field — render as a single clean string
    if ('full_address' in parsedValue || 'city' in parsedValue) {
      const address =
        parsedValue.full_address ||
        [parsedValue.street_address, parsedValue.city, parsedValue.state, parsedValue.postal_code]
          .filter(Boolean)
          .join(', ');
      return <span className="text-gray-900">{address}</span>;
    }

    const entries = Object.entries(parsedValue).filter(([k]) => !k.startsWith('_')); // Skip internal fields

    if (entries.length === 0) {
      return <span className="text-gray-400 italic">Empty</span>;
    }

    // Unwrap single-value groups (e.g. {"field-1766110112708-zg4hskrds": "11"} → "11")
    if (entries.length === 1) {
      return renderFieldValue(entries[0][1], depth, fieldLabel, fieldMap);
    }

    // Check if all values are simple (no nested objects)
    const allSimple = entries.every(([, v]) => typeof v !== 'object' || v === null);

    if (allSimple && entries.length <= 4) {
      // Render inline for simple groups with few fields
      return (
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {entries.map(([k, v]) => (
            <span key={k} className="text-sm">
              <span className="text-gray-500">{formatFieldLabel(k, fieldMap)}:</span>{' '}
              <span className="text-gray-900 font-medium">{v === null || v === '' ? '-' : String(v)}</span>
            </span>
          ))}
        </div>
      );
    }

    // Render as nested card for complex groups
    return (
      <div className={cn("mt-1 rounded-lg border border-gray-200 overflow-hidden", depth === 0 ? "bg-white" : "bg-gray-50")}>
        <div className="divide-y divide-gray-100">
          {entries.map(([k, v]) => (
            <div key={k} className="px-3 py-2">
              <div className="text-xs font-medium text-blue-600 uppercase tracking-wide mb-1">
                {formatFieldLabel(k, fieldMap)}
              </div>
              <div className="text-gray-900">{renderFieldValue(v, depth + 1, k, fieldMap)}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return <span className="text-gray-900">{String(value)}</span>;
}
