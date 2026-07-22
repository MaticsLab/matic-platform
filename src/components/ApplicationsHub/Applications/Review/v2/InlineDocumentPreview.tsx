'use client';

import React from 'react';
import {
  AlertCircle, ExternalLink, Eye, Download, FileImage, File, FileText,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Helper to parse JSON strings
export function parseValueIfNeeded(value: any): any {
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
  return value;
}

// Helper to check if a value is a file/document
export function isFileValue(value: any): boolean {
  if (!value) return false;

  // Check if it's a string URL pointing to a file
  if (typeof value === 'string') {
    if (value.includes('storage') && value.includes('object')) return true;
    if (/\.(pdf|jpg|jpeg|png|gif|doc|docx|xls|xlsx|ppt|pptx)($|\?)/i.test(value)) return true;
  }

  // Check if it's an object with file properties
  if (typeof value === 'object' && value !== null) {
    const hasUrl = !!(value.url || value.Url || value.URL);
    const hasMime = !!(value.mimeType || value['Mime Type'] || value.mime_type || value.type);
    const hasName = !!(value.name || value.Name || value.filename);
    return hasUrl || (hasMime && hasName);
  }

  // Check if it's an array of files
  if (Array.isArray(value) && value.length > 0) {
    return isFileValue(value[0]);
  }

  return false;
}

// Get file type from value
export function getFileType(value: any): 'pdf' | 'image' | 'video' | 'other' {
  const mimeType = (value.mimeType || value.type || value['Mime Type'] || '').toLowerCase();
  const name = (value.name || value.Name || value.url || '').toLowerCase();

  if (mimeType.includes('pdf') || name.includes('.pdf')) return 'pdf';
  if (mimeType.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|svg)/.test(name)) return 'image';
  if (mimeType.startsWith('video/') || /\.(mp4|webm|mov)/.test(name)) return 'video';
  return 'other';
}

// Format file size
export function formatFileSize(bytes?: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Document preview component for inline display
export function InlineDocumentPreview({ value, fieldLabel }: { value: any; fieldLabel?: string }) {
  const parsedValue = parseValueIfNeeded(value);
  const files = Array.isArray(parsedValue) ? parsedValue : [parsedValue];

  return (
    <div className="space-y-3">
      {files.map((file, idx) => {
        // Get the URL - check multiple possible property names
        // Prioritize non-blob URLs over blob URLs
        const possibleUrls = [
          file.url,
          file.Url,
          file.URL,
          file.publicUrl,
          file.public_url,
          typeof file === 'string' ? file : ''
        ].filter(Boolean);

        // Find a non-blob URL first, fallback to any URL
        const nonBlobUrl = possibleUrls.find(u => u && !u.startsWith('blob:'));
        const url = nonBlobUrl || possibleUrls[0] || '';
        const isBlobUrl = url.startsWith('blob:');

        const name = file.name || file.Name || file.filename || file.fileName || url?.split('/').pop()?.split('?')[0] || 'Document';
        const size = file.size || file.Size;
        const mimeType = file.mimeType || file.type || file.Type || file['Mime Type'] || file.mime_type || '';
        const fileType = getFileType({ ...file, url, name });
        const isImage = fileType === 'image';

        // If it's a blob URL, show a warning and don't try to load it
        if (isBlobUrl || !url) {
          return (
            <div key={idx} className="border border-amber-200 bg-amber-50 rounded-lg overflow-hidden">
              <div className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                  <AlertCircle className="w-5 h-5 text-amber-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{name}</p>
                  <p className="text-xs text-amber-600">
                    {isBlobUrl
                      ? 'Temporary preview URL - file may need to be re-uploaded'
                      : 'No download URL available'}
                  </p>
                  {mimeType && <p className="text-xs text-gray-500">{mimeType}{size ? ` • ${formatFileSize(size)}` : ''}</p>}
                </div>
              </div>
            </div>
          );
        }

        return (
          <div key={idx} className="border border-gray-200 rounded-lg overflow-hidden bg-white">
            {/* Preview area */}
            {isImage && url ? (
              <div className="relative h-40 bg-gray-100 flex items-center justify-center">
                <img
                  src={url}
                  alt={name}
                  className="max-h-full max-w-full object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                    (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                  }}
                />
                <div className="hidden flex-col items-center justify-center text-gray-400">
                  <FileImage className="w-10 h-10 mb-2" />
                  <span className="text-xs">Preview unavailable</span>
                </div>
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="absolute top-2 right-2 p-1.5 bg-white/90 rounded-lg shadow hover:bg-white transition-colors"
                >
                  <ExternalLink className="w-4 h-4 text-gray-600" />
                </a>
              </div>
            ) : fileType === 'pdf' && url ? (
              <div className="relative h-40 bg-gray-100">
                <iframe
                  src={`${url}#toolbar=0&navpanes=0`}
                  className="w-full h-full"
                  title={name}
                />
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="absolute top-2 right-2 p-1.5 bg-white/90 rounded-lg shadow hover:bg-white transition-colors"
                >
                  <ExternalLink className="w-4 h-4 text-gray-600" />
                </a>
              </div>
            ) : null}

            {/* File info */}
            <div className="p-3 flex items-center gap-3">
              <div className={cn(
                "w-10 h-10 rounded-lg flex items-center justify-center",
                fileType === 'pdf' ? 'bg-red-100' : fileType === 'image' ? 'bg-blue-100' : 'bg-gray-100'
              )}>
                {fileType === 'pdf' ? (
                  <FileText className="w-5 h-5 text-red-600" />
                ) : fileType === 'image' ? (
                  <FileImage className="w-5 h-5 text-blue-600" />
                ) : (
                  <File className="w-5 h-5 text-gray-600" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{name}</p>
                <p className="text-xs text-gray-500">
                  {mimeType && <span>{mimeType}</span>}
                  {size && <span> • {formatFileSize(size)}</span>}
                </p>
              </div>
              <div className="flex items-center gap-1">
                {url && (
                  <>
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                      title="Open in new tab"
                    >
                      <Eye className="w-4 h-4 text-gray-500" />
                    </a>
                    <a
                      href={url}
                      download={name}
                      className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                      title="Download"
                    >
                      <Download className="w-4 h-4 text-gray-500" />
                    </a>
                  </>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
