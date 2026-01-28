// CRM Types - Applicant Management

export interface ApplicationSummary {
  form_id: string
  form_name: string
  form_slug?: string
  submission_id?: string
  status: 'not_started' | 'in_progress' | 'submitted' | 'approved' | 'rejected' | string
  completion_percentage: number
  submitted_at?: string
  last_saved_at?: string
  created_at: string
}

export interface ApplicantCRM {
  id: string
  email: string
  name?: string
  user_type: string
  created_at: string
  last_login_at?: string
  applications: ApplicationSummary[]
  total_forms: number
}

export interface ApplicantDetail {
  id: string
  email: string
  name?: string
  user_type: string
  created_at: string
  email_verified: boolean
}

export interface ApplicantDetailResponse {
  applicant: ApplicantDetail
  applications: ApplicationSummary[]
}
