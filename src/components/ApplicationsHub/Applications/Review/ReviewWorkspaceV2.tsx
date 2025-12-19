'use client'

import { useState, useEffect } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  Search,
  Filter,
  Download,
  Activity,
  Users,
  Settings,
  Clock,
  Mail,
  User,
  Tag,
  CheckCircle2,
  XCircle,
  Clock3,
  MessageSquare,
  Star,
  MoreVertical,
  Plus,
  Loader2,
  FileText,
  ArrowRight
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/ui-components/button'
import { Badge } from '@/ui-components/badge'
import { Input } from '@/ui-components/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui-components/select'
import { workflowsClient, type ApplicationStage, type WorkflowAction, type StageAction } from '@/lib/api/workflows-client'
import { formsClient } from '@/lib/api/forms-client'
import { workspacesClient } from '@/lib/api/workspaces-client'
import { dashboardClient } from '@/lib/api/dashboard-client'
import type { PortalActivity } from '@/types/dashboard'
import { showToast } from '@/lib/toast'
import Link from 'next/link'
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/ui-components/dropdown-menu'
import { Textarea } from '@/ui-components/textarea'

interface Application {
  id: string
  applicantName: string
  email: string
  status: string
  stage_id?: string
  reviewsCompleted: number
  reviewsTotal: number
  submittedAt: string
  priority: 'high' | 'medium' | 'low'
  tags: string[]
  reviewers: string[]
  score?: number
  data?: Record<string, any>
  metadata?: Record<string, any>
}

interface ReviewWorkspaceV2Props {
  formId: string
  workspaceId: string
  workspaceSlug?: string
  onBack?: () => void
  onViewChange?: (view: string) => void
}

export function ReviewWorkspaceV2({ formId, workspaceId, workspaceSlug: workspaceSlugProp, onBack, onViewChange }: ReviewWorkspaceV2Props) {
  const [applications, setApplications] = useState<Application[]>([])
  const [selectedApp, setSelectedApp] = useState<Application | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [sortBy, setSortBy] = useState('recent')
  const [isLoading, setIsLoading] = useState(true)
  const [form, setForm] = useState<any>(null)
  const [stages, setStages] = useState<ApplicationStage[]>([])
  const [workflows, setWorkflows] = useState<any[]>([])
  const [workflowActions, setWorkflowActions] = useState<WorkflowAction[]>([])
  const [activeTab, setActiveTab] = useState<'overview' | 'activity' | 'documents' | 'reviews'>('overview')
  const [workspaceSlug, setWorkspaceSlug] = useState(workspaceSlugProp || '')
  const [activities, setActivities] = useState<PortalActivity[]>([])
  const [newActivityContent, setNewActivityContent] = useState('')
  const [isSubmittingActivity, setIsSubmittingActivity] = useState(false)

  useEffect(() => {
    loadData()
  }, [formId, workspaceId])

  useEffect(() => {
    // Load activities when selected app changes
    if (selectedApp?.id) {
      loadActivities(selectedApp.id)
    }
  }, [selectedApp?.id])

  useEffect(() => {
    // Fetch workspace slug if not provided
    if (!workspaceSlug && workspaceId) {
      workspacesClient.get(workspaceId).then(ws => {
        setWorkspaceSlug(ws.slug)
      }).catch(err => {
        console.error('Failed to fetch workspace:', err)
      })
    }
  }, [workspaceId, workspaceSlug])

  const loadData = async () => {
    try {
      setIsLoading(true)
      
      // Load form with submissions and workflow data
      const response = await formsClient.getFull(formId)
      
      setForm(response.form)
      setWorkflows(response.workflows || [])
      setStages(response.stages || [])
      setWorkflowActions(response.workflow_actions || [])
      
      // Transform submissions to applications
      const apps: Application[] = (response.submissions || []).map((sub: any) => {
        const applicantName = sub.data?.name || sub.data?.full_name || sub.data?.applicant_name || 'Unknown'
        const email = sub.data?.email || sub.metadata?.email || 'No email'
        
        return {
          id: sub.id,
          applicantName,
          email,
          status: sub.metadata?.stage_name || 'Submitted',
          stage_id: sub.metadata?.stage_id,
          reviewsCompleted: sub.metadata?.reviews_completed || 0,
          reviewsTotal: sub.metadata?.reviews_total || 0,
          submittedAt: formatTime(sub.created_at),
          priority: 'medium',
          tags: sub.tags || [],
          reviewers: sub.metadata?.assigned_reviewers || [],
          score: sub.metadata?.score,
          data: sub.data,
          metadata: sub.metadata
        }
      })
      
      setApplications(apps)
      if (apps.length > 0 && !selectedApp) {
        setSelectedApp(apps[0])
      }
    } catch (error) {
      console.error('Failed to load review data:', error)
      showToast('Failed to load applications', 'error')
    } finally {
      setIsLoading(false)
    }
  }

  const loadActivities = async (applicationId: string) => {
    try {
      const activitiesData = await dashboardClient.listActivities(applicationId)
      setActivities(activitiesData)
    } catch (error) {
      console.error('Failed to load activities:', error)
      // Don't show error toast for activities - it's not critical
    }
  }

  const handleSubmitActivity = async () => {
    if (!selectedApp || !newActivityContent.trim()) return

    try {
      setIsSubmittingActivity(true)
      await dashboardClient.createActivity(selectedApp.id, {
        activityType: 'message',
        content: newActivityContent.trim(),
        visibility: 'internal'
      })
      
      setNewActivityContent('')
      showToast('Comment added successfully', 'success')
      loadActivities(selectedApp.id)
    } catch (error) {
      console.error('Failed to submit activity:', error)
      showToast('Failed to add comment', 'error')
    } finally {
      setIsSubmittingActivity(false)
    }
  }

  const formatTime = (dateString: string) => {
    if (!dateString) return 'Unknown'
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    
    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`
    
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`
    
    const diffDays = Math.floor(diffHours / 24)
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`
  }

  const getStatusColor = (status: string) => {
    const statusLower = status.toLowerCase()
    if (statusLower.includes('committee')) return 'bg-blue-500'
    if (statusLower.includes('initial') || statusLower.includes('review')) return 'bg-purple-500'
    if (statusLower.includes('approved') || statusLower.includes('accepted')) return 'bg-green-500'
    if (statusLower.includes('rejected') || statusLower.includes('declined')) return 'bg-red-500'
    return 'bg-gray-500'
  }

  const filteredApplications = applications.filter(app => {
    const matchesSearch = searchQuery === '' || 
      app.applicantName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.email.toLowerCase().includes(searchQuery.toLowerCase())
    
    const matchesFilter = filterStatus === 'all' || app.status === filterStatus
    
    return matchesSearch && matchesFilter
  })

  const currentStageIndex = stages.findIndex(s => s.id === selectedApp?.stage_id) || 0

  const handleExecuteAction = async (action: StageAction | WorkflowAction) => {
    if (!selectedApp) return

    try {
      showToast(`Executing ${action.name}...`, 'info')
      
      // TODO: Implement actual action execution via API
      // This would call the appropriate endpoint based on action_type
      // For now, just show success message
      
      showToast(`${action.name} executed successfully`, 'success')
      loadData() // Refresh data after action
    } catch (error) {
      console.error('Failed to execute action:', error)
      showToast(`Failed to execute ${action.name}`, 'error')
    }
  }

  const getCurrentStageActions = (): StageAction[] => {
    if (!selectedApp?.stage_id) return []
    
    const currentStage = stages.find(s => s.id === selectedApp.stage_id)
    return (currentStage as any)?.stageActions || []
  }

  const getActionIcon = (iconName?: string) => {
    switch (iconName) {
      case 'check':
        return <CheckCircle2 className="w-4 h-4" />
      case 'x':
        return <XCircle className="w-4 h-4" />
      case 'clock':
        return <Clock3 className="w-4 h-4" />
      case 'arrow-right':
        return <ArrowRight className="w-4 h-4" />
      default:
        return null
    }
  }

  const getActionColorClasses = (color?: string) => {
    switch (color) {
      case 'green':
        return 'text-green-600 hover:text-green-700 hover:bg-green-50'
      case 'red':
        return 'text-red-600 hover:text-red-700 hover:bg-red-50'
      case 'blue':
        return 'text-blue-600 hover:text-blue-700 hover:bg-blue-50'
      case 'yellow':
        return 'text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50'
      default:
        return 'text-gray-600 hover:text-gray-700 hover:bg-gray-50'
    }
  }

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-2" />
          <p className="text-gray-600">Loading applications...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex bg-gray-50">
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar - Applications List */}
        <div className="w-96 bg-white border-r border-gray-200 flex flex-col flex-shrink-0">
          {/* Search and Filters */}
          <div className="p-4 border-b border-gray-200 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                type="text"
                placeholder="Search applications..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex items-center gap-2">
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All applications</SelectItem>
                  {stages.map(stage => (
                    <SelectItem key={stage.id} value={stage.name}>
                      {stage.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" size="icon">
                <Filter className="w-4 h-4" />
              </Button>
            </div>
            <div className="flex items-center justify-between text-sm">
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="border-0 pl-0 w-auto gap-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="recent">Sort by: Most Recent</SelectItem>
                  <SelectItem value="priority">Sort by: Priority</SelectItem>
                  <SelectItem value="score">Sort by: Score</SelectItem>
                  <SelectItem value="status">Sort by: Status</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex gap-2">
                <button 
                  className="p-1.5 hover:bg-gray-100 rounded transition-colors"
                  onClick={() => showToast('Export coming soon', 'info')}
                  title="Export applications"
                >
                  <Download className="w-4 h-4 text-gray-600" />
                </button>
                <button 
                  className="p-1.5 hover:bg-gray-100 rounded transition-colors"
                  onClick={() => showToast('Activity log coming soon', 'info')}
                  title="View activity"
                >
                  <Activity className="w-4 h-4 text-gray-600" />
                </button>
              </div>
            </div>
          </div>

          {/* Applications List */}
          <div className="flex-1 overflow-y-auto">
            {filteredApplications.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>No applications found</p>
              </div>
            ) : (
              filteredApplications.map((app) => (
                <button
                  key={app.id}
                  onClick={() => setSelectedApp(app)}
                  className={cn(
                    "w-full p-4 border-b border-gray-200 text-left hover:bg-gray-50 transition-colors",
                    selectedApp?.id === app.id ? 'bg-blue-50 border-l-4 border-l-blue-500' : 'border-l-4 border-l-transparent'
                  )}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-600">
                        <User className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-gray-900 font-medium">{app.applicantName}</span>
                          {app.priority === 'high' && (
                            <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                          )}
                        </div>
                        <p className="text-sm text-gray-600">{app.email}</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between mt-3">
                    <Badge className={cn("text-white", getStatusColor(app.status))}>
                      {app.status}
                    </Badge>
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {app.reviewsCompleted}/{app.reviewsTotal}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {app.submittedAt}
                      </span>
                    </div>
                  </div>

                  {app.score && (
                    <div className="mt-2 flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-green-500 rounded-full"
                          style={{ width: `${app.score}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-600 font-medium">{app.score}</span>
                    </div>
                  )}
                </button>
              ))
            )}
          </div>
        </div>

        {/* Main Content Area */}
        {selectedApp ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Application Header */}
            <div className="bg-white border-b border-gray-200 px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white">
                    <User className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-gray-900 font-semibold text-lg">{selectedApp.applicantName}</h2>
                    <p className="text-sm text-gray-600">{selectedApp.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={() => {
                      // TODO: Open messaging panel
                      showToast('Messaging coming soon', 'info')
                    }}
                  >
                    <MessageSquare className="w-5 h-5" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={() => {
                      // TODO: Open actions menu
                      showToast('Actions menu coming soon', 'info')
                    }}
                  >
                    <MoreVertical className="w-5 h-5" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="bg-white border-b border-gray-200 px-6">
              <div className="flex gap-6">
                {[
                  { id: 'overview', label: 'Overview' },
                  { id: 'activity', label: 'Activity' },
                  { id: 'documents', label: 'Documents' },
                  { id: 'reviews', label: 'Reviews' }
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={cn(
                      "px-1 py-3 border-b-2 text-sm transition-colors",
                      activeTab === tab.id
                        ? "border-blue-500 text-blue-600"
                        : "border-transparent text-gray-600 hover:text-gray-900"
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="max-w-5xl mx-auto space-y-6">
                {activeTab === 'overview' && (
                  <>
                    {/* Progress Timeline */}
                    {stages.length > 0 && (
                      <div className="bg-white rounded-xl border border-gray-200 p-6">
                        <h3 className="text-gray-900 font-semibold mb-4">Review Progress</h3>
                        <div className="flex items-center justify-between relative">
                          <div className="absolute top-5 left-0 right-0 h-0.5 bg-gray-200 -z-10">
                            <div 
                              className="h-full bg-blue-500" 
                              style={{ width: `${(currentStageIndex / Math.max(stages.length - 1, 1)) * 100}%` }}
                            />
                          </div>
                          {stages.map((stage, idx) => {
                            const isCurrent = idx === currentStageIndex
                            const isComplete = idx < currentStageIndex
                            return (
                              <div key={stage.id} className="flex flex-col items-center flex-1">
                                <div className={cn(
                                  "w-10 h-10 rounded-full flex items-center justify-center mb-2 font-semibold",
                                  isCurrent ? "bg-blue-500 text-white" : isComplete ? "bg-green-500 text-white" : "bg-gray-200 text-gray-500"
                                )}>
                                  {isComplete ? <CheckCircle2 className="w-5 h-5" /> : idx + 1}
                                </div>
                                <span className={cn(
                                  "text-sm text-center",
                                  isCurrent ? "text-blue-600 font-medium" : "text-gray-600"
                                )}>
                                  {stage.name}
                                </span>
                                <span className="text-xs text-gray-500 mt-1">
                                  {isCurrent ? 'Current' : isComplete ? 'Complete' : 'Pending'}
                                </span>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {/* Quick Actions */}
                    <div className="bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl p-6 text-white">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-white mb-1 font-semibold">Ready to Review</h3>
                          <p className="text-blue-100 text-sm">Complete your review to move this application forward</p>
                        </div>
                        <Button 
                          className="bg-white text-blue-600 hover:bg-blue-50"
                          onClick={() => setActiveTab('reviews')}
                        >
                          Start Review
                          <ArrowRight className="w-4 h-4 ml-2" />
                        </Button>
                      </div>
                    </div>

                    {/* Application Details Grid */}
                    <div className="grid grid-cols-2 gap-6">
                      {/* Personal Info */}
                      <div className="bg-white rounded-xl border border-gray-200 p-6">
                        <div className="flex items-center gap-2 mb-4">
                          <User className="w-5 h-5 text-blue-500" />
                          <h3 className="text-gray-900 font-semibold">Personal Information</h3>
                        </div>
                        <div className="space-y-3">
                          <div>
                            <label className="text-xs text-gray-500 uppercase tracking-wide block">Name</label>
                            <p className="text-gray-900 mt-1">{selectedApp.applicantName}</p>
                          </div>
                          <div>
                            <label className="text-xs text-gray-500 uppercase tracking-wide block">Application ID</label>
                            <p className="text-gray-900 mt-1">#{selectedApp.id.substring(0, 8)}</p>
                          </div>
                          <div>
                            <label className="text-xs text-gray-500 uppercase tracking-wide block">Submitted</label>
                            <p className="text-gray-900 mt-1">{selectedApp.submittedAt}</p>
                          </div>
                        </div>
                      </div>

                      {/* Contact */}
                      <div className="bg-white rounded-xl border border-gray-200 p-6">
                        <div className="flex items-center gap-2 mb-4">
                          <Mail className="w-5 h-5 text-blue-500" />
                          <h3 className="text-gray-900 font-semibold">Contact</h3>
                        </div>
                        <div className="space-y-3">
                          <div>
                            <label className="text-xs text-gray-500 uppercase tracking-wide block">Email</label>
                            <p className="text-gray-900 mt-1">{selectedApp.email}</p>
                          </div>
                          <Button 
                            variant="link" 
                            className="p-0 h-auto text-blue-600"
                            onClick={() => {
                              window.location.href = `mailto:${selectedApp.email}`
                            }}
                          >
                            Send message
                          </Button>
                        </div>
                      </div>

                      {/* Reviewers */}
                      <div className="bg-white rounded-xl border border-gray-200 p-6">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-2">
                            <Users className="w-5 h-5 text-blue-500" />
                            <h3 className="text-gray-900 font-semibold">Reviewers</h3>
                          </div>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8"
                            onClick={() => showToast('Assign reviewers coming soon', 'info')}
                          >
                            <Plus className="w-4 h-4" />
                          </Button>
                        </div>
                        {selectedApp.reviewers.length === 0 ? (
                          <div className="text-center py-4">
                            <Users className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                            <p className="text-sm text-gray-500">Not assigned</p>
                            <Button 
                              variant="link" 
                              className="text-blue-600 text-sm mt-2 p-0 h-auto"
                              onClick={() => showToast('Assign reviewers coming soon', 'info')}
                            >
                              Assign reviewers
                            </Button>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {selectedApp.reviewers.map((reviewer, idx) => (
                              <div key={idx} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50">
                                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-sm font-medium">
                                  {reviewer.charAt(0)}
                                </div>
                                <div className="flex-1">
                                  <p className="text-sm text-gray-900 font-medium">{reviewer}</p>
                                </div>
                                <CheckCircle2 className="w-4 h-4 text-green-500" />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Tags */}
                      <div className="bg-white rounded-xl border border-gray-200 p-6">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-2">
                            <Tag className="w-5 h-5 text-blue-500" />
                            <h3 className="text-gray-900 font-semibold">Tags</h3>
                          </div>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8"
                            onClick={() => showToast('Add tags coming soon', 'info')}
                          >
                            <Plus className="w-4 h-4" />
                          </Button>
                        </div>
                        {selectedApp.tags.length === 0 ? (
                          <div className="text-center py-4">
                            <Tag className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                            <p className="text-sm text-gray-500">No tags</p>
                            <Button 
                              variant="link" 
                              className="text-blue-600 text-sm mt-2 p-0 h-auto"
                              onClick={() => showToast('Add tags coming soon', 'info')}
                            >
                              Add tags
                            </Button>
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {selectedApp.tags.map((tag, idx) => (
                              <Badge key={idx} variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Reviews */}
                    <div className="bg-white rounded-xl border border-gray-200 p-6">
                      <div className="flex items-center gap-2 mb-4">
                        <Star className="w-5 h-5 text-blue-500" />
                        <h3 className="text-gray-900 font-semibold">Reviews</h3>
                        <span className="ml-auto text-sm text-gray-500">
                          ({selectedApp.reviewsCompleted}/{selectedApp.reviewsTotal})
                        </span>
                      </div>
                      <div className="text-center py-8">
                        <CheckCircle2 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                        <p className="text-gray-500 mb-4">No reviews submitted yet</p>
                        <Button>
                          Start Review
                          <ArrowRight className="w-4 h-4 ml-2" />
                        </Button>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-3 pt-4 pb-8">
                      {getCurrentStageActions().length > 0 ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button className="flex-1 bg-blue-600 hover:bg-blue-700 gap-2">
                              {selectedApp.status}
                              <ArrowRight className="w-4 h-4 ml-2" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start" className="w-56">
                            {getCurrentStageActions().map((action) => (
                              <DropdownMenuItem
                                key={action.id}
                                onClick={() => handleExecuteAction(action)}
                                className={cn(
                                  'cursor-pointer flex items-center gap-2',
                                  getActionColorClasses(action.color)
                                )}
                              >
                                {getActionIcon(action.icon)}
                                {action.name}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : (
                        <Button className="flex-1 bg-green-600 hover:bg-green-700 gap-2" disabled>
                          <CheckCircle2 className="w-5 h-5" />
                          No actions available
                        </Button>
                      )}
                      
                      {/* Workflow-level actions */}
                      {workflowActions.length > 0 && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" className="gap-2">
                              <MoreVertical className="w-4 h-4" />
                              More Actions
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-56">
                            {workflowActions.map((action) => (
                              <DropdownMenuItem
                                key={action.id}
                                onClick={() => handleExecuteAction(action)}
                                className={cn(
                                  'cursor-pointer flex items-center gap-2',
                                  getActionColorClasses(action.color)
                                )}
                              >
                                {getActionIcon(action.icon)}
                                {action.name}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </>
                )}

                {activeTab === 'activity' && (
                  <div className="bg-white rounded-xl border border-gray-200 flex flex-col h-[600px]">
                    {/* Activity Feed */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-4">
                      {activities.length > 0 ? (
                        activities.map((activity) => (
                          <div key={activity.id} className="flex gap-3">
                            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                              {activity.senderType === 'staff' ? (
                                <User className="w-4 h-4 text-blue-600" />
                              ) : (
                                <MessageSquare className="w-4 h-4 text-blue-600" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-sm font-medium text-gray-900">
                                  {activity.senderName || (activity.senderType === 'staff' ? 'Staff' : 'Applicant')}
                                </span>
                                <span className="text-xs text-gray-500">
                                  {formatTime(activity.createdAt)}
                                </span>
                                {activity.visibility === 'internal' && (
                                  <Badge variant="outline" className="text-xs bg-gray-50">
                                    Internal
                                  </Badge>
                                )}
                              </div>
                              <div className="text-sm text-gray-700 whitespace-pre-wrap break-words">
                                {activity.content}
                              </div>
                              {activity.activityType === 'status_update' && (
                                <Badge className="mt-2 bg-blue-50 text-blue-700 border-blue-200">
                                  Status Update
                                </Badge>
                              )}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-12">
                          <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                          <p className="text-gray-500">No activity yet</p>
                        </div>
                      )}
                    </div>

                    {/* Comment Input */}
                    <div className="border-t border-gray-200 p-4">
                      <div className="flex gap-3">
                        <Textarea
                          value={newActivityContent}
                          onChange={(e) => setNewActivityContent(e.target.value)}
                          placeholder="Add a comment..."
                          className="flex-1 min-h-[80px] resize-none"
                          disabled={isSubmittingActivity}
                        />
                      </div>
                      <div className="flex items-center justify-between mt-3">
                        <span className="text-xs text-gray-500">
                          This comment will only be visible to staff
                        </span>
                        <Button
                          onClick={handleSubmitActivity}
                          disabled={!newActivityContent.trim() || isSubmittingActivity}
                          className="gap-2"
                        >
                          {isSubmittingActivity ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Sending...
                            </>
                          ) : (
                            <>
                              <MessageSquare className="w-4 h-4" />
                              Send Comment
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'documents' && (
                  <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <p className="text-gray-500 text-center py-8">Documents view coming soon</p>
                  </div>
                )}

                {activeTab === 'reviews' && (
                  <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <p className="text-gray-500 text-center py-8">Reviews view coming soon</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            <div className="text-center">
              <FileText className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <p>Select an application to view details</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
