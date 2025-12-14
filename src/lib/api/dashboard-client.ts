/**
 * Applicant Dashboard API Client
 */

import { goFetch } from './go-client'
import type {
  DashboardLayout,
  ApplicantDashboard,
  PortalActivity,
  CreateActivityInput
} from '@/types/dashboard'

const BASE_URL = process.env.NEXT_PUBLIC_GO_API_URL || 'http://localhost:8080/api/v1'

export const dashboardClient = {
  // ========== Dashboard Layout (Admin) ==========
  
  /**
   * Get the dashboard layout configuration for a form
   */
  getLayout: (formId: string) =>
    goFetch<DashboardLayout>(`/forms/${formId}/dashboard`),

  /**
   * Update the dashboard layout configuration
   */
  updateLayout: (formId: string, layout: DashboardLayout) =>
    goFetch<DashboardLayout>(`/forms/${formId}/dashboard`, {
      method: 'PUT',
      body: JSON.stringify(layout)
    }),

  // ========== Applicant Dashboard (Portal) ==========

  /**
   * Get full dashboard data for an applicant viewing their application
   * Note: This endpoint uses portal auth (applicant token)
   */
  getApplicantDashboard: async (applicationId: string, portalToken?: string): Promise<ApplicantDashboard> => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    }
    if (portalToken) {
      headers['X-Portal-Token'] = portalToken
    }
    
    const response = await fetch(`${BASE_URL}/portal/applications/${applicationId}`, { headers })
    if (!response.ok) {
      throw new Error(`Failed to fetch dashboard: ${response.status}`)
    }
    return response.json()
  },

  // ========== Portal Activities (Chat) ==========

  /**
   * List activities for an application
   */
  listActivities: async (applicationId: string, visibility?: string, portalToken?: string): Promise<PortalActivity[]> => {
    const params = visibility ? `?visibility=${visibility}` : ''
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    }
    if (portalToken) {
      headers['X-Portal-Token'] = portalToken
    }
    
    const response = await fetch(`${BASE_URL}/portal/applications/${applicationId}/activities${params}`, { headers })
    if (!response.ok) {
      throw new Error(`Failed to fetch activities: ${response.status}`)
    }
    return response.json()
  },

  /**
   * Create a new activity (send message)
   */
  createActivity: async (applicationId: string, input: CreateActivityInput, portalToken?: string): Promise<PortalActivity> => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    }
    if (portalToken) {
      headers['X-Portal-Token'] = portalToken
    }
    
    const response = await fetch(`${BASE_URL}/portal/applications/${applicationId}/activities`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        activity_type: input.activityType,
        content: input.content,
        metadata: input.metadata,
        visibility: input.visibility
      })
    })
    if (!response.ok) {
      throw new Error(`Failed to create activity: ${response.status}`)
    }
    return response.json()
  },

  /**
   * Mark activities as read
   */
  markActivitiesRead: async (
    applicationId: string,
    activityIds: string[] | 'all',
    readerType: 'applicant' | 'staff',
    portalToken?: string
  ): Promise<void> => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    }
    if (portalToken) {
      headers['X-Portal-Token'] = portalToken
    }
    
    const body = {
      activity_ids: activityIds === 'all' ? [] : activityIds,
      reader_type: readerType
    }
    
    const response = await fetch(`${BASE_URL}/portal/applications/${applicationId}/activities/read`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    })
    if (!response.ok) {
      throw new Error(`Failed to mark activities read: ${response.status}`)
    }
  }
}
