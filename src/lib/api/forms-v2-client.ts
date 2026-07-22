// ============================================
// UNIFIED FORM SCHEMA — submission autosave client
// Only the live surface remains: DynamicApplicationForm.tsx's autosave
// flow depends on these two calls. The rest of the v2 form/field CRUD
// client (and its matching backend handlers) had zero callers and was
// removed.
// ============================================

import { goFetch } from './go-client';
import type { FormSubmission, SaveResponsesRequest } from '@/types/forms-v2';

const API_V2 = '/api/v2';

export const submissionsV2Client = {
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
};
