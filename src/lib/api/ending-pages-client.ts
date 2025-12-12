/**
 * Ending Pages API Client
 */

import { goFetch } from './go-client'
import { EndingPageConfig } from '@/types/ending-blocks'

export const endingPagesClient = {
  /**
   * Get all ending pages for a form
   */
  listByForm: (formId: string) =>
    goFetch<EndingPageConfig[]>(`/ending-pages?form_id=${formId}`),

  /**
   * Get a specific ending page
   */
  get: (endingId: string) =>
    goFetch<EndingPageConfig>(`/ending-pages/${endingId}`),

  /**
   * Create a new ending page
   */
  create: (formId: string, data: Omit<EndingPageConfig, 'id' | 'createdAt' | 'updatedAt'>) =>
    goFetch<EndingPageConfig>('/ending-pages', {
      method: 'POST',
      body: JSON.stringify({ ...data, formId })
    }),

  /**
   * Update an ending page
   */
  update: (endingId: string, data: Partial<EndingPageConfig>) =>
    goFetch<EndingPageConfig>(`/ending-pages/${endingId}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }),

  /**
   * Delete an ending page
   */
  delete: (endingId: string) =>
    goFetch<void>(`/ending-pages/${endingId}`, { method: 'DELETE' }),

  /**
   * Find matching ending for submission data
   */
  findMatching: (formId: string, submissionData: Record<string, any>) =>
    goFetch<EndingPageConfig | null>('/ending-pages/match', {
      method: 'POST',
      body: JSON.stringify({ formId, submissionData })
    })
}
