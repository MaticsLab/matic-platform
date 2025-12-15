/**
 * Applicant Dashboard Types
 */

import type { Field as PortalField } from './portal'

// Dashboard-specific field that can include additional properties
export interface DashboardField extends Omit<PortalField, 'sectionId'> {
  dashboardOnly?: boolean // Fields added specifically for dashboard data collection
}

export interface DashboardSection {
  id: string
  title: string
  type: 'status' | 'timeline' | 'info' | 'fields' | 'chat' | 'documents'
  description?: string
  fields?: DashboardField[] // Full field objects for custom data collection
  fieldIds?: string[] // Field IDs to display from form (legacy)
  widgets?: Record<string, unknown>[]
  settings?: Record<string, unknown>
  isEnabled?: boolean
}

export interface DashboardSettings {
  showStatus: boolean
  showTimeline: boolean
  showChat: boolean
  showDocuments: boolean
  welcomeTitle?: string
  welcomeText?: string
  // Snake_case aliases for backend compatibility
  show_status?: boolean
  show_timeline?: boolean
  show_chat?: boolean
  show_documents?: boolean
  welcome_title?: string
  welcome_text?: string
  show_status_badge?: boolean // Legacy alias
  allow_messages?: boolean // Legacy alias
}

export interface DashboardLayout {
  sections: DashboardSection[]
  settings: DashboardSettings
  theme?: Record<string, unknown>
}

export interface ApplicationInfo {
  id: string
  formId: string
  formName: string
  status: string
  stageName?: string
  stageColor?: string
  data: Record<string, unknown>
  submittedAt?: string
  updatedAt: string
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
  rowId: string
  activityType: 'message' | 'status_update' | 'file_request' | 'note'
  content: string
  metadata?: Record<string, unknown>
  visibility: 'applicant' | 'internal' | 'both'
  senderType: 'applicant' | 'staff'
  senderName?: string
  createdAt: string
  isRead: boolean
}

export interface ApplicantDashboard {
  application: ApplicationInfo
  layout: DashboardLayout
  activities: PortalActivity[]
  timeline: TimelineEvent[]
}

export interface CreateActivityInput {
  activityType: 'message' | 'status_update' | 'file_request' | 'note'
  content: string
  metadata?: Record<string, unknown>
  visibility: 'applicant' | 'internal' | 'both'
}
