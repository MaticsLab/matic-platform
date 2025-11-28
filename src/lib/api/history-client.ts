/**
 * Version History API Client
 * Handles row version history, diffs, and approvals
 */

import { goFetch } from './go-client'
import type {
  RowVersion,
  RowHistoryEntry,
  FieldChange,
  ChangeApproval,
  BatchOperation,
  AIFieldSuggestion,
  GetRowHistoryResponse,
  RestoreVersionResponse,
  VersionDiffResponse,
  GetAISuggestionsResponse,
  ApprovalStatus,
  SuggestionStatus,
  SuggestionType,
} from '@/types/field-registry'

// ============================================================
// ROW HISTORY
// ============================================================

export interface GetHistoryOptions {
  redactPII?: boolean
  includeArchived?: boolean
  limit?: number
}

export const historyClient = {
  /**
   * Get version history for a row
   */
  getRowHistory: async (
    tableId: string,
    rowId: string,
    options: GetHistoryOptions = {}
  ): Promise<GetRowHistoryResponse> => {
    const params = new URLSearchParams()
    if (options.redactPII) params.set('redact_pii', 'true')
    if (options.includeArchived) params.set('include_archived', 'true')
    if (options.limit) params.set('limit', options.limit.toString())

    const query = params.toString()
    return goFetch<GetRowHistoryResponse>(
      `/tables/${tableId}/rows/${rowId}/history${query ? `?${query}` : ''}`
    )
  },

  /**
   * Get a specific version snapshot
   */
  getVersion: async (
    tableId: string,
    rowId: string,
    versionNumber: number
  ): Promise<RowHistoryEntry> => {
    return goFetch<RowHistoryEntry>(
      `/tables/${tableId}/rows/${rowId}/history/${versionNumber}`
    )
  },

  /**
   * Compare two versions
   */
  compareVersions: async (
    tableId: string,
    rowId: string,
    version1: number,
    version2: number
  ): Promise<VersionDiffResponse> => {
    return goFetch<VersionDiffResponse>(
      `/tables/${tableId}/rows/${rowId}/diff/${version1}/${version2}`
    )
  },

  /**
   * Restore a row to a previous version
   */
  restoreVersion: async (
    tableId: string,
    rowId: string,
    versionNumber: number,
    reason: string
  ): Promise<RestoreVersionResponse> => {
    return goFetch<RestoreVersionResponse>(
      `/tables/${tableId}/rows/${rowId}/restore/${versionNumber}`,
      {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }
    )
  },

  /**
   * Archive a version (30-day retention before deletion)
   */
  archiveVersion: async (
    tableId: string,
    rowId: string,
    versionId: string
  ): Promise<{ success: boolean }> => {
    return goFetch<{ success: boolean }>(
      `/tables/${tableId}/rows/${rowId}/history/${versionId}/archive`,
      { method: 'POST' }
    )
  },

  /**
   * Permanently delete a version (admin only)
   */
  deleteVersion: async (
    tableId: string,
    rowId: string,
    versionId: string
  ): Promise<{ success: boolean }> => {
    return goFetch<{ success: boolean }>(
      `/tables/${tableId}/rows/${rowId}/history/${versionId}`,
      { method: 'DELETE' }
    )
  },

  /**
   * Get field change history across all rows
   */
  getFieldHistory: async (
    tableId: string,
    fieldId: string,
    limit = 50
  ): Promise<FieldChange[]> => {
    return goFetch<FieldChange[]>(
      `/tables/${tableId}/fields/${fieldId}/history?limit=${limit}`
    )
  },
}

// ============================================================
// BATCH OPERATIONS
// ============================================================

export const batchClient = {
  /**
   * List batch operations for a table
   */
  listBatchOperations: async (
    tableId: string,
    limit = 20
  ): Promise<BatchOperation[]> => {
    return goFetch<BatchOperation[]>(
      `/tables/${tableId}/batch-operations?limit=${limit}`
    )
  },

  /**
   * Get details of a batch operation
   */
  getBatchOperation: async (
    batchId: string
  ): Promise<BatchOperation> => {
    return goFetch<BatchOperation>(`/batch-operations/${batchId}`)
  },

  /**
   * Rollback a batch operation
   */
  rollbackBatchOperation: async (
    batchId: string,
    reason: string
  ): Promise<{ success: boolean; affected_rows: number }> => {
    return goFetch<{ success: boolean; affected_rows: number }>(
      `/batch-operations/${batchId}/rollback`,
      {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }
    )
  },
}

// ============================================================
// CHANGE APPROVALS
// ============================================================

export const approvalClient = {
  /**
   * List pending approvals for a table
   */
  listPendingApprovals: async (
    tableId: string
  ): Promise<ChangeApproval[]> => {
    return goFetch<ChangeApproval[]>(
      `/tables/${tableId}/approvals?status=pending`
    )
  },

  /**
   * List all approvals with optional filters
   */
  listApprovals: async (
    tableId: string,
    status?: ApprovalStatus
  ): Promise<ChangeApproval[]> => {
    const params = status ? `?status=${status}` : ''
    return goFetch<ChangeApproval[]>(`/tables/${tableId}/approvals${params}`)
  },

  /**
   * Get a specific approval request
   */
  getApproval: async (approvalId: string): Promise<ChangeApproval> => {
    return goFetch<ChangeApproval>(`/approvals/${approvalId}`)
  },

  /**
   * Submit changes for approval
   */
  submitForApproval: async (
    tableId: string,
    rowId: string,
    data: Record<string, any>,
    reason?: string
  ): Promise<ChangeApproval> => {
    return goFetch<ChangeApproval>(
      `/tables/${tableId}/rows/${rowId}/submit-for-approval`,
      {
        method: 'POST',
        body: JSON.stringify({ data, reason }),
      }
    )
  },

  /**
   * Approve or reject a change request
   */
  reviewApproval: async (
    approvalId: string,
    action: 'approve' | 'reject',
    notes?: string
  ): Promise<{ success: boolean; version_id?: string }> => {
    return goFetch<{ success: boolean; version_id?: string }>(
      `/approvals/${approvalId}/review`,
      {
        method: 'POST',
        body: JSON.stringify({ action, notes }),
      }
    )
  },

  /**
   * Cancel a pending approval request
   */
  cancelApproval: async (
    approvalId: string
  ): Promise<{ success: boolean }> => {
    return goFetch<{ success: boolean }>(
      `/approvals/${approvalId}/cancel`,
      { method: 'POST' }
    )
  },

  /**
   * Get my pending approval requests
   */
  getMyPendingApprovals: async (
    workspaceId: string
  ): Promise<ChangeApproval[]> => {
    return goFetch<ChangeApproval[]>(
      `/workspaces/${workspaceId}/my-pending-approvals`
    )
  },
}

// ============================================================
// AI SUGGESTIONS
// ============================================================

export interface GetSuggestionsOptions {
  status?: SuggestionStatus
  suggestionType?: SuggestionType
  minConfidence?: number
  limit?: number
}

export const aiSuggestionsClient = {
  /**
   * Get AI suggestions for a table
   */
  getTableSuggestions: async (
    tableId: string,
    options: GetSuggestionsOptions = {}
  ): Promise<GetAISuggestionsResponse> => {
    const params = new URLSearchParams()
    if (options.status) params.set('status', options.status)
    if (options.suggestionType) params.set('type', options.suggestionType)
    if (options.minConfidence) params.set('min_confidence', options.minConfidence.toString())
    if (options.limit) params.set('limit', options.limit.toString())

    const query = params.toString()
    return goFetch<GetAISuggestionsResponse>(
      `/tables/${tableId}/ai/suggestions${query ? `?${query}` : ''}`
    )
  },

  /**
   * Get AI suggestions for a specific row
   */
  getRowSuggestions: async (
    tableId: string,
    rowId: string
  ): Promise<AIFieldSuggestion[]> => {
    return goFetch<AIFieldSuggestion[]>(
      `/tables/${tableId}/rows/${rowId}/ai/suggestions`
    )
  },

  /**
   * Apply an AI suggestion
   */
  applySuggestion: async (
    suggestionId: string,
    apply: boolean,
    notes?: string
  ): Promise<{ success: boolean; version_id?: string }> => {
    return goFetch<{ success: boolean; version_id?: string }>(
      `/ai/suggestions/${suggestionId}/apply`,
      {
        method: 'POST',
        body: JSON.stringify({ apply, notes }),
      }
    )
  },

  /**
   * Dismiss a suggestion
   */
  dismissSuggestion: async (
    suggestionId: string
  ): Promise<{ success: boolean }> => {
    return goFetch<{ success: boolean }>(
      `/ai/suggestions/${suggestionId}/dismiss`,
      { method: 'POST' }
    )
  },

  /**
   * Apply multiple suggestions at once
   */
  bulkApplySuggestions: async (
    suggestionIds: string[],
    apply: boolean
  ): Promise<{ success: boolean; applied: number; failed: number }> => {
    return goFetch<{ success: boolean; applied: number; failed: number }>(
      `/ai/suggestions/bulk-apply`,
      {
        method: 'POST',
        body: JSON.stringify({ suggestion_ids: suggestionIds, apply }),
      }
    )
  },

  /**
   * Trigger AI analysis for a table
   */
  analyzeTable: async (
    tableId: string
  ): Promise<{ success: boolean; job_id: string }> => {
    return goFetch<{ success: boolean; job_id: string }>(
      `/tables/${tableId}/ai/analyze`,
      { method: 'POST' }
    )
  },
}

// ============================================================
// FIELD TYPE REGISTRY
// ============================================================

import type { FieldTypeRegistry } from '@/types/field-registry'

export const fieldRegistryClient = {
  /**
   * Get all field types from registry
   */
  getAllFieldTypes: async (): Promise<FieldTypeRegistry[]> => {
    return goFetch<FieldTypeRegistry[]>('/field-types')
  },

  /**
   * Get a specific field type
   */
  getFieldType: async (typeId: string): Promise<FieldTypeRegistry> => {
    return goFetch<FieldTypeRegistry>(`/field-types/${typeId}`)
  },
}

// ============================================================
// ACTIVITY FEED
// ============================================================

export interface ActivityItem {
  id: string
  type: 'row_created' | 'row_updated' | 'row_deleted' | 'field_changed' | 'approval_pending' | 'approval_reviewed' | 'ai_suggestion'
  entity_type: string
  entity_id: string
  entity_title: string
  summary: string
  changed_by: {
    id: string
    name: string
    avatar_url?: string
  }
  timestamp: string
  details?: Record<string, any>
}

export interface ActivityFeedResponse {
  activities: ActivityItem[]
  next_cursor?: string
}

export const activityClient = {
  /**
   * Get activity feed for a workspace
   */
  getWorkspaceActivity: async (
    workspaceId: string,
    limit = 50,
    cursor?: string
  ): Promise<ActivityFeedResponse> => {
    const params = new URLSearchParams()
    params.set('limit', limit.toString())
    if (cursor) params.set('cursor', cursor)

    return goFetch<ActivityFeedResponse>(
      `/workspaces/${workspaceId}/activity?${params.toString()}`
    )
  },

  /**
   * Get activity feed for a table
   */
  getTableActivity: async (
    tableId: string,
    limit = 50
  ): Promise<ActivityFeedResponse> => {
    return goFetch<ActivityFeedResponse>(
      `/tables/${tableId}/activity?limit=${limit}`
    )
  },

  /**
   * Get activity feed for a row
   */
  getRowActivity: async (
    tableId: string,
    rowId: string,
    limit = 20
  ): Promise<ActivityFeedResponse> => {
    return goFetch<ActivityFeedResponse>(
      `/tables/${tableId}/rows/${rowId}/activity?limit=${limit}`
    )
  },
}
