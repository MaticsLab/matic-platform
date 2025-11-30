import { goClient } from './go-client'

export interface Workspace {
  id: string
  organization_id: string
  name: string
  slug: string
  custom_subdomain?: string | null
  description?: string
  color?: string
  icon?: string
  settings?: Record<string, unknown>
  is_archived?: boolean
  created_by: string
  logo_url?: string
  created_at: string
  updated_at: string
}

export const workspacesClient = {
  list: (organizationId?: string) => 
    goClient.get<Workspace[]>('/workspaces', organizationId ? { organization_id: organizationId } : undefined),

  get: (id: string) => 
    goClient.get<Workspace>(`/workspaces/${id}`),

  create: (data: Partial<Workspace>) => 
    goClient.post<Workspace>('/workspaces', data),

  update: (id: string, data: Partial<Workspace>) => 
    goClient.patch<Workspace>(`/workspaces/${id}`, data),

  delete: (id: string) => 
    goClient.delete(`/workspaces/${id}`),

  // Update custom subdomain
  updateCustomSubdomain: (id: string, customSubdomain: string | null) =>
    goClient.patch<Workspace>(`/workspaces/${id}`, { custom_subdomain: customSubdomain ?? '' }),

  // Helper to find by slug
  getBySlug: async (slug: string) => {
    // Since we don't have a direct endpoint, we list all and find
    // This assumes the user has access to the workspace
    const workspaces = await goClient.get<Workspace[]>('/workspaces')
    return workspaces.find(w => w.slug === slug)
  },

  getActivity: (id: string) =>
    goClient.get<unknown[]>(`/workspaces/${id}/activity`)
}
