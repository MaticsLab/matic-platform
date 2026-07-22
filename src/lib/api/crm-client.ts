import { goFetch } from './go-client'

// Applicant list/detail lookups were only used by the now-removed CRM page.
// Password reset/set are still used by the applicant detail panel in the
// Applications review flow (ApplicationDetail.tsx) — kept.
export const crmClient = {
  // Reset applicant password and get temporary password
  resetPassword: (applicantId: string, workspaceId: string) =>
    goFetch<{
      success: boolean
      temporary_password: string
      email: string
      name: string
      message: string
    }>('/crm/applicants/reset-password', {
      method: 'POST',
      body: JSON.stringify({
        applicant_id: applicantId,
        workspace_id: workspaceId,
      }),
    }),

  // Set a custom password for an applicant
  setPassword: (applicantId: string, workspaceId: string, password: string) =>
    goFetch<{
      success: boolean
      email: string
      name: string
      message: string
    }>('/crm/applicants/set-password', {
      method: 'POST',
      body: JSON.stringify({
        applicant_id: applicantId,
        workspace_id: workspaceId,
        password: password,
      }),
    }),
}
