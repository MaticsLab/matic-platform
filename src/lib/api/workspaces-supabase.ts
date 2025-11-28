/**
 * Workspaces Supabase API Client
 * Now uses Go backend for all operations
 */

import { goClient } from './go-client'

export const workspacesSupabase = {
  /**
   * Get all workspaces for an organization
   */
  async getWorkspacesByOrganization(organizationId: string) {
    return goClient.get<any[]>('/workspaces', { organization_id: organizationId })
  },

  /**
   * Get all workspaces for current user
   */
  async getWorkspacesForUser(_userId: string) {
    // Go backend uses JWT to determine user, no need to pass userId
    return goClient.get<any[]>('/workspaces')
  },

  /**
   * Get a single workspace by ID
   */
  async getWorkspaceById(workspaceId: string) {
    return goClient.get<any>(`/workspaces/${workspaceId}`)
  },

  /**
   * Get a workspace by slug
   */
  async getWorkspaceBySlug(slug: string) {
    // List all workspaces and find by slug
    const workspaces = await goClient.get<any[]>('/workspaces')
    const workspace = workspaces?.find((w: any) => w.slug === slug)
    if (!workspace) {
      throw new Error('Workspace not found')
    }
    return workspace
  },

  /**
   * Create a new workspace
   */
  async createWorkspace(workspaceData: any) {
    return goClient.post<any>('/workspaces', workspaceData)
  },

  /**
   * Update a workspace
   */
  async updateWorkspace(workspaceId: string, updates: any) {
    return goClient.patch<any>(`/workspaces/${workspaceId}`, updates)
  },

  /**
   * Delete a workspace
   */
  async deleteWorkspace(workspaceId: string) {
    return goClient.delete(`/workspaces/${workspaceId}`)
  },

  /**
   * Get workspace stats (tables, forms, etc.)
   */
  async getWorkspaceStats(workspaceId: string) {
    // Get workspace with tables and forms from Go backend
    const workspace = await goClient.get<any>(`/workspaces/${workspaceId}`)
    return {
      tables: workspace?.tables?.length || 0,
      forms: workspace?.forms?.length || 0,
    }
  },
}
