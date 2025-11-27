import { goFetch } from './go-client';

// Types
export interface ReviewWorkflow {
  id: string;
  workspace_id: string;
  name: string;
  description?: string;
  application_type?: string;
  is_active: boolean;
  default_rubric_id?: string;
  default_stage_sequence?: string[]; // Array of stage_ids
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
  start_date?: string;
  end_date?: string;
  relative_deadline?: string;
  custom_statuses?: string[];
  custom_tags?: string[];
  logic_rules?: {
    auto_advance_condition?: string;
    auto_reject_condition?: string;
    visibility_rules?: string;
  };
  created_at: string;
  updated_at: string;
}

export interface ReviewerType {
  id: string;
  workspace_id: string;
  name: string;
  description?: string;
  permissions?: Record<string, boolean>;
  default_permissions?: {
    can_edit_score?: boolean;
    can_edit_status?: boolean;
    can_comment_only?: boolean;
    can_tag?: boolean;
  };
  created_at: string;
  updated_at: string;
}

export interface RubricGuideline {
  id: string;
  label: string;
  min_points: number;
  max_points: number;
  description: string;
}

export interface RubricCategory {
  id: string;
  name: string;
  description?: string;
  max_points: number;
  weight?: number;
  guidelines?: RubricGuideline[];
  // Legacy support
  levels?: Array<{
    id: string;
    minScore: number;
    maxScore: number;
    label?: string;
    description: string;
  }>;
}

export interface Rubric {
  id: string;
  workspace_id: string;
  name: string;
  description?: string;
  rubric_type?: 'analytic' | 'holistic' | 'single-point';
  total_points?: number;
  categories: RubricCategory[];
  max_score: number;
  created_at: string;
  updated_at: string;
}

export interface StageReviewerConfig {
  id: string;
  stage_id: string;
  reviewer_type_id: string;
  rubric_id?: string;
  assigned_rubric_id?: string;
  visibility_config?: Record<string, any>;
  field_visibility_config?: Record<string, boolean | 'visible' | 'hidden' | 'score_only'>;
  min_reviews_required: number;
  can_view_prior_scores?: boolean;
  can_view_prior_comments?: boolean;
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

  // Submission Workflow Assignment
  assignWorkflow: async (formId: string, submissionId: string, workflowId: string, stageId: string) => {
    return goFetch<any>(`/forms/${formId}/submissions/${submissionId}/assign-workflow`, {
      method: 'POST',
      body: JSON.stringify({ workflow_id: workflowId, stage_id: stageId }),
    });
  },
  
  moveToStage: async (formId: string, submissionId: string, stageId: string, reason?: string) => {
    return goFetch<any>(`/forms/${formId}/submissions/${submissionId}/move-stage`, {
      method: 'POST',
      body: JSON.stringify({ stage_id: stageId, reason }),
    });
  },
  
  updateReviewData: async (formId: string, submissionId: string, data: {
    scores?: Record<string, number>;
    comments?: string;
    status?: string;
    tags?: string[];
    flagged?: boolean;
    decision?: 'approved' | 'rejected';
    reviewer_id?: string;
    reviewer_name?: string;
  }) => {
    return goFetch<any>(`/forms/${formId}/submissions/${submissionId}/review-data`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },
  
  bulkAssignWorkflow: async (formId: string, submissionIds: string[], workflowId: string, stageId: string) => {
    return goFetch<{ count: number }>(`/forms/${formId}/submissions/bulk-assign-workflow`, {
      method: 'POST',
      body: JSON.stringify({ submission_ids: submissionIds, workflow_id: workflowId, stage_id: stageId }),
    });
  },
};
