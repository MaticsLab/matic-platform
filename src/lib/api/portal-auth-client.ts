/**
 * Portal Authentication API Client
 * Custom authentication for portal applicants (not Supabase Auth)
 */

// Helper function to get the correct API URL (matches PublicPortalV2 logic)
// Always prioritizes localhost detection in browser, ignoring env var when on localhost
const getApiUrl = () => {
  // In browser, ALWAYS check localhost first and ignore env var if on localhost
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      // Force local backend when running on localhost, regardless of env var
      return 'http://localhost:8080/api/v1'
    }
    // Not on localhost, check env var
    if (process.env.NEXT_PUBLIC_GO_API_URL) {
      return process.env.NEXT_PUBLIC_GO_API_URL
    }
    // Not on localhost and no env var, use production
    return 'https://api.maticsapp.com/api/v1'
  }
  // Server-side rendering - check env var
  if (process.env.NEXT_PUBLIC_GO_API_URL) {
    return process.env.NEXT_PUBLIC_GO_API_URL
  }
  // Server-side fallback
  return 'https://api.maticsapp.com/api/v1'
}

export interface PortalSignupData {
  form_id: string
  email: string
  password: string
  full_name?: string // Deprecated, use first_name and last_name
  first_name?: string
  last_name?: string
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
  row_id?: string
  status?: string
}

export const portalAuthClient = {
  /**
   * Sign up a new portal applicant
   */
  signup: async (data: PortalSignupData): Promise<PortalApplicant> => {
    const apiBase = getApiUrl()
    const response = await fetch(`${apiBase}/portal/signup`, {
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
    const apiBase = getApiUrl()
    console.log('[portal-auth-client] Attempting login:', { 
      apiBase, 
      form_id: data.form_id, 
      email: data.email 
    })
    
    const response = await fetch(`${apiBase}/portal/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }))
      console.error('[portal-auth-client] Login failed:', {
        status: response.status,
        statusText: response.statusText,
        error
      })
      throw new Error(error.error || 'Login failed')
    }

    const result = await response.json()
    console.log('[portal-auth-client] Login successful:', { id: result.id, email: result.email })
    return result
  },

  /**
   * Request a password reset email
   */
  requestReset: async (form_id: string, email: string): Promise<{ message: string; token?: string }> => {
    const apiBase = getApiUrl()
    const response = await fetch(`${apiBase}/portal/request-reset`, {
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
    const apiBase = getApiUrl()
    const response = await fetch(`${apiBase}/portal/reset-password`, {
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

  /**
   * Update applicant profile (name)
   */
  updateProfile: async (applicantId: string, data: { full_name?: string; first_name?: string; last_name?: string }): Promise<PortalApplicant> => {
    const apiBase = getApiUrl()
    const response = await fetch(`${apiBase}/portal/profile/${applicantId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to update profile')
    }

    return response.json()
  },

  /**
   * Change applicant password (requires current password)
   */
  changePassword: async (applicantId: string, currentPassword: string, newPassword: string): Promise<{ message: string }> => {
    const apiBase = getApiUrl()
    const response = await fetch(`${apiBase}/portal/profile/${applicantId}/password`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        current_password: currentPassword, 
        new_password: newPassword 
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to change password')
    }

    return response.json()
  },
}
