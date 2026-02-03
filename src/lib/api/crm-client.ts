import { goFetch } from './go-client'
import type { ApplicantCRM, ApplicantDetailResponse } from '@/types/crm'

export const crmClient = {
  // Get all applicants for a workspace with their applications
  getApplicants: (workspaceId: string) =>
    goFetch<ApplicantCRM[]>(`/crm/applicants?workspace_id=${workspaceId}`),

  // Get detailed info about a specific applicant
  getApplicantDetail: (applicantId: string, workspaceId: string) =>
    goFetch<ApplicantDetailResponse>(`/crm/applicants/${applicantId}?workspace_id=${workspaceId}`),

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
