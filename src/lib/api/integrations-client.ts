/**
 * Workspace Integrations API Client
 * Handles Google Drive and other third-party integrations
 */

import { goFetch } from './go-client'
import type {
  WorkspaceIntegration,
  FormIntegrationSetting,
  GoogleDriveConfig,
  FormDriveSettings,
  DriveFolder,
  DriveFile,
  SyncResult
} from '@/types/integrations'

// ========== Workspace Integration Management ==========

export const integrationsClient = {
  /**
   * List all integrations for a workspace
   */
  list: (workspaceId: string) =>
    goFetch<WorkspaceIntegration[]>(`/workspaces/${workspaceId}/integrations`),

  /**
   * Get a specific integration by type
   */
  get: (workspaceId: string, type: string) =>
    goFetch<WorkspaceIntegration>(`/workspaces/${workspaceId}/integrations/${type}`),

  /**
   * Create a new integration
   */
  create: (workspaceId: string, integrationType: string) =>
    goFetch<WorkspaceIntegration>(`/workspaces/${workspaceId}/integrations`, {
      method: 'POST',
      body: JSON.stringify({ integration_type: integrationType })
    }),

  /**
   * Update an integration
   */
  update: (workspaceId: string, type: string, data: {
    is_enabled?: boolean
    config?: GoogleDriveConfig | Record<string, unknown>
  }) =>
    goFetch<WorkspaceIntegration>(`/workspaces/${workspaceId}/integrations/${type}`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    }),

  /**
   * Delete an integration
   */
  delete: (workspaceId: string, type: string) =>
    goFetch<{ message: string }>(`/workspaces/${workspaceId}/integrations/${type}`, {
      method: 'DELETE'
    })
}

// ========== Google Drive Integration ==========

export const googleDriveClient = {
  /**
   * Get OAuth authorization URL for connecting Google Drive
   */
  getAuthURL: (workspaceId: string) =>
    goFetch<{ auth_url: string; state: string }>(
      `/workspaces/${workspaceId}/integrations/google_drive/auth-url`
    ),

  /**
   * Disconnect Google Drive integration
   */
  disconnect: (workspaceId: string) =>
    goFetch<{ message: string }>(
      `/workspaces/${workspaceId}/integrations/google_drive/disconnect`,
      { method: 'POST' }
    ),

  // ========== Form-level Drive Operations ==========

  /**
   * Get Google Drive settings for a form
   */
  getFormSettings: (formId: string) =>
    goFetch<FormIntegrationSetting>(`/forms/${formId}/integrations/google_drive`),

  /**
   * Update Google Drive settings for a form
   */
  updateFormSettings: (
    formId: string,
    data: { is_enabled?: boolean; settings?: FormDriveSettings }
  ) =>
    goFetch<FormIntegrationSetting>(`/forms/${formId}/integrations/google_drive`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  /**
   * Create a Google Drive folder for a form
   */
  createFormFolder: (formId: string) =>
    goFetch<DriveFolder>(`/forms/${formId}/integrations/google_drive/folder`, {
      method: 'POST'
    }),

  // ========== Row/Applicant-level Drive Operations ==========

  /**
   * Create a Google Drive folder for an applicant
   */
  createApplicantFolder: (rowId: string) =>
    goFetch<DriveFolder>(`/rows/${rowId}/integrations/google_drive/folder`, {
      method: 'POST'
    }),

  /**
   * Sync a single file to Google Drive
   */
  syncFile: (rowId: string, file: {
    file_id?: string
    file_url: string
    file_name: string
    mime_type?: string
  }) =>
    goFetch<DriveFile>(`/rows/${rowId}/integrations/google_drive/sync-file`, {
      method: 'POST',
      body: JSON.stringify(file)
    }),

  /**
   * Sync all files for a row to Google Drive
   */
  syncAllFiles: (rowId: string) =>
    goFetch<SyncResult>(`/rows/${rowId}/integrations/google_drive/sync-all`, {
      method: 'POST'
    }),

  /**
   * Create and upload an application summary to Google Drive
   */
  createSummary: (rowId: string) =>
    goFetch<DriveFile>(`/rows/${rowId}/integrations/google_drive/summary`, {
      method: 'POST'
    })
}

// ========== Helper Functions ==========

/**
 * Check if Google Drive is connected for a workspace
 */
export async function isGoogleDriveConnected(workspaceId: string): Promise<boolean> {
  try {
    const integration = await integrationsClient.get(workspaceId, 'google_drive')
    return integration?.is_connected ?? false
  } catch {
    return false
  }
}

/**
 * Check if Google Drive is enabled for a form
 */
export async function isGoogleDriveEnabledForForm(formId: string): Promise<boolean> {
  try {
    const settings = await googleDriveClient.getFormSettings(formId)
    return settings?.is_enabled ?? false
  } catch {
    return false
  }
}

/**
 * Initialize Google Drive connection flow
 * Opens OAuth popup and handles callback
 */
export async function connectGoogleDrive(workspaceId: string): Promise<void> {
  const { auth_url } = await googleDriveClient.getAuthURL(workspaceId)
  
  // Open OAuth popup
  const width = 600
  const height = 700
  const left = window.screenX + (window.outerWidth - width) / 2
  const top = window.screenY + (window.outerHeight - height) / 2
  
  const popup = window.open(
    auth_url,
    'google_drive_auth',
    `width=${width},height=${height},left=${left},top=${top},scrollbars=yes`
  )

  // The OAuth callback will redirect back to the app
  // The callback handler in the Go backend will redirect to workspace settings

  // Poll to check if popup closed (user cancelled)
  const pollTimer = setInterval(() => {
    if (popup?.closed) {
      clearInterval(pollTimer)
    }
  }, 500)
}

/**
 * Sync an uploaded file to Google Drive automatically
 * Call this after a file is uploaded if Drive sync is enabled
 */
export async function autoSyncFileToGoogleDrive(
  rowId: string,
  file: { url: string; name: string; type?: string; id?: string }
): Promise<DriveFile | null> {
  try {
    return await googleDriveClient.syncFile(rowId, {
      file_id: file.id,
      file_url: file.url,
      file_name: file.name,
      mime_type: file.type
    })
  } catch (error) {
    console.error('Failed to sync file to Google Drive:', error)
    return null
  }
}
