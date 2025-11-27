import { goFetch } from './go-client';

// Types
export interface ReviewWorkflow {
  id: string;
  workspace_id: string;
  name: string;
  description?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ApplicationStage {
  id: string;
  workspace_id: string;
  review_workflow_id?: string;
  name: string;
  description?: string;
  order_index: number;
  stage_type: string;
  custom_statuses: any; // JSON
  logic_rules: any; // JSON
  created_at: string;
  updated_at: string;
}

export interface ReviewerType {
  id: string;
  workspace_id: string;
  name: string;
  description?: string;
  permissions: any; // JSON
  created_at: string;
  updated_at: string;
}

export interface Rubric {
  id: string;
  workspace_id: string;
  name: string;
  description?: string;
  categories: any; // JSON
  max_score: number;
  created_at: string;
  updated_at: string;
}

export interface StageReviewerConfig {
  id: string;
  stage_id: string;
  reviewer_type_id: string;
  rubric_id?: string;
  visibility_config: any; // JSON
  min_reviews_required: number;
  created_at: string;
  updated_at: string;
}

// API Client
export const workflowsClient = {
  // Workflows
  listWorkflows: async (workspaceId: string) => {
    return goFetch<ReviewWorkflow[]>(`/workflows?workspace_id=${workspaceId}`);
  },
  createWorkflow: async (data: Partial<ReviewWorkflow>) => {
    return goFetch<ReviewWorkflow>('/workflows', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  getWorkflow: async (id: string) => {
    return goFetch<ReviewWorkflow>(`/workflows/${id}`);
  },
  updateWorkflow: async (id: string, data: Partial<ReviewWorkflow>) => {
    return goFetch<ReviewWorkflow>(`/workflows/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },
  deleteWorkflow: async (id: string) => {
    return goFetch<void>(`/workflows/${id}`, {
      method: 'DELETE',
    });
  },

  // Stages
  listStages: async (workspaceId: string, workflowId?: string) => {
    let url = `/stages?workspace_id=${workspaceId}`;
    if (workflowId) {
      url += `&review_workflow_id=${workflowId}`;
    }
    return goFetch<ApplicationStage[]>(url);
  },
  createStage: async (data: Partial<ApplicationStage>) => {
    return goFetch<ApplicationStage>('/stages', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  getStage: async (id: string) => {
    return goFetch<ApplicationStage>(`/stages/${id}`);
  },
  updateStage: async (id: string, data: Partial<ApplicationStage>) => {
    return goFetch<ApplicationStage>(`/stages/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },
  deleteStage: async (id: string) => {
    return goFetch<void>(`/stages/${id}`, {
      method: 'DELETE',
    });
  },

  // Reviewer Types
  listReviewerTypes: async (workspaceId: string) => {
    return goFetch<ReviewerType[]>(`/reviewer-types?workspace_id=${workspaceId}`);
  },
  createReviewerType: async (data: Partial<ReviewerType>) => {
    return goFetch<ReviewerType>('/reviewer-types', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  getReviewerType: async (id: string) => {
    return goFetch<ReviewerType>(`/reviewer-types/${id}`);
  },
  updateReviewerType: async (id: string, data: Partial<ReviewerType>) => {
    return goFetch<ReviewerType>(`/reviewer-types/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },
  deleteReviewerType: async (id: string) => {
    return goFetch<void>(`/reviewer-types/${id}`, {
      method: 'DELETE',
    });
  },

  // Rubrics
  listRubrics: async (workspaceId: string) => {
    return goFetch<Rubric[]>(`/rubrics?workspace_id=${workspaceId}`);
  },
  createRubric: async (data: Partial<Rubric>) => {
    return goFetch<Rubric>('/rubrics', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  getRubric: async (id: string) => {
    return goFetch<Rubric>(`/rubrics/${id}`);
  },
  updateRubric: async (id: string, data: Partial<Rubric>) => {
    return goFetch<Rubric>(`/rubrics/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },
  deleteRubric: async (id: string) => {
    return goFetch<void>(`/rubrics/${id}`, {
      method: 'DELETE',
    });
  },

  // Stage Reviewer Configs
  listStageConfigs: async (stageId: string) => {
    return goFetch<StageReviewerConfig[]>(`/stage-reviewer-configs?stage_id=${stageId}`);
  },
  createStageConfig: async (data: Partial<StageReviewerConfig>) => {
    return goFetch<StageReviewerConfig>('/stage-reviewer-configs', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  updateStageConfig: async (id: string, data: Partial<StageReviewerConfig>) => {
    return goFetch<StageReviewerConfig>(`/stage-reviewer-configs/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },
  deleteStageConfig: async (id: string) => {
    return goFetch<void>(`/stage-reviewer-configs/${id}`, {
      method: 'DELETE',
    });
  },
};
