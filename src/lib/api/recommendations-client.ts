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

  // Public endpoints (no auth required - for recommenders)
  
  /**
   * Get recommendation request by token (public endpoint for recommenders)
   */
  getByToken: (token: string) =>
    goFetch<RecommendationByTokenResponse>(`/recommend/${token}`),

  /**
   * Submit a recommendation (public endpoint for recommenders)
   */
  submit: (token: string, data: SubmitRecommendationInput) =>
    goFetch<{ message: string; request: RecommendationRequest }>(`/recommend/${token}/submit`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
}

export default recommendationsClient
