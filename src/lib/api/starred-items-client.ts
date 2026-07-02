import { goClient } from './go-client'

export interface StarredItemEntry {
  id: string
  workspace_id: string
  ba_user_id: string
  entity_id: string
  entity_type: 'form' | 'table'
  created_at: string
}

export const starredItemsClient = {
  star: (workspaceId: string, entityId: string, entityType: 'form' | 'table') =>
    goClient.post<StarredItemEntry>('/starred-items', {
      workspace_id: workspaceId,
      entity_id: entityId,
      entity_type: entityType,
    }),

  unstar: (workspaceId: string, entityId: string, entityType: 'form' | 'table') =>
    goClient.delete<{ success: boolean }>('/starred-items', {
      workspace_id: workspaceId,
      entity_id: entityId,
      entity_type: entityType,
    }),

  list: (workspaceId: string) =>
    goClient.get<StarredItemEntry[]>('/starred-items', { workspace_id: workspaceId }),
}
