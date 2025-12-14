/**
 * Applicant Dashboard Types
 */

export interface DashboardSection {
  id: string
  title: string
  type: 'status' | 'timeline' | 'info' | 'fields' | 'chat' | 'documents'
  description?: string
  fields?: string[] // Field IDs to display
  widgets?: Record<string, unknown>[]
  settings?: Record<string, unknown>
}

export interface DashboardSettings {
  showStatus: boolean
  showTimeline: boolean
  showChat: boolean
  showDocuments: boolean
  welcomeTitle?: string
  welcomeText?: string
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
