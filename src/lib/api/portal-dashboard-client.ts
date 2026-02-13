/**
 * Portal Dashboard API Client
 * Client for applicant dashboard operations - activities, timeline, messaging
 * 
 * NOTE: This client is for PORTAL (applicant) usage, NOT staff.
 * It uses plain fetch with credentials to avoid the automatic /login redirects
 * that goFetch does for staff authentication.
 */

import { getPortalSessionToken } from '@/auth/client/portal'

// Get API URL (same logic as goFetch but without the redirect behavior)
const getApiUrl = () => {
  if (process.env.NEXT_PUBLIC_GO_API_URL) {
    return process.env.NEXT_PUBLIC_GO_API_URL
  }
  if (typeof window !== 'undefined') {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return 'http://localhost:8080/api/v1'
    }
  }
  return 'https://api.maticsapp.com/api/v1'
}

/**
 * Portal-safe fetch wrapper that doesn't auto-redirect to /login on 401
 * Uses Better Auth portal session tokens
 */
async function portalFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const apiUrl = getApiUrl()
  const url = `${apiUrl}${endpoint}`

  // Get portal session token
  const sessionToken = await getPortalSessionToken()

  const response = await fetch(url, {
    ...options,
    credentials: 'include', // Include Better Auth cookies
    headers: {
      'Content-Type': 'application/json',
      ...(sessionToken && { 'Authorization': `Bearer ${sessionToken}` }),
      ...options.headers,
    },
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }))
    
    // DON'T auto-redirect on 401 like goFetch does - let the portal component handle it    
    throw new Error(error.error || `Request failed with status ${response.status}`)
  }

  if (response.status === 204) {
    return null as T
  }

  return response.json()
}

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
    portalFetch<ApplicationDashboard>(`/portal/dashboard/applications/${applicationId}`),

  /**
   * List activities for an application
   * @param visibility - Filter by visibility: 'applicant', 'internal', 'both', 'all'
   */
  listActivities: (applicationId: string, visibility?: string) => {
    const params = visibility ? `?visibility=${visibility}` : ''
    return portalFetch<PortalActivity[]>(`/portal/dashboard/applications/${applicationId}/activities${params}`)
  },

  /**
   * Create a new activity (message, note, etc.)
   */
  createActivity: (applicationId: string, input: CreateActivityInput) =>
    portalFetch<PortalActivity>(`/portal/dashboard/applications/${applicationId}/activities`, {
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
    portalFetch<{ message: string }>(`/portal/dashboard/applications/${applicationId}/activities/read`, {
      method: 'POST',
      body: JSON.stringify({
        activity_ids: activityIds || [],
        reader_type: readerType,
      }),
    }),
}

export default portalDashboardClient
