import { goFetch } from './go-client'

// ==================== TYPES ====================

export interface ApplicationSubmission {
  id: string
  user_id: string
  form_id: string
  status: SubmissionStatus
  stage_id?: string
  data: Record<string, any>
  version: number
  submitted_at?: string
  last_autosave_at?: string
  created_at: string
  updated_at: string
}

export type SubmissionStatus = 
  | 'draft' 
  | 'submitted' 
  | 'under_review' 
  | 'approved' 
  | 'rejected' 
  | 'waitlisted' 
  | 'withdrawn'

export interface AutosaveRequest {
  changes: Record<string, any>
  base_version: number
}

export interface AutosaveResponse {
  version: number
  saved_at: string
  conflict?: boolean
  server_data?: Record<string, any>
  server_version?: number
}

export interface SubmissionVersion {
  id: string
  submission_id: string
  version: number
  data: Record<string, any>
  changed_fields?: string[]
  change_type: 'autosave' | 'manual_save' | 'submit' | 'restore'
  created_at: string
}

// ==================== CLIENT ====================

export const submissionsClient = {
  /**
   * Start or get existing submission for a form
   * Creates a new draft if none exists
   */
  start: (formId: string) =>
    goFetch<ApplicationSubmission>(`/forms/${formId}/start`, { method: 'POST' }),

  /**
   * Get a submission by ID
   */
  get: (submissionId: string) =>
    goFetch<ApplicationSubmission>(`/submissions/${submissionId}`),

  /**
   * Autosave with optimistic locking
   * Only sends changed fields, detects conflicts
   */
  autosave: (submissionId: string, data: AutosaveRequest) =>
    goFetch<AutosaveResponse>(`/submissions/${submissionId}/autosave`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  /**
   * Full save (replaces all data)
   */
  save: (submissionId: string, data: Record<string, any>, version?: number) =>
    goFetch<ApplicationSubmission>(`/submissions/${submissionId}`, {
      method: 'PUT',
      body: JSON.stringify({ data, version }),
    }),

  /**
   * Final submission
   */
  submit: (submissionId: string) =>
    goFetch<ApplicationSubmission>(`/submissions/${submissionId}/submit`, {
      method: 'POST',
    }),

  /**
   * List all submissions for current user
   */
  list: (formId?: string) =>
    goFetch<ApplicationSubmission[]>(`/submissions${formId ? `?form_id=${formId}` : ''}`),

  /**
   * Get version history
   */
  getVersions: (submissionId: string) =>
    goFetch<SubmissionVersion[]>(`/submissions/${submissionId}/versions`),

  /**
   * Restore a previous version
   */
  restoreVersion: (submissionId: string, version: number) =>
    goFetch<ApplicationSubmission>(`/submissions/${submissionId}/restore/${version}`, {
      method: 'POST',
    }),

  /**
   * Withdraw a submitted application
   */
  withdraw: (submissionId: string) =>
    goFetch<ApplicationSubmission>(`/submissions/${submissionId}/withdraw`, {
      method: 'POST',
    }),
}

// ==================== PORTAL AUTH V2 ====================

export interface PortalUser {
  id: string
  email: string
  name: string
  user_type: 'applicant' | 'staff' | 'reviewer'
  forms_applied: string[]
  session_token?: string
  expires_at?: string
}

export interface PortalSignupRequest {
  form_id: string
  email: string
  password: string
  full_name?: string
}

export interface PortalLoginRequest {
  form_id: string
  email: string
  password: string
}

export interface PortalSignupResponse {
  id?: string
  email?: string
  user_id?: string
  message?: string
  action?: 'login' | 'created'
  existing?: boolean
}

const PORTAL_TOKEN_KEY = 'matic_portal_token'
const PORTAL_USER_KEY = 'matic_portal_user'

export const portalAuthV2 = {
  /**
   * Sign up as an applicant
   */
  signUp: async (data: PortalSignupRequest): Promise<PortalSignupResponse> => {
    const response = await goFetch<PortalSignupResponse>('/portal/v2/signup', {
      method: 'POST',
      body: JSON.stringify(data),
    })
    return response
  },

  /**
   * Log in as an applicant
   */
  login: async (data: PortalLoginRequest): Promise<PortalUser> => {
    const user = await goFetch<PortalUser>('/portal/v2/login', {
      method: 'POST',
      body: JSON.stringify(data),
    })
    
    // Store token and user
    if (user.session_token) {
      if (typeof window !== 'undefined') {
        localStorage.setItem(PORTAL_TOKEN_KEY, user.session_token)
        localStorage.setItem(PORTAL_USER_KEY, JSON.stringify(user))
      }
    }
    
    return user
  },

  /**
   * Get current user
   */
  getMe: () =>
    goFetch<PortalUser>('/portal/v2/me'),

  /**
   * Log out
   */
  logout: async () => {
    await goFetch('/portal/v2/logout', { method: 'POST' }).catch(() => {})
    
    if (typeof window !== 'undefined') {
      localStorage.removeItem(PORTAL_TOKEN_KEY)
      localStorage.removeItem(PORTAL_USER_KEY)
    }
  },

  /**
   * Get stored session token
   */
  getToken: (): string | null => {
    if (typeof window === 'undefined') return null
    return localStorage.getItem(PORTAL_TOKEN_KEY)
  },

  /**
   * Get stored user
   */
  getStoredUser: (): PortalUser | null => {
    if (typeof window === 'undefined') return null
    const stored = localStorage.getItem(PORTAL_USER_KEY)
    return stored ? JSON.parse(stored) : null
  },

  /**
   * Check if user is authenticated
   */
  isAuthenticated: (): boolean => {
    return !!portalAuthV2.getToken()
  },

  /**
   * Get all submissions for current user
   */
  getSubmissions: () =>
    goFetch<Array<ApplicationSubmission & { form_name: string }>>('/portal/v2/submissions'),
}
