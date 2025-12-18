'use client'

import { Card } from '@/ui-components/card'
import { Button } from '@/ui-components/button'
import { Input } from '@/ui-components/input'
import { Label } from '@/ui-components/label'
import { ChevronDown, ChevronUp, Upload, AlertCircle, FileText, CheckCircle, User, Heart, Calendar, ExternalLink } from 'lucide-react'
import { useState, useMemo } from 'react'
import { PortalConfig } from '@/types/portal'
import { DashboardTask } from '@/types/tasks'
import { format, isPast, parseISO } from 'date-fns'

interface PriorityActionsProps {
  config: PortalConfig
  submissionData: Record<string, any>
  formId: string
  rowId?: string
  isPreview?: boolean
  applicationStatus?: string
  onTaskAction?: (taskId: string, action: string) => void
  onTaskComplete?: (taskId: string) => void
  completedTaskIds?: string[]
}

export function PriorityActions({
  config,
  submissionData,
  formId,
  rowId,
  isPreview = false,
  applicationStatus = 'draft',
  onTaskAction,
  onTaskComplete,
  completedTaskIds = []
}: PriorityActionsProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [selectedFiles, setSelectedFiles] = useState<Record<string, File>>({})
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set(completedTaskIds))

  const tasks = config.settings.dashboardSettings?.tasks || []

  // Get icon component based on icon name
  const getTaskIcon = (iconName?: string) => {
    switch (iconName) {
      case 'upload': return Upload
      case 'user': return User
      case 'check-circle': return CheckCircle
      case 'heart': return Heart
      case 'calendar': return Calendar
      case 'alert-circle': return AlertCircle
      case 'file-text':
      default: return FileText
    }
  }

  // Filter tasks based on conditions
  const visibleTasks = useMemo(() => {
    return tasks.filter(task => {
      // Skip if already completed (unless in preview)
      if (!isPreview && completedIds.has(task.id)) {
        return false
      }

      const conditions = task.conditions

      if (!conditions || conditions.showWhen === 'always') {
        return true
      }

      // Check field-based conditions
      if (conditions.showWhen === 'field_empty' && conditions.fieldId) {
        return !submissionData[conditions.fieldId]
      }

      if (conditions.showWhen === 'field_value' && conditions.fieldId) {
        return submissionData[conditions.fieldId] === conditions.fieldValue
      }

      // Check status-based conditions
      if (conditions.showWhen === 'status' && conditions.applicationStatus) {
        return conditions.applicationStatus.includes(applicationStatus)
      }

      return true
    })
  }, [tasks, submissionData, applicationStatus, completedIds, isPreview])

  // Categorize tasks
  const { pendingTasks, overdueTasks, completedTasks } = useMemo(() => {
    const pending: DashboardTask[] = []
    const overdue: DashboardTask[] = []
    const completed: DashboardTask[] = []

    visibleTasks.forEach(task => {
      if (completedIds.has(task.id)) {
        completed.push(task)
      } else if (task.deadline && isPast(parseISO(task.deadline))) {
        overdue.push(task)
      } else {
        pending.push(task)
      }
    })

    return { pendingTasks: pending, overdueTasks: overdue, completedTasks: completed }
  }, [visibleTasks, completedIds])

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id)
  }

  const handleFileSelect = (taskId: string, file: File | null) => {
    if (file) {
      setSelectedFiles(prev => ({ ...prev, [taskId]: file }))
    }
  }

  const handleTaskComplete = (taskId: string) => {
    setCompletedIds(prev => new Set([...prev, taskId]))
    onTaskComplete?.(taskId)
    setExpandedId(null)
  }

  const handleTaskAction = (task: DashboardTask, action: any) => {
    onTaskAction?.(task.id, action.type)
    
    // Handle specific action types
    if (action.type === 'navigate' && action.targetUrl) {
      window.location.href = action.targetUrl
    } else if (action.type === 'external_link' && action.targetUrl) {
      window.open(action.targetUrl, '_blank')
    }
  }

  const allTasks = [...overdueTasks, ...pendingTasks]
  const totalPending = allTasks.length

  // Preview mode with sample data
  if (isPreview && totalPending === 0) {
    const sampleTasks: DashboardTask[] = [
      {
        id: 'sample-1',
        type: 'complete_application',
        label: 'Complete Application Form',
        description: 'Finish filling out all required sections',
        icon: 'file-text',
        deadline: '2024-06-04T05:00:00Z',
        actions: [{ id: 'action-1', label: 'Continue Application', type: 'navigate', targetUrl: '/application' }],
        optional: false,
        priority: 'high'
      },
      {
        id: 'sample-2',
        type: 'upload_document',
        label: 'Upload a project plan',
        description: 'Submit your project proposal document',
        icon: 'upload',
        deadline: '2024-07-04T05:00:00Z',
        actions: [{ id: 'action-2', label: 'Upload Document', type: 'upload' }],
        optional: false
      },
      {
        id: 'sample-3',
        type: 'request_recommendation',
        label: 'Request a recommendation',
        description: 'Ask a mentor or supervisor for a letter of recommendation',
        icon: 'user',
        deadline: '2024-04-01T05:00:00Z',
        actions: [{ id: 'action-3', label: 'Request Letter', type: 'navigate' }],
        optional: true
      }
    ]

    return (
      <Card className="p-4 sm:p-6 border border-gray-200">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-3">
          <h2 className="text-lg font-semibold text-gray-900">Your Tasks</h2>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-orange-50 rounded-full">
            <AlertCircle className="w-3.5 h-3.5 text-orange-600" />
            <span className="text-xs font-medium text-orange-600">{sampleTasks.length} pending</span>
          </div>
        </div>
        
        <div className="space-y-2">
          {sampleTasks.map((task) => {
            const Icon = getTaskIcon(task.icon)
            const isOverdue = task.deadline && isPast(parseISO(task.deadline))
            
            return (
              <div
                key={task.id}
                className="border border-gray-200 bg-white rounded-lg p-3 hover:shadow-sm transition-shadow"
              >
                <div className="flex gap-3 items-start">
                  <div className="w-10 h-10 bg-gray-50 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Icon className="w-5 h-5 text-gray-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{task.label}</p>
                        {task.optional && (
                          <span className="text-xs text-gray-500">(optional)</span>
                        )}
                      </div>
                      <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    </div>
                    {task.deadline && (
                      <p className={`text-xs mt-1 ${isOverdue ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                        Deadline: {format(parseISO(task.deadline), 'MMM d, yyyy h:mm a')}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </Card>
    )
  }

  // Empty state
  if (totalPending === 0 && completedTasks.length === 0) {
    return (
      <Card className="p-4 sm:p-6 border border-gray-200">
        <div className="text-center py-8">
          <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-gray-900 mb-1">All caught up!</h3>
          <p className="text-sm text-gray-600">You've completed all your tasks.</p>
        </div>
      </Card>
    )
  }

  return (
    <Card className="p-4 sm:p-6 border border-gray-200">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-3">
        <h2 className="text-lg font-semibold text-gray-900">Your Tasks</h2>
        <div className="flex items-center gap-2 flex-wrap">
          {completedTasks.length > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 rounded-full">
              <CheckCircle className="w-3.5 h-3.5 text-green-600" />
              <span className="text-xs font-medium text-green-600">
                {completedTasks.length} completed
              </span>
            </div>
          )}
          {overdueTasks.length > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 rounded-full">
              <AlertCircle className="w-3.5 h-3.5 text-red-600" />
              <span className="text-xs font-medium text-red-600">{overdueTasks.length} overdue</span>
            </div>
          )}
          {pendingTasks.length > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-orange-50 rounded-full">
              <AlertCircle className="w-3.5 h-3.5 text-orange-600" />
              <span className="text-xs font-medium text-orange-600">{pendingTasks.length} pending</span>
            </div>
          )}
        </div>
      </div>
      
      <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
        {/* Overdue Tasks */}
        {overdueTasks.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-medium text-red-600 mb-2">
              <AlertCircle className="w-3.5 h-3.5" />
              Overdue
            </div>
            {overdueTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                isExpanded={expandedId === task.id}
                onToggle={() => toggleExpand(task.id)}
                onComplete={handleTaskComplete}
                onAction={handleTaskAction}
                selectedFile={selectedFiles[task.id]}
                onFileSelect={handleFileSelect}
                isOverdue={true}
                getIcon={getTaskIcon}
              />
            ))}
          </div>
        )}

        {/* Pending Tasks */}
        {pendingTasks.length > 0 && (
          <div className="space-y-2">
            {overdueTasks.length > 0 && (
              <div className="flex items-center gap-2 text-xs font-medium text-gray-600 mb-2 mt-4">
                Pending
              </div>
            )}
            {pendingTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                isExpanded={expandedId === task.id}
                onToggle={() => toggleExpand(task.id)}
                onComplete={handleTaskComplete}
                onAction={handleTaskAction}
                selectedFile={selectedFiles[task.id]}
                onFileSelect={handleFileSelect}
                isOverdue={false}
                getIcon={getTaskIcon}
              />
            ))}
          </div>
        )}

        {/* Completed Tasks */}
        {completedTasks.length > 0 && (
          <div className="space-y-2">
            {allTasks.length > 0 && (
              <div className="flex items-center gap-2 py-2 mt-4">
                <div className="flex-1 h-px bg-gray-200"></div>
                <span className="text-xs font-medium text-gray-500">Completed</span>
                <div className="flex-1 h-px bg-gray-200"></div>
              </div>
            )}
            {completedTasks.map((task) => {
              const Icon = getTaskIcon(task.icon)
              return (
                <div
                  key={task.id}
                  className="border border-green-200 bg-green-50 rounded-lg p-3"
                >
                  <div className="flex gap-3 items-center">
                    <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-green-700 line-through">{task.label}</p>
                      <p className="text-xs text-green-600 mt-0.5">Completed</p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </Card>
  )
}

// Task Card Component
function TaskCard({
  task,
  isExpanded,
  onToggle,
  onComplete,
  onAction,
  selectedFile,
  onFileSelect,
  isOverdue,
  getIcon
}: {
  task: DashboardTask
  isExpanded: boolean
  onToggle: () => void
  onComplete: (id: string) => void
  onAction: (task: DashboardTask, action: any) => void
  selectedFile?: File
  onFileSelect: (id: string, file: File | null) => void
  isOverdue: boolean
  getIcon: (iconName?: string) => any
}) {
  const Icon = getIcon(task.icon)
  const hasUploadAction = task.actions.some(a => a.type === 'upload')

  return (
    <div
      className={`border rounded-lg overflow-hidden transition-all ${
        isOverdue 
          ? 'border-red-200 bg-red-50' 
          : 'border-gray-200 bg-white hover:shadow-sm'
      }`}
    >
      <button
        onClick={onToggle}
        className="w-full p-3 flex items-start gap-3 text-left hover:bg-gray-50/50 transition-colors"
      >
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
          isOverdue ? 'bg-red-100' : 'bg-gray-50'
        }`}>
          <Icon className={`w-5 h-5 ${isOverdue ? 'text-red-600' : 'text-gray-600'}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <p className={`text-sm font-medium ${isOverdue ? 'text-red-900' : 'text-gray-900'}`}>
                {task.label}
                {task.optional && (
                  <span className="ml-2 text-xs text-gray-500 font-normal">(optional)</span>
                )}
              </p>
              {task.description && (
                <p className={`text-xs mt-1 ${isOverdue ? 'text-red-600' : 'text-gray-600'}`}>
                  {task.description}
                </p>
              )}
            </div>
            {isExpanded ? (
              <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
            ) : (
              <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
            )}
          </div>
          {task.deadline && (
            <p className={`text-xs mt-1.5 flex items-center gap-1 ${
              isOverdue ? 'text-red-600 font-medium' : 'text-gray-500'
            }`}>
              <Calendar className="w-3 h-3" />
              {isOverdue && 'Overdue: '}
              {format(parseISO(task.deadline), 'MMM d, yyyy h:mm a')}
            </p>
          )}
        </div>
      </button>

      {isExpanded && (
        <div className="px-3 pb-3 pt-2 bg-gray-50 border-t border-gray-200">
          {hasUploadAction ? (
            <div className="space-y-3">
              <div>
                <Label className="text-sm text-gray-700 mb-2 block">
                  {task.label}
                </Label>
                <label className="border-2 border-dashed border-gray-300 rounded-lg p-4 sm:p-6 text-center hover:border-gray-400 transition-colors cursor-pointer block">
                  <Upload className="w-6 h-6 text-gray-400 mx-auto mb-2" />
                  <p className="text-xs text-gray-600 mb-1">
                    Click to upload or drag and drop
                  </p>
                  <p className="text-xs text-gray-500">
                    {task.acceptedFileTypes?.join(', ') || 'PDF, DOC, DOCX'} (max {task.maxFileSize || 10}MB)
                  </p>
                  <input
                    type="file"
                    className="hidden"
                    accept={task.acceptedFileTypes?.join(',') || '.pdf,.doc,.docx'}
                    onChange={(e) => onFileSelect(task.id, e.target.files?.[0] || null)}
                  />
                </label>
              </div>
              {selectedFile && (
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 p-2.5 bg-white rounded-lg border border-gray-200">
                  <span className="text-sm text-gray-900 break-all">{selectedFile.name}</span>
                  <Button 
                    size="sm" 
                    onClick={() => onComplete(task.id)}
                    className="w-full sm:w-auto"
                  >
                    Upload & Complete
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {task.actions.map((action) => (
                <Button
                  key={action.id}
                  size="sm"
                  onClick={() => onAction(task, action)}
                  className="w-full justify-between"
                  variant={action.type === 'external_link' ? 'outline' : 'default'}
                >
                  {action.label}
                  {action.type === 'external_link' && (
                    <ExternalLink className="w-4 h-4 ml-2" />
                  )}
                </Button>
              ))}
              {!task.optional && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onComplete(task.id)}
                  className="w-full text-green-600 hover:text-green-700 hover:bg-green-50"
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Mark as Complete
                </Button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
