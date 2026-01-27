// ============================================
// UNIFIED FORM API CLIENT (V2)
// Phase 3: Frontend API client for new schema
// ============================================

import { goFetch } from './go-client';
import type {
  Form,
  FormField,
  FormSubmission,
  FormSubmissionFull,
  UserFormSubmissions,
  CreateFormRequest,
  UpdateFormRequest,
  CreateFieldRequest,
  UpdateFieldRequest,
  SaveResponsesRequest,
  ListSubmissionsResponse,
} from '@/types/forms-v2';

const API_V2 = '/api/v2';

// ==================== FORM ENDPOINTS ====================

export const formsV2Client = {
  /**
   * List all forms in a workspace
   */
  list: (workspaceId: string) =>
    goFetch<Form[]>(`${API_V2}/forms?workspace_id=${workspaceId}`),

  /**
   * Get a form by ID (with sections and fields)
   */
  get: (formId: string) =>
    goFetch<Form>(`${API_V2}/forms/${formId}`),

  /**
   * Get a form by slug (with sections and fields)
   */
  getBySlug: (slug: string) =>
    goFetch<Form>(`${API_V2}/forms/slug/${slug}`),

  /**
   * Create a new form
   */
  create: (data: CreateFormRequest) =>
    goFetch<Form>(`${API_V2}/forms`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  /**
   * Update a form
   */
  update: (formId: string, data: UpdateFormRequest) =>
    goFetch<Form>(`${API_V2}/forms/${formId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  /**
   * Delete a form
   */
  delete: (formId: string) =>
    goFetch<{ message: string }>(`${API_V2}/forms/${formId}`, {
      method: 'DELETE',
    }),

  /**
   * Publish a form (change status to 'published')
   */
  publish: (formId: string) =>
    goFetch<Form>(`${API_V2}/forms/${formId}/publish`, {
      method: 'POST',
    }),
};

// ==================== FIELD ENDPOINTS ====================

export const formFieldsV2Client = {
  /**
   * List all fields for a form
   */
  list: (formId: string) =>
    goFetch<FormField[]>(`${API_V2}/forms/${formId}/fields`),

  /**
   * Create a new field
   */
  create: (formId: string, data: CreateFieldRequest) =>
    goFetch<FormField>(`${API_V2}/forms/${formId}/fields`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  /**
   * Update a field
   */
  update: (formId: string, fieldId: string, data: UpdateFieldRequest) =>
    goFetch<FormField>(`${API_V2}/forms/${formId}/fields/${fieldId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  /**
   * Delete a field
   */
  delete: (formId: string, fieldId: string) =>
    goFetch<{ message: string }>(`${API_V2}/forms/${formId}/fields/${fieldId}`, {
      method: 'DELETE',
    }),

  /**
   * Reorder fields within a form
   */
  reorder: (formId: string, fieldIds: string[]) =>
    goFetch<FormField[]>(`${API_V2}/forms/${formId}/fields/reorder`, {
      method: 'PUT',
      body: JSON.stringify({ field_ids: fieldIds }),
    }),
};

// ==================== SUBMISSION ENDPOINTS (User) ====================

export const submissionsV2Client = {
  /**
   * Get current user's submissions grouped by form
   */
  getMySubmissions: () =>
    goFetch<UserFormSubmissions>(`${API_V2}/submissions/me`),

  /**
   * Start a new submission for a form
   */
  start: (formId: string) =>
    goFetch<FormSubmission>(`${API_V2}/submissions/start/${formId}`, {
      method: 'POST',
    }),

  /**
   * Get a specific submission (with responses)
   */
  get: (submissionId: string) =>
    goFetch<FormSubmission>(`${API_V2}/submissions/${submissionId}`),

  /**
   * Save responses (autosave/partial save)
   */
  saveResponses: (submissionId: string, data: SaveResponsesRequest) =>
    goFetch<FormSubmission>(`${API_V2}/submissions/${submissionId}/responses`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  /**
   * Submit a submission (mark as submitted)
   */
  submit: (submissionId: string) =>
    goFetch<FormSubmission>(`${API_V2}/submissions/${submissionId}/submit`, {
      method: 'POST',
    }),

  /**
   * Withdraw a submission
   */
  withdraw: (submissionId: string) =>
    goFetch<FormSubmission>(`${API_V2}/submissions/${submissionId}/withdraw`, {
      method: 'POST',
    }),
};

// ==================== ADMIN ENDPOINTS ====================

export const formAdminV2Client = {
  /**
   * List all submissions for a form (admin view)
   */
  listSubmissions: (
    formId: string,
    params: {
      page?: number;
      limit?: number;
      status?: string;
      search?: string;
    } = {}
  ) => {
    const searchParams = new URLSearchParams();
    if (params.page) searchParams.set('page', params.page.toString());
    if (params.limit) searchParams.set('limit', params.limit.toString());
    if (params.status) searchParams.set('status', params.status);
    if (params.search) searchParams.set('search', params.search);
    
    const queryString = searchParams.toString();
    const url = `${API_V2}/admin/forms/${formId}/submissions${queryString ? `?${queryString}` : ''}`;
    
    return goFetch<ListSubmissionsResponse>(url);
  },

  /**
   * Get a single submission details (admin view)
   */
  getSubmission: (submissionId: string) =>
    goFetch<FormSubmissionFull>(`${API_V2}/admin/submissions/${submissionId}`),

  /**
   * Update submission status (admin action)
   */
  updateSubmissionStatus: (
    submissionId: string,
    status: string,
    reason?: string
  ) =>
    goFetch<FormSubmission>(`${API_V2}/admin/submissions/${submissionId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status, reason }),
    }),

  /**
   * Assign reviewer to submission
   */
  assignReviewer: (submissionId: string, reviewerId: string) =>
    goFetch<FormSubmission>(`${API_V2}/admin/submissions/${submissionId}/assign`, {
      method: 'PUT',
      body: JSON.stringify({ reviewer_id: reviewerId }),
    }),

  /**
   * Export submissions to CSV
   */
  exportSubmissions: (formId: string, status?: string) => {
    const searchParams = new URLSearchParams();
    if (status) searchParams.set('status', status);
    
    const queryString = searchParams.toString();
    const url = `${API_V2}/admin/forms/${formId}/export${queryString ? `?${queryString}` : ''}`;
    
    return goFetch<Blob>(url, {
      headers: {
        Accept: 'text/csv',
      },
    });
  },
};

// ==================== MIGRATION HELPERS ====================

export const formMigrationClient = {
  /**
   * Migrate a legacy form (data_table) to new schema
   */
  migrateForm: (legacyTableId: string) =>
    goFetch<{ form_id: string; success: boolean; message: string }>(
      `${API_V2}/migration/forms/${legacyTableId}`,
      { method: 'POST' }
    ),

  /**
   * Migrate legacy submissions (table_rows) for a form
   */
  migrateSubmissions: (formId: string) =>
    goFetch<{ migrated_count: number; success: boolean; errors: string[] }>(
      `${API_V2}/migration/forms/${formId}/submissions`,
      { method: 'POST' }
    ),

  /**
   * Check migration status for a form
   */
  getMigrationStatus: (formId: string) =>
    goFetch<{
      form_migrated: boolean;
      legacy_submissions_count: number;
      new_submissions_count: number;
      pending_migration_count: number;
    }>(`${API_V2}/migration/forms/${formId}/status`),
};

// ==================== CONVENIENCE HOOKS HELPERS ====================

/**
 * Helper to get field value from responses
 */
export function getResponseValue(
  responses: FormSubmission['responses'],
  fieldKey: string
): unknown {
  if (!responses) return undefined;
  
  const response = responses.find(r => r.field?.field_key === fieldKey);
  if (!response) return undefined;

  switch (response.value_type) {
    case 'text':
      return response.value_text;
    case 'number':
      return response.value_number;
    case 'boolean':
      return response.value_boolean;
    case 'date':
      return response.value_date;
    case 'datetime':
      return response.value_datetime;
    case 'json':
      return response.value_json;
    default:
      return response.value_text;
  }
}

/**
 * Helper to convert responses to a flat object
 */
export function responsesToObject(
  responses: FormSubmission['responses']
): Record<string, unknown> {
  if (!responses) return {};

  return responses.reduce<Record<string, unknown>>((acc, response) => {
    if (response.field?.field_key) {
      acc[response.field.field_key] = getResponseValue([response], response.field.field_key);
    }
    return acc;
  }, {});
}

/**
 * Helper to determine value type from field type
 */
export function getValueTypeForField(fieldType: string): string {
  switch (fieldType) {
    case 'number':
    case 'currency':
    case 'percentage':
    case 'rating':
    case 'scale':
      return 'number';
    case 'checkbox':
      return 'boolean';
    case 'date':
      return 'date';
    case 'datetime':
    case 'time':
      return 'datetime';
    case 'multiselect':
    case 'repeater':
    case 'address':
    case 'name':
      return 'json';
    default:
      return 'text';
  }
}

// ==================== DEFAULT EXPORTS ====================

export default {
  forms: formsV2Client,
  fields: formFieldsV2Client,
  submissions: submissionsV2Client,
  admin: formAdminV2Client,
  migration: formMigrationClient,
};
