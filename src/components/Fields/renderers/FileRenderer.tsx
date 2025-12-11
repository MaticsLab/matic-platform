'use client';

/**
 * File Field Renderer
 * Handles: file, image, attachment, signature
 */

import React, { useRef, useState } from 'react';
import { Label } from '@/ui-components/label';
import { Button } from '@/ui-components/button';
import { cn } from '@/lib/utils';
import { Upload, FileText, Image as ImageIcon, X, Download, Eye, Trash2 } from 'lucide-react';
import type { FieldRendererProps } from '../types';
import { FIELD_TYPES } from '@/types/field-types';

const FILE_SUBTYPES = [
  FIELD_TYPES.FILE,
  FIELD_TYPES.IMAGE,
  FIELD_TYPES.ATTACHMENT,
  FIELD_TYPES.SIGNATURE,
] as const;

interface FileValue {
  id?: string;
  name: string;
  url: string;
  size?: number;
  type?: string;
  uploaded_at?: string;
}

function normalizeFileValue(value: any): FileValue[] {
  if (!value) return [];
  
  // Single file object
  if (typeof value === 'object' && !Array.isArray(value)) {
    if (value.url || value.name) {
      return [value as FileValue];
    }
    return [];
  }
  
  // Array of files
  if (Array.isArray(value)) {
    return value.filter((v) => v && (v.url || v.name)) as FileValue[];
  }
  
  // URL string
  if (typeof value === 'string' && value.startsWith('http')) {
    return [{ name: 'File', url: value }];
  }
  
  return [];
}

function formatFileSize(bytes?: number): string {
  if (!bytes) return '';
  
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(file: FileValue) {
  const type = file.type || '';
  const name = file.name || '';
  
  if (type.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(name)) {
    return ImageIcon;
  }
  
  return FileText;
}

function FileThumbnail({ file, onRemove }: { file: FileValue; onRemove?: () => void }) {
  const Icon = getFileIcon(file);
  const isImage = file.type?.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(file.name || '');
  
  return (
    <div className="group relative flex items-center gap-2 p-2 border rounded-md bg-gray-50 hover:bg-gray-100">
      {isImage && file.url ? (
        <img
          src={file.url}
          alt={file.name}
          className="w-10 h-10 object-cover rounded"
        />
      ) : (
        <div className="w-10 h-10 flex items-center justify-center bg-gray-200 rounded">
          <Icon size={20} className="text-gray-500" />
        </div>
      )}
      
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{file.name}</p>
        {file.size && (
          <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
        )}
      </div>
      
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {file.url && (
          <a
            href={file.url}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1 hover:bg-gray-200 rounded"
          >
            <Download size={14} />
          </a>
        )}
        {onRemove && (
          <button
            onClick={onRemove}
            className="p-1 hover:bg-red-100 text-red-500 rounded"
          >
            <X size={14} />
          </button>
        )}
      </div>
    </div>
  );
}

export function FileRenderer(props: FieldRendererProps): React.ReactElement | null {
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

  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  
  const fieldTypeId = field.field_type_id || field.type || 'file';
  const files = normalizeFileValue(value);
  const isImage = fieldTypeId === FIELD_TYPES.IMAGE || fieldTypeId === 'image';
  const isSignature = fieldTypeId === FIELD_TYPES.SIGNATURE || fieldTypeId === 'signature';
  const allowMultiple = config?.multiple ?? false;
  const acceptTypes = config?.accept || (isImage ? 'image/*' : undefined);
  const maxSize = config?.maxSize; // in bytes

  const handleFileSelect = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    
    // For now, just store file metadata - actual upload handled by parent
    const newFiles: FileValue[] = Array.from(fileList).map((file) => ({
      name: file.name,
      url: URL.createObjectURL(file),
      size: file.size,
      type: file.type,
      // The actual file object could be stored here for upload
      _file: file,
    } as FileValue & { _file: File }));
    
    if (allowMultiple) {
      onChange?.([...files, ...newFiles]);
    } else {
      onChange?.(newFiles[0]);
    }
  };

  const handleRemove = (index: number) => {
    if (allowMultiple) {
      const newFiles = files.filter((_, i) => i !== index);
      onChange?.(newFiles.length > 0 ? newFiles : null);
    } else {
      onChange?.(null);
    }
  };

  // Display mode
  if (mode === 'display' || mode === 'compact') {
    if (files.length === 0) {
      return (
        <span className={cn('text-gray-400 text-sm', className)}>
          {mode === 'compact' ? '—' : 'No file'}
        </span>
      );
    }

    if (mode === 'compact') {
      return (
        <div className={cn('flex items-center gap-1', className)}>
          <FileText size={14} className="text-gray-400" />
          <span className="text-sm">{files.length} file{files.length !== 1 ? 's' : ''}</span>
        </div>
      );
    }

    if (isImage && files.length > 0) {
      return (
        <div className={cn('flex flex-wrap gap-2', className)}>
          {files.map((file, i) => (
            <a
              key={i}
              href={file.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block"
            >
              <img
                src={file.url}
                alt={file.name}
                className="w-16 h-16 object-cover rounded border hover:border-blue-500"
              />
            </a>
          ))}
        </div>
      );
    }

    return (
      <div className={cn('space-y-1', className)}>
        {files.map((file, i) => (
          <FileThumbnail key={i} file={file} />
        ))}
      </div>
    );
  }

  // Edit mode - compact uploader
  if (mode === 'edit') {
    return (
      <div className={className}>
        <input
          ref={inputRef}
          type="file"
          accept={acceptTypes}
          multiple={allowMultiple}
          onChange={(e) => handleFileSelect(e.target.files)}
          className="hidden"
          disabled={disabled}
        />
        
        {files.length > 0 ? (
          <div className="space-y-1">
            {files.map((file, i) => (
              <FileThumbnail
                key={i}
                file={file}
                onRemove={disabled ? undefined : () => handleRemove(i)}
              />
            ))}
            {allowMultiple && !disabled && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => inputRef.current?.click()}
              >
                <Upload size={14} className="mr-1" />
                Add more
              </Button>
            )}
          </div>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => inputRef.current?.click()}
            disabled={disabled}
            className="w-full"
          >
            <Upload size={14} className="mr-2" />
            {isImage ? 'Upload image' : 'Upload file'}
          </Button>
        )}
      </div>
    );
  }

  // Form mode - full uploader with drag & drop
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
        
        <input
          ref={inputRef}
          type="file"
          accept={acceptTypes}
          multiple={allowMultiple}
          onChange={(e) => handleFileSelect(e.target.files)}
          className="hidden"
          disabled={disabled}
        />
        
        <div
          className={cn(
            'border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors',
            isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300',
            disabled && 'opacity-50 cursor-not-allowed',
            error && 'border-red-300'
          )}
          onClick={() => !disabled && inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            if (!disabled) setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            if (!disabled) handleFileSelect(e.dataTransfer.files);
          }}
        >
          <Upload className="mx-auto h-8 w-8 text-gray-400" />
          <p className="mt-2 text-sm text-gray-600">
            Click to upload or drag and drop
          </p>
          <p className="mt-1 text-xs text-gray-400">
            {isImage ? 'PNG, JPG, GIF up to 10MB' : 'PDF, DOC, XLS up to 10MB'}
          </p>
        </div>
        
        {files.length > 0 && (
          <div className="space-y-2 mt-3">
            {files.map((file, i) => (
              <FileThumbnail
                key={i}
                file={file}
                onRemove={disabled ? undefined : () => handleRemove(i)}
              />
            ))}
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
        
        <div className="border-2 border-dashed rounded-lg p-6 text-center bg-gray-50">
          <Upload className="mx-auto h-8 w-8 text-gray-300" />
          <p className="mt-2 text-sm text-gray-400">
            {isImage ? 'Image upload' : 'File upload'}
          </p>
        </div>
      </div>
    );
  }

  return null;
}

export const FILE_FIELD_TYPES = FILE_SUBTYPES;
