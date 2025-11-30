/**
 * Files API Client
 * 
 * Client for managing file attachments through the Go backend.
 * Files are stored in Supabase Storage, metadata is tracked in table_files.
 */

import { goFetch } from './go-client';
import {
  TableFileResponse,
  CreateFileRequest,
  UpdateFileRequest,
  FileStats,
  ListFilesParams,
} from '@/types/files';

/**
 * Files API client for CRUD operations on table_files
 */
export const filesClient = {
  /**
   * List files with optional filters
   */
  list: async (params?: ListFilesParams): Promise<TableFileResponse[]> => {
    const queryParams: Record<string, string> = {};
    if (params?.table_id) queryParams.table_id = params.table_id;
    if (params?.row_id) queryParams.row_id = params.row_id;
    if (params?.field_id) queryParams.field_id = params.field_id;
    if (params?.workspace_id) queryParams.workspace_id = params.workspace_id;

    return goFetch<TableFileResponse[]>('/files', { params: queryParams });
  },

  /**
   * Get a single file by ID
   */
  get: async (id: string): Promise<TableFileResponse> => {
    return goFetch<TableFileResponse>(`/files/${id}`);
  },

  /**
   * Create a new file record
   */
  create: async (data: CreateFileRequest): Promise<TableFileResponse> => {
    return goFetch<TableFileResponse>('/files', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  },

  /**
   * Update file metadata
   */
  update: async (id: string, data: UpdateFileRequest): Promise<TableFileResponse> => {
    return goFetch<TableFileResponse>(`/files/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  },

  /**
   * Soft delete a file
   */
  delete: async (id: string): Promise<{ message: string }> => {
    return goFetch<{ message: string }>(`/files/${id}`, {
      method: 'DELETE',
    });
  },

  /**
   * Get all versions of a file
   */
  getVersions: async (id: string): Promise<TableFileResponse[]> => {
    return goFetch<TableFileResponse[]>(`/files/${id}/versions`);
  },

  /**
   * Create a new version of an existing file
   */
  createVersion: async (parentId: string, data: CreateFileRequest): Promise<TableFileResponse> => {
    return goFetch<TableFileResponse>(`/files/${parentId}/versions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  },
};

/**
 * Row files API client (convenience endpoints)
 */
export const rowFilesClient = {
  /**
   * Get all files for a specific row
   */
  list: async (rowId: string): Promise<TableFileResponse[]> => {
    return goFetch<TableFileResponse[]>(`/rows/${rowId}/files`);
  },

  /**
   * Create a file record for a specific row
   */
  create: async (rowId: string, data: CreateFileRequest): Promise<TableFileResponse> => {
    return goFetch<TableFileResponse>(`/rows/${rowId}/files`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  },

  /**
   * Get file statistics for a row
   */
  getStats: async (rowId: string): Promise<FileStats> => {
    return goFetch<FileStats>(`/rows/${rowId}/files/stats`);
  },
};

/**
 * Table files API client (convenience endpoint)
 */
export const tableFilesClient = {
  /**
   * Get all files for a specific table
   */
  list: async (tableId: string): Promise<TableFileResponse[]> => {
    return goFetch<TableFileResponse[]>(`/tables/${tableId}/files`);
  },
};

/**
 * Helper function to register a file after uploading to Supabase Storage
 * 
 * @example
 * ```typescript
 * // After uploading to Supabase Storage
 * const { data: uploadData } = await supabase.storage.from('workspace-assets').upload(path, file);
 * const { data: { publicUrl } } = supabase.storage.from('workspace-assets').getPublicUrl(path);
 * 
 * // Register the file in table_files
 * const fileRecord = await registerUploadedFile({
 *   file,
 *   storagePath: path,
 *   publicUrl,
 *   rowId: 'row-uuid',
 *   fieldId: 'field-uuid',
 * });
 * ```
 */
export async function registerUploadedFile(options: {
  file: File;
  storagePath: string;
  publicUrl: string;
  rowId?: string;
  tableId?: string;
  fieldId?: string;
  workspaceId?: string;
  storageBucket?: string;
  description?: string;
  altText?: string;
  tags?: string[];
}): Promise<TableFileResponse> {
  const {
    file,
    storagePath,
    publicUrl,
    rowId,
    tableId,
    fieldId,
    workspaceId,
    storageBucket = 'workspace-assets',
    description,
    altText,
    tags,
  } = options;

  // Generate unique filename from storage path
  const filename = storagePath.split('/').pop() || file.name;

  const createRequest: CreateFileRequest = {
    table_id: tableId,
    row_id: rowId,
    field_id: fieldId,
    workspace_id: workspaceId,
    filename,
    original_filename: file.name,
    mime_type: file.type,
    size_bytes: file.size,
    storage_bucket: storageBucket,
    storage_path: storagePath,
    public_url: publicUrl,
    description,
    alt_text: altText,
    tags,
  };

  return filesClient.create(createRequest);
}

/**
 * Helper to register a file uploaded to a specific row
 */
export async function registerRowFile(options: {
  rowId: string;
  file: File;
  storagePath: string;
  publicUrl: string;
  fieldId?: string;
  storageBucket?: string;
  description?: string;
  altText?: string;
  tags?: string[];
}): Promise<TableFileResponse> {
  const {
    rowId,
    file,
    storagePath,
    publicUrl,
    fieldId,
    storageBucket = 'workspace-assets',
    description,
    altText,
    tags,
  } = options;

  const filename = storagePath.split('/').pop() || file.name;

  const createRequest: CreateFileRequest = {
    row_id: rowId,
    field_id: fieldId,
    filename,
    original_filename: file.name,
    mime_type: file.type,
    size_bytes: file.size,
    storage_bucket: storageBucket,
    storage_path: storagePath,
    public_url: publicUrl,
    description,
    alt_text: altText,
    tags,
  };

  return rowFilesClient.create(rowId, createRequest);
}
