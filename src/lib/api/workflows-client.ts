import { goFetch } from './go-client';

// Types

// StatusOption - simple status option (for backward compatibility with custom_statuses JSON)
export interface StatusOption {
  name: string;
  color: string; // green, red, yellow, blue, purple, gray
  icon?: string; // check, x, clock, arrow-right, etc.
}

// Status action config defines what happens when a status is applied
export interface StatusActionConfig {
  action_type: 'move_to_stage' | 'move_to_group' | 'move_to_stage_group' | 'add_tags' | 'remove_tags' | 'send_email' | 'set_field';
  target_stage_id?: string;       // For move_to_stage
  target_group_id?: string;       // For move_to_group (application group)
  target_stage_group_id?: string; // For move_to_stage_group
  tags?: string[];                // For add_tags, remove_tags
  email_template_id?: string;     // For send_email
  field_name?: string;            // For set_field
  field_value?: string;           // For set_field
}

// Legacy StatusActionConfig (for backward compatibility)
export interface LegacyStatusActionConfig {
  move_to_stage_id?: string;
  move_to_group_id?: string;
  add_tags?: string[];
  remove_tags?: string[];
  set_status?: string;
  send_email?: boolean;
  email_template_id?: string;
  require_comment?: boolean;
}

// CustomStatus - proper model (stored in custom_statuses table)
export interface CustomStatus {
  id: string;
  stage_id: string;
  workspace_id: string;
  name: string;
  description?: string;
  color: string;
  icon: string;
  is_primary: boolean;
  order_index: number;
  requires_comment: boolean;
  requires_score: boolean;
  actions: StatusActionConfig[];
  created_at: string;
  updated_at: string;
}

// StageGroup - sub-groups within a stage (visible only in that stage)
export interface StageGroup {
  id: string;
  stage_id: string;
  workspace_id: string;
  name: string;
  description?: string;
  color: string;
  icon: string;
  order_index: number;
  created_at: string;
  updated_at: string;
}

// TagAutomation - automated actions triggered by tags
export interface TagAutomation {
  id: string;
  workspace_id: string;
  review_workflow_id: string;
  stage_id?: string;
  name: string;
  description?: string;
  trigger_type: 'tag_added' | 'tag_removed' | 'tag_present';
  trigger_tag: string;
  conditions?: Record<string, unknown>;
  actions: StatusActionConfig[];
  is_active: boolean;
  order_index: number;
  created_at: string;
  updated_at: string;
}

// CustomTag - reusable tags for workflow
export interface CustomTag {
  id: string;
  workspace_id: string;
  review_workflow_id: string;
  stage_id?: string;
  name: string;
  color: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

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
  color?: string;
  start_date?: string;
  end_date?: string;
  relative_deadline?: string;
  custom_statuses?: (string | StatusOption)[];    // Status action buttons (supports both old string format and new object format)
  custom_tags?: string[];                          // Available tags for this stage
  status_actions?: Record<string, LegacyStatusActionConfig>; // Actions keyed by status name (legacy)
  logic_rules?: {
    auto_advance_condition?: string;
    auto_reject_condition?: string;
    visibility_rules?: string;
  };
  hide_pii?: boolean;
  hidden_pii_fields?: string[];
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

// Application Group - for custom groups outside the pipeline (Rejected, Waitlist, etc.)
export interface ApplicationGroup {
  id: string;
  workspace_id: string;
  review_workflow_id: string;
  name: string;
  description?: string;
  color: string; // gray, red, orange, yellow, green, blue, purple, pink
  icon: string;  // folder, archive, x-circle, check-circle, clock, etc.
  order_index: number;
  is_system: boolean;
  created_at: string;
  updated_at: string;
}

// Workflow Action - global actions that apply to all stages (e.g., Reject)
export interface WorkflowAction {
  id: string;
  workspace_id: string;
  review_workflow_id: string;
  name: string;
  description?: string;
  color: string;
  icon: string;
  action_type: 'move_to_group' | 'move_to_stage' | 'send_email' | 'custom';
  target_group_id?: string;
  target_stage_id?: string;
  requires_comment: boolean;
  is_system: boolean;
  order_index: number;
  created_at: string;
  updated_at: string;
}

// Stage Action - actions specific to a stage
export interface StageAction {
  id: string;
  stage_id: string;
  name: string;
  description?: string;
  color: string;
  icon: string;
  action_type: 'set_status' | 'advance_stage' | 'move_to_group';
  target_group_id?: string;
  target_stage_id?: string;
  status_value?: string;
  requires_comment: boolean;
  order_index: number;
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
    decision?: string; // Custom statuses supported
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

  // Application Groups
  listGroups: async (workflowId: string) => {
    return goFetch<ApplicationGroup[]>(`/application-groups?workflow_id=${workflowId}`);
  },
  createGroup: async (data: Partial<ApplicationGroup>) => {
    return goFetch<ApplicationGroup>('/application-groups', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  getGroup: async (id: string) => {
    return goFetch<ApplicationGroup>(`/application-groups/${id}`);
  },
  updateGroup: async (id: string, data: Partial<ApplicationGroup>) => {
    return goFetch<ApplicationGroup>(`/application-groups/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },
  deleteGroup: async (id: string) => {
    return goFetch<void>(`/application-groups/${id}`, {
      method: 'DELETE',
    });
  },
  getGroupApplications: async (groupId: string, formId?: string) => {
    let url = `/application-groups/${groupId}/applications`;
    if (formId) url += `?form_id=${formId}`;
    return goFetch<any[]>(url);
  },

  // Workflow Actions
  listWorkflowActions: async (workflowId: string) => {
    return goFetch<WorkflowAction[]>(`/workflow-actions?workflow_id=${workflowId}`);
  },
  createWorkflowAction: async (data: Partial<WorkflowAction>) => {
    return goFetch<WorkflowAction>('/workflow-actions', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  getWorkflowAction: async (id: string) => {
    return goFetch<WorkflowAction>(`/workflow-actions/${id}`);
  },
  updateWorkflowAction: async (id: string, data: Partial<WorkflowAction>) => {
    return goFetch<WorkflowAction>(`/workflow-actions/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },
  deleteWorkflowAction: async (id: string) => {
    return goFetch<void>(`/workflow-actions/${id}`, {
      method: 'DELETE',
    });
  },

  // Stage Actions
  listStageActions: async (stageId: string) => {
    return goFetch<StageAction[]>(`/stage-actions?stage_id=${stageId}`);
  },
  createStageAction: async (data: Partial<StageAction>) => {
    return goFetch<StageAction>('/stage-actions', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  updateStageAction: async (id: string, data: Partial<StageAction>) => {
    return goFetch<StageAction>(`/stage-actions/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },
  deleteStageAction: async (id: string) => {
    return goFetch<void>(`/stage-actions/${id}`, {
      method: 'DELETE',
    });
  },

  // Action Execution
  executeAction: async (data: {
    form_id: string;
    submission_id: string;
    action_type: 'workflow_action' | 'stage_action';
    action_id: string;
    comment?: string;
  }) => {
    return goFetch<{ message: string; target_group_id?: string; target_stage_id?: string; status?: string }>('/actions/execute', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  moveToGroup: async (data: {
    form_id: string;
    submission_id: string;
    group_id: string;
    comment?: string;
  }) => {
    return goFetch<{ message: string; group_id: string }>('/actions/move-to-group', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  restoreFromGroup: async (data: {
    form_id: string;
    submission_id: string;
    stage_id: string;
  }) => {
    return goFetch<{ message: string; stage_id: string }>('/actions/restore-from-group', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  
  // Execute a status action from stage's custom_statuses
  executeStatusAction: async (data: {
    stage_id: string;
    status_name: string;
    submission_id: string;
    comment?: string;
  }) => {
    return goFetch<{ message: string; status: string; action_applied: boolean }>('/actions/execute-status', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Stage Groups (sub-groups within a stage, visible only in that stage)
  listStageGroups: async (stageId?: string, workspaceId?: string) => {
    const params = new URLSearchParams();
    if (stageId) params.append('stage_id', stageId);
    if (workspaceId) params.append('workspace_id', workspaceId);
    return goFetch<StageGroup[]>(`/stage-groups?${params.toString()}`);
  },
  createStageGroup: async (data: Partial<StageGroup>) => {
    return goFetch<StageGroup>('/stage-groups', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  getStageGroup: async (id: string) => {
    return goFetch<StageGroup>(`/stage-groups/${id}`);
  },
  updateStageGroup: async (id: string, data: Partial<StageGroup>) => {
    return goFetch<StageGroup>(`/stage-groups/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },
  deleteStageGroup: async (id: string) => {
    return goFetch<void>(`/stage-groups/${id}`, {
      method: 'DELETE',
    });
  },

  // Custom Statuses (action buttons in review interface - new comprehensive model)
  listCustomStatuses: async (stageId?: string, workspaceId?: string) => {
    const params = new URLSearchParams();
    if (stageId) params.append('stage_id', stageId);
    if (workspaceId) params.append('workspace_id', workspaceId);
    return goFetch<CustomStatus[]>(`/custom-statuses?${params.toString()}`);
  },
  createCustomStatus: async (data: Partial<CustomStatus>) => {
    return goFetch<CustomStatus>('/custom-statuses', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  getCustomStatus: async (id: string) => {
    return goFetch<CustomStatus>(`/custom-statuses/${id}`);
  },
  updateCustomStatus: async (id: string, data: Partial<CustomStatus>) => {
    return goFetch<CustomStatus>(`/custom-statuses/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },
  deleteCustomStatus: async (id: string) => {
    return goFetch<void>(`/custom-statuses/${id}`, {
      method: 'DELETE',
    });
  },

  // Move to Stage Group
  moveToStageGroup: async (data: {
    submission_id: string;
    stage_group_id?: string; // null to remove from group
    comment?: string;
  }) => {
    return goFetch<{ message: string; stage_group_id?: string }>('/actions/move-to-stage-group', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
};
