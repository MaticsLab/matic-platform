import { goClient } from './go-client'
import { PortalConfig } from '@/types/portal'
import { semanticSearchClient } from './semantic-search-client'
import { 
  ReviewWorkflow, 
  Rubric, 
  ReviewerType, 
  ApplicationStage, 
  StageReviewerConfig, 
  StageAction,
  WorkflowAction,
  ApplicationGroup,
  StageGroup 
} from './workflows-client'

export interface Form {
  id: string
  workspace_id: string
  name: string
  slug: string
  custom_slug?: string | null
  description: string
  settings: Record<string, any>
  is_published: boolean
  fields?: any[]
  created_at: string
  updated_at: string
}

// Combined response for Review Workspace - all data in one call
export interface FormWithWorkflowData {
  form: Form
  submissions: any[]
  workflows: ReviewWorkflow[]
  rubrics: Rubric[]
  reviewer_types: ReviewerType[]
  stages: Array<ApplicationStage & {
    reviewer_configs: StageReviewerConfig[]
    stage_actions: StageAction[]
  }>
  workflow_actions: WorkflowAction[]
  groups: ApplicationGroup[]
  stage_groups: StageGroup[]
}

// Extended form data with workspace info (returned by subdomain resolution)
export interface PortalForm extends Form {
  workspace_name: string
  workspace_subdomain?: string | null
}

export const formsClient = {
  list: (workspaceId: string) => 
    goClient.get<Form[]>('/forms', { workspace_id: workspaceId }),

  get: (id: string) => 
    goClient.get<Form>(`/forms/${id}`),

  // Combined endpoint: form + submissions + all workflow data in ONE call
  // This is the fastest way to load the Review Workspace
  getFull: (id: string) =>
    goClient.get<FormWithWorkflowData>(`/forms/${id}/full`),

  getBySlug: (slug: string) =>
    goClient.get<Form>(`/forms/by-slug/${slug}`),

  // Resolve form by subdomain + slug (for pretty URLs)
  getBySubdomainSlug: (subdomain: string, slug: string) =>
    goClient.get<PortalForm>(`/forms/by-subdomain/${subdomain}/${slug}`),

  create: (data: { workspace_id: string; name: string; description?: string }) => 
    goClient.post<Form>('/forms', data),

  update: (id: string, data: { name?: string; description?: string; is_published?: boolean }) => 
    goClient.patch<Form>(`/forms/${id}`, data),

  updateStructure: (id: string, config: PortalConfig) => 
    goClient.put(`/forms/${id}/structure`, config),

  updateCustomSlug: (id: string, customSlug: string | null) =>
    goClient.put<Form>(`/forms/${id}/custom-slug`, { custom_slug: customSlug }),

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
