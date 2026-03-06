import { goClient } from './go-client'
import { PortalConfig } from '@/types/portal'
import { semanticSearchClient } from './semantic-search-client'
import { Form } from '@/types/forms'
export type { Form } from '@/types/forms'

// Use shared `Form` type from `src/types/forms.ts`

// Extended form data with workspace info (returned by subdomain resolution)
export interface PortalForm extends Form {
  workspace_name: string
  workspace_subdomain?: string | null
}

/**
 * Normalize form response from backend to match frontend Form type
 * Backend returns is_published, frontend expects is_public
 */
function normalizeFormResponse(form: any): Form {
  return {
    ...form,
    is_public: form.is_published ?? form.is_public ?? false,
    status: form.status || 'draft',
    version: form.version || 1,
    created_by: form.created_by || '',
    submit_settings: form.submit_settings || {},
  }
}

export const formsClient = {
  list: async (workspaceId: string) => {
    // Use optimized /forms/list endpoint (doesn't load all fields, much faster)
    const data = await goClient.get<any[]>('/forms/list', { workspace_id: workspaceId })
    const formsArray = Array.isArray(data) ? data : []
    return formsArray.map(normalizeFormResponse)
  },

  get: async (id: string) => {
    const form = await goClient.get<any>(`/forms/${id}`)
    return normalizeFormResponse(form)
  },

  // Combined endpoint: form + submissions + all workflow data in ONE call
  // This is the fastest way to load the Review Workspace
  // Removed: getFull endpoint no longer exists (workflow feature removed)

  getBySlug: async (slug: string) => {
    const form = await goClient.get<any>(`/forms/by-slug/${slug}`)
    return normalizeFormResponse(form)
  },

  // Resolve form by subdomain + slug (for pretty URLs)
  getBySubdomainSlug: async (subdomain: string, slug: string) => {
    const form = await goClient.get<any>(`/forms/by-subdomain/${subdomain}/${slug}`)
    return normalizeFormResponse(form) as PortalForm
  },

  create: async (data: { workspace_id: string; name: string; description?: string }) => {
    const form = await goClient.post<any>('/forms', data)
    return normalizeFormResponse(form)
  },

  update: async (id: string, data: { 
    name?: string; 
    description?: string; 
    is_published?: boolean;
    preview_title?: string | null;
    preview_description?: string | null;
    preview_image_url?: string | null;
  }) => {
    const form = await goClient.patch<any>(`/forms/${id}`, data)
    return normalizeFormResponse(form)
  },

  updateStructure: (id: string, config: PortalConfig) => 
    goClient.put(`/forms/${id}/structure`, config),

  updateCustomSlug: async (id: string, customSlug: string | null) => {
    const form = await goClient.put<any>(`/forms/${id}/custom-slug`, { custom_slug: customSlug })
    return normalizeFormResponse(form)
  },

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

  getAnalytics: (id: string) =>
    goClient.get<import('@/types/form-analytics').FormAnalyticsResponse>(`/forms/${id}/analytics`),

  deleteSubmission: (formId: string, submissionId: string) =>
    goClient.delete(`/forms/${formId}/submissions/${submissionId}`),
}
