/**
 * Portal Dashboard API Client
 * Client for applicant dashboard operations - activities, timeline, messaging
 */

import { goFetch } from './go-client'

// Types
export interface ApplicationInfo {
  id: string
  form_id: string
  form_name: string
  status: string
  stage_name?: string
  stage_color?: string
  data: Record<string, any>
  submitted_at: string
  updated_at: string
}

export interface DashboardSection {
  id: string
  type: 'status' | 'timeline' | 'submission' | 'messages' | 'documents'
  title: string
  visible: boolean
  collapsed?: boolean
  order: number
}

export interface DashboardLayout {
  sections: DashboardSection[]
  settings?: {
    // Snake_case from backend
    show_status?: boolean
    show_timeline?: boolean
    show_chat?: boolean
    show_documents?: boolean
    welcome_title?: string
    welcome_text?: string
    // CamelCase alternatives
    showStatus?: boolean
    showTimeline?: boolean
    showChat?: boolean
    showDocuments?: boolean
    welcomeTitle?: string
    welcomeText?: string
    // Legacy aliases
    show_status_badge?: boolean
    allow_messages?: boolean
  }
}

export interface TimelineEvent {
  id: string
  type: 'submitted' | 'stage_change' | 'message' | 'status_update'
  title: string
  content?: string
  timestamp: string
}

export interface PortalActivity {
  id: string
  row_id: string
  activity_type: 'message' | 'status_update' | 'file_request' | 'note'
  content: string
  metadata?: Record<string, any>
  visibility: 'applicant' | 'internal' | 'both'
  sender_type: 'applicant' | 'staff'
  sender_name?: string
  created_at: string
  is_read: boolean
}

export interface ApplicationDashboard {
  application: ApplicationInfo
  layout: DashboardLayout
  activities: PortalActivity[]
  timeline: TimelineEvent[]
}

export interface CreateActivityInput {
  activity_type: 'message' | 'status_update' | 'file_request' | 'note'
  content: string
  metadata?: Record<string, any>
  visibility: 'applicant' | 'internal' | 'both'
}

// API Client
export const portalDashboardClient = {
  /**
   * Get full dashboard data for an application
   * Includes application info, layout, activities, and timeline
   */
  getDashboard: (applicationId: string) =>
    goFetch<ApplicationDashboard>(`/portal/applications/${applicationId}`),

  /**
   * List activities for an application
   * @param visibility - Filter by visibility: 'applicant', 'internal', 'both', 'all'
   */
  listActivities: (applicationId: string, visibility?: string) => {
    const params = visibility ? { visibility } : undefined
    return goFetch<PortalActivity[]>(`/portal/applications/${applicationId}/activities`, { params })
  },

  /**
   * Create a new activity (message, note, etc.)
   */
  createActivity: (applicationId: string, input: CreateActivityInput) =>
    goFetch<PortalActivity>(`/portal/applications/${applicationId}/activities`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  /**
   * Mark activities as read
   * @param activityIds - Specific activity IDs to mark read, or empty for all
   * @param readerType - 'applicant' or 'staff'
   */
  markActivitiesRead: (
    applicationId: string,
    readerType: 'applicant' | 'staff',
    activityIds?: string[]
  ) =>
    goFetch<{ message: string }>(`/portal/applications/${applicationId}/activities/read`, {
      method: 'POST',
      body: JSON.stringify({
        activity_ids: activityIds || [],
        reader_type: readerType,
      }),
    }),
}

export default portalDashboardClient
