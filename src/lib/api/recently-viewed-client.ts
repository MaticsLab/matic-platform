import { goClient } from './go-client'

export interface RecentlyViewedEntry {
  id: string
  workspace_id: string
  ba_user_id: string
  entity_id: string
  entity_type: 'form' | 'table'
  viewed_at: string
  created_at: string
}

export const recentlyViewedClient = {
  record: (workspaceId: string, entityId: string, entityType: 'form' | 'table') =>
    goClient.post<{ success: boolean }>('/recently-viewed', {
      workspace_id: workspaceId,
      entity_id: entityId,
      entity_type: entityType,
    }),

  list: (workspaceId: string, limit = 8) =>
    goClient.get<RecentlyViewedEntry[]>('/recently-viewed', {
      workspace_id: workspaceId,
      limit: String(limit),
    }),
}
