import { goClient } from './go-client'

export const workspacesClient = {
  list: (organizationId?: string) => 
    goClient.get<any[]>('/workspaces', organizationId ? { organization_id: organizationId } : undefined),

  get: (id: string) => 
    goClient.get<any>(`/workspaces/${id}`),

  create: (data: any) => 
    goClient.post<any>('/workspaces', data),

  update: (id: string, data: any) => 
    goClient.patch<any>(`/workspaces/${id}`, data),

  delete: (id: string) => 
    goClient.delete(`/workspaces/${id}`),

  // Helper to find by slug
  getBySlug: async (slug: string) => {
    // Since we don't have a direct endpoint, we list all and find
    // This assumes the user has access to the workspace
    const workspaces = await goClient.get<any[]>('/workspaces')
    return workspaces.find(w => w.slug === slug)
  },

  getActivity: (id: string) =>
    goClient.get<any[]>(`/workspaces/${id}/activity`)
}
