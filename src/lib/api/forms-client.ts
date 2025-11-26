import { goClient } from './go-client'
import { PortalConfig } from '@/types/portal'

export const formsClient = {
  list: (workspaceId: string) => 
    goClient.get('/forms', { workspace_id: workspaceId }),

  get: (id: string) => 
    goClient.get(`/forms/${id}`),

  create: (data: { workspace_id: string; name: string; description?: string }) => 
    goClient.post('/forms', data),

  update: (id: string, data: { name?: string; description?: string; is_published?: boolean }) => 
    goClient.patch(`/forms/${id}`, data),

  updateStructure: (id: string, config: PortalConfig) => 
    goClient.put(`/forms/${id}/structure`, config),

  delete: (id: string) => 
    goClient.delete(`/forms/${id}`),

  submit: (id: string, data: any) => 
    goClient.post(`/forms/${id}/submit`, { data }),
    
  getSubmissions: (id: string) => 
    goClient.get(`/forms/${id}/submissions`),
}
