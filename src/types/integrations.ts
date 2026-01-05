/**
 * Workspace Integrations Types
 */

export interface WorkspaceIntegration {
  id: string
  workspace_id: string
  integration_type: 'google_drive' | 'dropbox' | 'onedrive'
  is_enabled: boolean
  is_connected: boolean
  token_expires_at?: string
  config: GoogleDriveConfig | Record<string, unknown>
  connected_email?: string
  connected_at?: string
  last_sync_at?: string
  created_at: string
  updated_at: string
  created_by?: string
}

export interface GoogleDriveConfig {
  root_folder_id?: string
  root_folder_name?: string
  root_folder_url?: string
  folder_structure?: 'flat' | 'nested'
  sync_settings?: {
    sync_on_submit: boolean
    sync_on_file_upload: boolean
    create_applicant_folders: boolean
  }
}

export interface FormIntegrationSetting {
  id: string
  form_id: string
  workspace_integration_id: string
  is_enabled: boolean
  settings: FormDriveSettings | Record<string, unknown>
  external_folder_id?: string
  external_folder_url?: string
  created_at: string
  updated_at: string
}

export interface FormDriveSettings {
  applicant_folder_template?: string
  sync_on_submit?: boolean
  include_all_fields?: boolean
}

export interface ApplicantFolder {
  id: string
  form_integration_id: string
  row_id: string
  applicant_identifier: string
  external_folder_id: string
  external_folder_url?: string
  last_sync_at?: string
  sync_status: 'pending' | 'synced' | 'error'
  sync_error?: string
  created_at: string
  updated_at: string
}

export interface FileSyncLog {
  id: string
  applicant_folder_id: string
  table_file_id?: string
  external_file_id?: string
  external_file_url?: string
  original_filename: string
  file_size_bytes?: number
  mime_type?: string
  sync_status: 'pending' | 'synced' | 'error' | 'deleted'
  sync_error?: string
  synced_at?: string
  created_at: string
}

export interface DriveFolder {
  folder_id: string
  folder_name?: string
  folder_url: string
  existing?: boolean
}

export interface DriveFile {
  file_id: string
  file_name: string
  file_url: string
}

export interface SyncResult {
  synced_files: DriveFile[]
  total: number
  errors?: string[]
}
