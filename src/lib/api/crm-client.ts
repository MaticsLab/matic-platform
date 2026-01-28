import { goFetch } from './go-client'
import type { ApplicantCRM, ApplicantDetailResponse } from '@/types/crm'

export const crmClient = {
  // Get all applicants for a workspace with their applications
  getApplicants: (workspaceId: string) =>
    goFetch<ApplicantCRM[]>(`/crm/applicants?workspace_id=${workspaceId}`),

  // Get detailed info about a specific applicant
  getApplicantDetail: (applicantId: string, workspaceId: string) =>
    goFetch<ApplicantDetailResponse>(`/crm/applicants/${applicantId}?workspace_id=${workspaceId}`),
}
