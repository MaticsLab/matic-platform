'use client';

import React, { useState } from 'react';
import { FileText, Image as ImageIcon, File, Eye, Download, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/ui-components/dialog';

interface FileValue {
  url?: string;
  name?: string;
  type?: string;
  mimeType?: string;
  size?: number;
}

interface FileCellProps {
  value: FileValue | FileValue[] | string | null;
  isSelected?: boolean;
  isEditing?: boolean;
  onClick?: () => void;
  onDoubleClick?: () => void;
  className?: string;
}

function formatFileSize(bytes?: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(mimeType?: string, fileName?: string): typeof FileText {
  if (!mimeType && !fileName) return FileText;
  
  const type = (mimeType || '').toLowerCase();
  const name = (fileName || '').toLowerCase();
  
  if (type.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|svg)/.test(name)) {
    return ImageIcon;
  }
  if (type.includes('pdf') || name.includes('.pdf')) {
    return FileText;
  }
  return File;
}

function parseFileValue(value: any): FileValue[] {
  if (!value) return [];
  
  // If it's a string URL
  if (typeof value === 'string') {
    if (value.startsWith('http://') || value.startsWith('https://') || value.startsWith('blob:')) {
      return [{
        url: value,
        name: value.split('/').pop()?.split('?')[0] || 'File',
      }];
    }
    return [];
  }
  
  // If it's an array
  if (Array.isArray(value)) {
    return value.map(v => {
      if (typeof v === 'string') {
        return { url: v, name: v.split('/').pop()?.split('?')[0] || 'File' };
      }
      return v as FileValue;
    });
  }
  
  // If it's an object
  if (typeof value === 'object') {
    return [value as FileValue];
  }
  
  return [];
}

export function FileCell({
  value,
  isSelected = false,
  isEditing = false,
  onClick,
  onDoubleClick,
  className,
}: FileCellProps) {
  const [previewFile, setPreviewFile] = useState<FileValue | null>(null);
  const files = parseFileValue(value);
  
  if (files.length === 0) {
    return (
      <div
        className={cn(
          'px-3 py-2 cursor-pointer hover:bg-blue-50 text-gray-400 text-sm',
          isSelected && 'ring-2 ring-inset ring-blue-500 bg-blue-50',
          className
        )}
        onClick={onClick}
        onDoubleClick={onDoubleClick}
      >
        Empty
      </div>
    );
  }
  
  // For single file, show thumbnail/icon
  if (files.length === 1) {
    const file = files[0];
    const url = file.url || '';
    const name = file.name || 'File';
    const FileIcon = getFileIcon(file.mimeType || file.type, name);
    const isImage = (file.mimeType || file.type || '').startsWith('image/') || 
                    /\.(jpg|jpeg|png|gif|webp|svg)/.test(name.toLowerCase());
    const isPdf = (file.mimeType || file.type || '').includes('pdf') || name.toLowerCase().includes('.pdf');
    
    return (
      <>
        <div
          className={cn(
            'px-3 py-2 cursor-pointer hover:bg-blue-50 flex items-center gap-2',
            isSelected && 'ring-2 ring-inset ring-blue-500 bg-blue-50',
            className
          )}
          onClick={onClick}
          onDoubleClick={() => {
            if (url && !url.startsWith('blob:')) {
              setPreviewFile(file);
            }
            onDoubleClick?.();
          }}
        >
          {isImage && url && !url.startsWith('blob:') ? (
            <div className="w-8 h-8 rounded border border-gray-200 overflow-hidden bg-gray-100 flex-shrink-0">
              <img
                src={url}
                alt={name}
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            </div>
          ) : (
            <div className="w-8 h-8 rounded border border-gray-200 bg-gray-50 flex items-center justify-center flex-shrink-0">
              <FileIcon className="w-4 h-4 text-gray-500" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="text-sm text-gray-900 truncate">{name}</div>
            {file.size && (
              <div className="text-xs text-gray-500">{formatFileSize(file.size)}</div>
            )}
          </div>
        </div>
        
        {/* Document Preview Dialog */}
        {previewFile && (
          <Dialog open={!!previewFile} onOpenChange={() => setPreviewFile(null)}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
              <DialogHeader>
                <DialogTitle className="flex items-center justify-between">
                  <span>{previewFile.name || 'Document Preview'}</span>
                  <div className="flex items-center gap-2">
                    {previewFile.url && (
                      <>
                        <a
                          href={previewFile.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 hover:bg-gray-100 rounded transition-colors"
                          title="Open in new tab"
                        >
                          <Eye className="w-4 h-4 text-gray-500" />
                        </a>
                        <a
                          href={previewFile.url}
                          download={previewFile.name}
                          className="p-1.5 hover:bg-gray-100 rounded transition-colors"
                          title="Download"
                        >
                          <Download className="w-4 h-4 text-gray-500" />
                        </a>
                      </>
                    )}
                    <button
                      onClick={() => setPreviewFile(null)}
                      className="p-1.5 hover:bg-gray-100 rounded transition-colors"
                    >
                      <X className="w-4 h-4 text-gray-500" />
                    </button>
                  </div>
                </DialogTitle>
              </DialogHeader>
              <div className="flex-1 overflow-auto bg-gray-100">
                {isPdf && previewFile.url ? (
                  <iframe
                    src={`${previewFile.url}#toolbar=0&navpanes=0`}
                    className="w-full h-full min-h-[600px]"
                    title={previewFile.name}
                  />
                ) : isImage && previewFile.url ? (
                  <div className="flex items-center justify-center p-8">
                    <img
                      src={previewFile.url}
                      alt={previewFile.name}
                      className="max-w-full max-h-full object-contain"
                    />
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center p-8 text-gray-500">
                    <FileIcon className="w-16 h-16 mb-4 text-gray-400" />
                    <p className="text-sm">Preview not available</p>
                    {previewFile.url && (
                      <a
                        href={previewFile.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-4 text-blue-600 hover:underline"
                      >
                        Open in new tab
                      </a>
                    )}
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        )}
      </>
    );
  }
  
  // Multiple files - show count and first file
  return (
    <div
      className={cn(
        'px-3 py-2 cursor-pointer hover:bg-blue-50',
        isSelected && 'ring-2 ring-inset ring-blue-500 bg-blue-50',
        className
      )}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
    >
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded border border-gray-200 bg-gray-50 flex items-center justify-center flex-shrink-0">
          <FileText className="w-4 h-4 text-gray-500" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm text-gray-900">{files.length} files</div>
          <div className="text-xs text-gray-500 truncate">
            {files[0]?.name || 'Files'}
          </div>
        </div>
      </div>
    </div>
  );
}

