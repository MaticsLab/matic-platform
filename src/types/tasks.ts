export type TaskType = 
  | 'complete_application'
  | 'complete_field'
  | 'upload_document'
  | 'request_recommendation'
  | 'verify_information'
  | 'custom'

export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'overdue'

export type TaskAction = {
  id: string
  label: string
  type: 'navigate' | 'upload' | 'submit' | 'external_link'
  targetUrl?: string
  targetFieldId?: string
  targetSectionId?: string
}

export interface DashboardTask {
  id: string
  type: TaskType
  label: string
  description: string
  icon?: 'file-text' | 'upload' | 'user' | 'check-circle' | 'heart' | 'calendar' | 'alert-circle'
  
  // Timeline
  deadline?: string // ISO date string
  createdAt?: string
  
  // Conditions for showing task
  conditions?: {
    showWhen?: 'always' | 'field_empty' | 'field_value' | 'status'
    fieldId?: string
    fieldValue?: any
    applicationStatus?: string[]
  }
  
  // Actions
  actions: TaskAction[]
  
  // Optional
  optional?: boolean
  priority?: 'high' | 'medium' | 'low'
  completedAt?: string
  
  // For field-specific tasks
  relatedFieldIds?: string[]
  
  // For document uploads
  acceptedFileTypes?: string[]
  maxFileSize?: number
}

export interface TaskGroup {
  id: string
  name: string
  tasks: DashboardTask[]
  order: number
}
