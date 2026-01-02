/**
 * Recommendations API Client
 * Handles recommendation requests for letter of recommendation features
 */

import { goFetch } from './go-client'

// Types
export interface RecommendationRequest {
  id: string
  submission_id: string
  form_id: string
  field_id: string
  recommender_name: string
  recommender_email: string
  recommender_relationship?: string
  recommender_organization?: string
  token: string
  status: 'pending' | 'submitted' | 'expired' | 'cancelled'
  response?: Record<string, any>
  submitted_at?: string
  reminded_at?: string
  reminder_count: number
  expires_at?: string
  created_at: string
  updated_at: string
}

export interface RecommendationQuestion {
  id: string
  type: 'text' | 'textarea' | 'rating' | 'select' | 'checkbox'
  label: string
  description?: string
  required: boolean
  options?: string[]
  max_rating?: number
  max_length?: number
}

export interface CreateRecommendationInput {
  submission_id: string
  form_id: string
  field_id: string
  recommender_name: string
  recommender_email: string
  recommender_relationship?: string
  recommender_organization?: string
}

export interface SubmitRecommendationInput {
  response: Record<string, any>
}

export interface RecommendationByTokenResponse {
  request: RecommendationRequest
  applicant_name: string
  applicant_email: string
  form_title: string
  questions: RecommendationQuestion[]
  instructions?: string
  require_relationship?: boolean
  show_file_upload?: boolean
}

// Client
export const recommendationsClient = {
  /**
   * List recommendation requests for a submission
   */
  list: (submissionId: string) =>
    goFetch<RecommendationRequest[]>(`/recommendations?submission_id=${submissionId}`),

  /**
   * Get recommendation requests for a submission (reviewer view)
   */
  getForReview: (submissionId: string) =>
    goFetch<RecommendationRequest[]>(`/recommendations/submission/${submissionId}`),

  /**
   * Get a single recommendation request by ID
   */
  get: (id: string) =>
    goFetch<RecommendationRequest>(`/recommendations/${id}`),

  /**
   * Create a new recommendation request (sends email automatically)
   */
  create: (data: CreateRecommendationInput) =>
    goFetch<RecommendationRequest>('/recommendations', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  /**
   * Send a reminder email
   */
  sendReminder: (id: string) =>
    goFetch<{ message: string }>(`/recommendations/${id}/remind`, {
      method: 'POST',
    }),

  /**
   * Cancel a recommendation request
   */
  cancel: (id: string) =>
    goFetch<{ message: string }>(`/recommendations/${id}`, {
      method: 'DELETE',
    }),

  // Portal endpoints (for applicants using portal auth)
  
  /**
   * Create a new recommendation request from portal (no main auth required)
   */
  createFromPortal: async (data: CreateRecommendationInput): Promise<RecommendationRequest> => {
    const API_BASE = process.env.NEXT_PUBLIC_GO_API_URL || 'http://localhost:8080/api/v1'
    const response = await fetch(`${API_BASE}/portal/recommendations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to create recommendation request')
    }
    
    return response.json()
  },

  /**
   * List recommendation requests for a submission from portal (uses portal auth cookie)
   */
  listFromPortal: async (submissionId: string): Promise<RecommendationRequest[]> => {
    const API_BASE = process.env.NEXT_PUBLIC_GO_API_URL || 'http://localhost:8080/api/v1'
    const response = await fetch(`${API_BASE}/portal/dashboard/recommendations?submission_id=${submissionId}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include', // Include portal auth cookie
    })
    
    if (!response.ok) {
      // Return empty array if no recommendations found or not authorized
      if (response.status === 404 || response.status === 401) {
        return []
      }
      const error = await response.json().catch(() => ({ error: 'Failed to fetch recommendation requests' }))
      throw new Error(error.error || 'Failed to fetch recommendation requests')
    }
    
    return response.json()
  },

  // Public endpoints (no auth required - for recommenders)
  
  /**
   * Get recommendation request by token (public endpoint for recommenders)
   */
  getByToken: (token: string) =>
    goFetch<RecommendationByTokenResponse>(`/recommend/${token}`),

  /**
   * Submit a recommendation (public endpoint for recommenders)
   * Supports file upload for recommendation documents
   */
  submit: async (token: string, data: SubmitRecommendationInput, file?: File | null): Promise<{ message: string; request: RecommendationRequest }> => {
    const API_BASE = process.env.NEXT_PUBLIC_GO_API_URL || 'http://localhost:8080/api/v1'
    
    if (file) {
      // Use FormData for file upload
      const formData = new FormData()
      formData.append('response', JSON.stringify(data.response))
      formData.append('document', file)
      
      const response = await fetch(`${API_BASE}/recommend/${token}/submit`, {
        method: 'POST',
        body: formData,
      })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to submit recommendation')
      }
      
      return response.json()
    }
    
    // Regular JSON submission (no file)
    return goFetch<{ message: string; request: RecommendationRequest }>(`/recommend/${token}/submit`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },
}

export default recommendationsClient
