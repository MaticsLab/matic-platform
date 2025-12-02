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

  // Get workspace by slug - uses dedicated endpoint
  getBySlug: (slug: string) =>
    goClient.get<Workspace>(`/workspaces/by-slug/${slug}`),

  getActivity: (id: string) =>
    goClient.get<unknown[]>(`/workspaces/${id}/activity`)
}
