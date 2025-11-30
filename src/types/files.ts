/**
 * Table Files Types
 * 
 * Types for file attachments stored in table_files table.
 * Files can be attached to any table, row, or field across all modules.
 */

// File category based on MIME type
export type FileCategory = 
  | 'image' 
  | 'video' 
  | 'audio' 
  | 'pdf' 
  | 'spreadsheet' 
  | 'document' 
  | 'file';

// Core table file interface
export interface TableFile {
  id: string;
  table_id?: string;
  row_id?: string;
  field_id?: string;
  workspace_id?: string;
  
  // File metadata
  filename: string;
  original_filename: string;
  mime_type: string;
  size_bytes: number;
  
  // Storage location
  storage_bucket: string;
  storage_path: string;
  public_url?: string;
  
  // Optional metadata
  description?: string;
  alt_text?: string;
  metadata?: Record<string, any>;
  tags?: string[];
  
  // Versioning
  version: number;
  parent_file_id?: string;
  is_current: boolean;
  
  // Audit
  uploaded_by?: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

// Response with computed fields
export interface TableFileResponse extends TableFile {
  file_category: FileCategory;
  formatted_size: string;
}

// Request to create a new file record
export interface CreateFileRequest {
  table_id?: string;
  row_id?: string;
  field_id?: string;
  workspace_id?: string;
  filename: string;
  original_filename: string;
  mime_type: string;
  size_bytes: number;
  storage_bucket?: string;
  storage_path: string;
  public_url?: string;
  description?: string;
  alt_text?: string;
  tags?: string[];
}

// Request to update file metadata
export interface UpdateFileRequest {
  description?: string;
  alt_text?: string;
  tags?: string[];
}

// File statistics for a row
export interface FileStats {
  file_count: number;
  total_size_bytes: number;
  formatted_size: string;
}

// Filter options for listing files
export interface ListFilesParams {
  table_id?: string;
  row_id?: string;
  field_id?: string;
  workspace_id?: string;
}

// Helper to determine file category from MIME type
export function getFileCategory(mimeType: string): FileCategory {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType === 'application/pdf') return 'pdf';
  if (
    mimeType.includes('spreadsheet') ||
    mimeType.includes('excel') ||
    mimeType === 'text/csv'
  ) return 'spreadsheet';
  if (
    mimeType.includes('word') ||
    mimeType.includes('document')
  ) return 'document';
  return 'file';
}

// Helper to format file size
export function formatFileSize(bytes: number): string {
  const KB = 1024;
  const MB = KB * 1024;
  const GB = MB * 1024;

  if (bytes >= GB) {
    return `${(bytes / GB).toFixed(2)} GB`;
  }
  if (bytes >= MB) {
    return `${(bytes / MB).toFixed(2)} MB`;
  }
  if (bytes >= KB) {
    return `${(bytes / KB).toFixed(2)} KB`;
  }
  return `${bytes} bytes`;
}

// Helper to get file extension
export function getFileExtension(filename: string): string {
  const parts = filename.split('.');
  return parts.length > 1 ? parts.pop()?.toLowerCase() || '' : '';
}

// Helper to generate storage path
export function generateStoragePath(options: {
  workspaceId?: string;
  tableId?: string;
  rowId?: string;
  fieldId?: string;
  filename: string;
}): string {
  const { workspaceId, tableId, rowId, fieldId, filename } = options;
  const ext = getFileExtension(filename);
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 9);
  const uniqueFilename = `${timestamp}_${random}.${ext}`;

  const parts: string[] = [];
  if (workspaceId) parts.push(workspaceId);
  if (tableId) parts.push(tableId);
  if (rowId) parts.push(rowId);
  if (fieldId) parts.push(fieldId);
  parts.push(uniqueFilename);

  return parts.join('/');
}

// Type guard to check if file is an image
export function isImageFile(file: TableFile | TableFileResponse): boolean {
  return file.mime_type.startsWith('image/');
}

// Type guard to check if file is previewable
export function isPreviewable(file: TableFile | TableFileResponse): boolean {
  const previewableMimeTypes = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml',
    'application/pdf',
    'video/mp4',
    'video/webm',
    'audio/mpeg',
    'audio/wav',
    'audio/ogg',
  ];
  return previewableMimeTypes.includes(file.mime_type);
}

// Common MIME types for reference
export const COMMON_MIME_TYPES = {
  // Images
  'image/jpeg': { extension: 'jpg', category: 'image' as FileCategory },
  'image/png': { extension: 'png', category: 'image' as FileCategory },
  'image/gif': { extension: 'gif', category: 'image' as FileCategory },
  'image/webp': { extension: 'webp', category: 'image' as FileCategory },
  'image/svg+xml': { extension: 'svg', category: 'image' as FileCategory },
  
  // Documents
  'application/pdf': { extension: 'pdf', category: 'pdf' as FileCategory },
  'application/msword': { extension: 'doc', category: 'document' as FileCategory },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': { extension: 'docx', category: 'document' as FileCategory },
  
  // Spreadsheets
  'application/vnd.ms-excel': { extension: 'xls', category: 'spreadsheet' as FileCategory },
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': { extension: 'xlsx', category: 'spreadsheet' as FileCategory },
  'text/csv': { extension: 'csv', category: 'spreadsheet' as FileCategory },
  
  // Video
  'video/mp4': { extension: 'mp4', category: 'video' as FileCategory },
  'video/webm': { extension: 'webm', category: 'video' as FileCategory },
  
  // Audio
  'audio/mpeg': { extension: 'mp3', category: 'audio' as FileCategory },
  'audio/wav': { extension: 'wav', category: 'audio' as FileCategory },
  'audio/ogg': { extension: 'ogg', category: 'audio' as FileCategory },
} as const;
