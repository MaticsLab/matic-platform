/**
 * Portal Authentication API Client
 * Custom authentication for portal applicants (not Supabase Auth)
 */

const API_BASE = process.env.NEXT_PUBLIC_GO_API_URL || 'http://localhost:8080/api/v1'

export interface PortalSignupData {
  form_id: string
  email: string
  password: string
  full_name?: string
  data?: Record<string, any>
}

export interface PortalLoginData {
  form_id: string
  email: string
  password: string
}

export interface PortalApplicant {
  id: string
  email: string
  name: string
  submission_data?: Record<string, any>
  last_login_at?: string
}

export const portalAuthClient = {
  /**
   * Sign up a new portal applicant
   */
  signup: async (data: PortalSignupData): Promise<PortalApplicant> => {
    const response = await fetch(`${API_BASE}/portal/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Signup failed')
    }

    return response.json()
  },

  /**
   * Log in an existing portal applicant
   */
  login: async (data: PortalLoginData): Promise<PortalApplicant> => {
    const response = await fetch(`${API_BASE}/portal/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Login failed')
    }

    return response.json()
  },

  /**
   * Request a password reset email
   */
  requestReset: async (form_id: string, email: string): Promise<{ message: string; token?: string }> => {
    const response = await fetch(`${API_BASE}/portal/request-reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ form_id, email }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Request failed')
    }

    return response.json()
  },

  /**
   * Reset password with token
   */
  resetPassword: async (token: string, new_password: string): Promise<{ message: string }> => {
    const response = await fetch(`${API_BASE}/portal/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, new_password }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Password reset failed')
    }

    return response.json()
  },
}
