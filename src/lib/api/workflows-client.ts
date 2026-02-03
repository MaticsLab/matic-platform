/**
 * Workflows Client - DEPRECATED
 * This feature has been removed. Stub file to prevent import errors.
 */

// Export empty types and client for backward compatibility
export interface ReviewWorkflow {
  id: string;
  workspace_id: string;
  name: string;
  [key: string]: any;
}

export interface ApplicationStage {
  id: string;
  name: string;
  [key: string]: any;
}

export interface ReviewerType {
  id: string;
  name: string;
  [key: string]: any;
}

export interface Rubric {
  id: string;
  name: string;
  [key: string]: any;
}

export interface StageReviewerConfig {
  id: string;
  [key: string]: any;
}

export interface ApplicationGroup {
  id: string;
  [key: string]: any;
}

export interface WorkflowAction {
  id: string;
  [key: string]: any;
}

export interface StageGroup {
  id: string;
  [key: string]: any;
}

export interface StatusOption {
  [key: string]: any;
}

export interface CustomStatus {
  [key: string]: any;
}

export interface StatusActionConfig {
  [key: string]: any;
}

// Stub client with empty implementations
export const workflowsClient = {
  listReviewerTypes: async () => [],
  listStages: async () => [],
  listWorkflows: async () => [],
  listRubrics: async () => [],
  getReviewWorkspaceData: async () => ({
    workflows: [],
    rubrics: [],
    reviewer_types: [],
    stages: [],
    groups: [],
    actions: [],
  }),
  // Add any other methods that are being called
};
