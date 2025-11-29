import { goClient } from './go-client'
import { PortalConfig } from '@/types/portal'
import { semanticSearchClient } from './semantic-search-client'

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

  submit: async (id: string, data: any) => {
    const result = await goClient.post<{ id: string }>(`/forms/${id}/submit`, { data })
    
    // Queue submission for embedding (fire and forget)
    if (result?.id) {
      semanticSearchClient.queueForEmbedding(result.id, 'submission', 5).catch(() => {})
    }
    
    return result
  },
    
  getSubmissions: (id: string) => 
    goClient.get(`/forms/${id}/submissions`),

  deleteSubmission: (formId: string, submissionId: string) =>
    goClient.delete(`/forms/${formId}/submissions/${submissionId}`),
}
