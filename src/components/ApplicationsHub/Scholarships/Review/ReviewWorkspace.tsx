'use client'

import { useState, useMemo, useEffect } from 'react'
import { 
  Search, ChevronRight, ChevronLeft, Star, CheckCircle, 
  FileText, Users, Award, Flag, 
  ThumbsUp, ThumbsDown, AlertCircle, Loader2, 
  Eye, Clock, User, MessageSquare,
  ArrowRight, Filter, LayoutGrid, List,
  X, Save, RefreshCw, Zap, Play, Pause,
  ChevronDown, Maximize2, Minimize2, Send,
  Target, TrendingUp, BarChart3, Layers,
  UserCheck, UserPlus, ArrowUpRight, Inbox
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { goClient } from '@/lib/api/go-client'
import { FormSubmission, Form } from '@/types/forms'
import { 
  workflowsClient, 
  ApplicationStage, 
  Rubric, 
  StageReviewerConfig, 
  ReviewerType,
  ReviewWorkflow 
} from '@/lib/api/workflows-client'
import { Button } from '@/ui-components/button'
import { Badge } from '@/ui-components/badge'

interface ReviewWorkspaceProps {
  workspaceId: string
  formId: string | null
}

interface ApplicationData {
  id: string
  name: string
  email: string
  submittedAt: string
  stageId: string
  stageName: string
  status: 'pending' | 'in_review' | 'approved' | 'rejected' | 'needs_info'
  score: number | null
  maxScore: number
  reviewCount: number
  requiredReviews: number
  assignedReviewers: string[]
  tags: string[]
  raw_data: Record<string, any>
  scores: Record<string, number>
  comments: string
  flagged: boolean
  workflowId?: string
}

interface StageWithConfig extends ApplicationStage {
  reviewerConfigs: StageReviewerConfig[]
  rubric: Rubric | null
  applicationCount: number
}

type ViewMode = 'focus' | 'queue' | 'analytics'

export function ReviewWorkspace({ workspaceId, formId }: ReviewWorkspaceProps) {
  // Core state
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [workflows, setWorkflows] = useState<ReviewWorkflow[]>([])
  const [workflow, setWorkflow] = useState<ReviewWorkflow | null>(null)
  const [stages, setStages] = useState<StageWithConfig[]>([])
  const [applications, setApplications] = useState<ApplicationData[]>([])
  const [reviewerTypes, setReviewerTypes] = useState<ReviewerType[]>([])
  const [rubrics, setRubrics] = useState<Rubric[]>([])
  
  // UI state
  const [viewMode, setViewMode] = useState<ViewMode>('queue')
  const [selectedStageId, setSelectedStageId] = useState<string>('all')
  const [selectedAppIndex, setSelectedAppIndex] = useState(0)
  const [isReviewMode, setIsReviewMode] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterScoreMin, setFilterScoreMin] = useState<number | null>(null)
  const [filterScoreMax, setFilterScoreMax] = useState<number | null>(null)
  const [filterTags, setFilterTags] = useState<string[]>([])
  const [filterReviewerType, setFilterReviewerType] = useState<string>('all')
  const [filterReviewed, setFilterReviewed] = useState<string>('all') // 'all', 'reviewed', 'unreviewed'
  const [showWorkflowSelector, setShowWorkflowSelector] = useState(false)
  const [selectedAppsForBulk, setSelectedAppsForBulk] = useState<string[]>([])
  
  // Scoring state
  const [editingScores, setEditingScores] = useState<Record<string, number>>({})
  const [editingComments, setEditingComments] = useState('')
  const [reviewTimer, setReviewTimer] = useState(0)
  const [timerActive, setTimerActive] = useState(false)

  // Timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout
    if (timerActive && isReviewMode) {
      interval = setInterval(() => setReviewTimer(t => t + 1), 1000)
    }
    return () => clearInterval(interval)
  }, [timerActive, isReviewMode])

  // Load all data
  useEffect(() => {
    if (!formId || !workspaceId) return
    loadData()
  }, [formId, workspaceId])

  // Reload stages when workflow changes
  useEffect(() => {
    if (!workflow || !workspaceId) return
    loadStagesForWorkflow(workflow.id)
  }, [workflow?.id])

  const loadStagesForWorkflow = async (workflowId: string) => {
    try {
      const stagesData = await workflowsClient.listStages(workspaceId, workflowId)
      
      const loadedStages = await Promise.all(
        stagesData.map(async (stage) => {
          let configs: StageReviewerConfig[] = []
          try {
            configs = await workflowsClient.listStageConfigs(stage.id)
          } catch {}
          
          const primaryConfig = configs[0]
          const rubric = primaryConfig?.rubric_id 
            ? rubrics.find(r => r.id === primaryConfig.rubric_id) || null
            : null
          
          return {
            ...stage,
            reviewerConfigs: configs,
            rubric,
            applicationCount: applications.filter(a => a.stageId === stage.id).length
          }
        })
      )
      
      const sorted = loadedStages.sort((a, b) => a.order_index - b.order_index)
      setStages(sorted)
    } catch (error) {
      console.error('Failed to load stages:', error)
    }
  }

  const loadData = async () => {
    setIsLoading(true)
    try {
      const form = await goClient.get<Form>(`/forms/${formId}`)
      const settings = form.settings || {}
      const workflowId = settings.workflow_id

      const [allWorkflows, allRubrics, allReviewerTypes] = await Promise.all([
        workflowsClient.listWorkflows(workspaceId),
        workflowsClient.listRubrics(workspaceId),
        workflowsClient.listReviewerTypes(workspaceId)
      ])
      
      setWorkflows(allWorkflows)
      setRubrics(allRubrics)
      setReviewerTypes(allReviewerTypes)

      let activeWorkflow = workflowId 
        ? allWorkflows.find(w => w.id === workflowId) 
        : allWorkflows.find(w => w.is_active) || allWorkflows[0]
      
      let loadedStages: StageWithConfig[] = []
      
      if (activeWorkflow) {
        setWorkflow(activeWorkflow)
        
        const stagesData = await workflowsClient.listStages(workspaceId, activeWorkflow.id)
        
        loadedStages = await Promise.all(
          stagesData.map(async (stage) => {
            let configs: StageReviewerConfig[] = []
            try {
              configs = await workflowsClient.listStageConfigs(stage.id)
            } catch {}
            
            const primaryConfig = configs[0]
            const rubric = primaryConfig?.rubric_id 
              ? allRubrics.find(r => r.id === primaryConfig.rubric_id) || null
              : null
            
            return {
              ...stage,
              reviewerConfigs: configs,
              rubric,
              applicationCount: 0
            }
          })
        )
        
        loadedStages = loadedStages.sort((a, b) => a.order_index - b.order_index)
        setStages(loadedStages)
        if (loadedStages.length > 0) setSelectedStageId(loadedStages[0].id)
      }

      const submissions = await goClient.get<FormSubmission[]>(`/forms/${formId}/submissions`)
      
      const apps: ApplicationData[] = submissions.map((sub) => {
        const data = sub.data || {}
        const metadata = (sub as any).metadata || {}
        
        const name = data['Full Name'] || data['name'] || data['Name'] || 
                    `${data['First Name'] || ''} ${data['Last Name'] || ''}`.trim() ||
                    `Applicant ${sub.id.substring(0, 6)}`
        
        const email = data['Email'] || data['email'] || ''
        
        // Use metadata for workflow tracking
        const assignedWorkflowId = metadata.assigned_workflow_id
        const stageId = metadata.current_stage_id || (loadedStages.length > 0 ? loadedStages[0].id : '')
        const stage = loadedStages.find(s => s.id === stageId)
        
        return {
          id: sub.id,
          name,
          email,
          submittedAt: sub.submitted_at,
          stageId,
          stageName: stage?.name || 'Unassigned',
          status: metadata.status || 'pending',
          score: metadata.total_score || null,
          maxScore: stage?.rubric?.max_score || 100,
          reviewCount: metadata.review_count || 0,
          requiredReviews: stage?.reviewerConfigs?.[0]?.min_reviews_required || 1,
          assignedReviewers: metadata.assigned_reviewers || [],
          tags: metadata.tags || [],
          raw_data: data,
          scores: metadata.scores || {},
          comments: metadata.comments || '',
          flagged: metadata.flagged || false,
          workflowId: assignedWorkflowId
        }
      })
      
      setApplications(apps)
      
      const updatedStages = loadedStages.map(stage => ({
        ...stage,
        applicationCount: apps.filter(a => a.stageId === stage.id).length
      }))
      setStages(updatedStages)

    } catch (error) {
      console.error('Failed to load review data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Get filtered applications for current stage
  // Get all unique tags from applications for filter options
  const allTags = useMemo(() => {
    const tagSet = new Set<string>()
    applications.forEach(app => app.tags.forEach(tag => tagSet.add(tag)))
    return Array.from(tagSet).sort()
  }, [applications])

  const stageApps = useMemo(() => {
    return applications.filter(app => {
      const matchesStage = selectedStageId === 'all' || app.stageId === selectedStageId
      const matchesWorkflow = !workflow || app.workflowId === workflow.id || !app.workflowId // Include unassigned
      const matchesSearch = !searchQuery || 
        app.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        app.email.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesStatus = filterStatus === 'all' || app.status === filterStatus
      
      // Score range filter
      const matchesScoreMin = filterScoreMin === null || (app.score !== null && app.score >= filterScoreMin)
      const matchesScoreMax = filterScoreMax === null || (app.score !== null && app.score <= filterScoreMax)
      
      // Tags filter - app must have all selected tags
      const matchesTags = filterTags.length === 0 || filterTags.every(tag => app.tags.includes(tag))
      
      // Reviewed filter
      const matchesReviewed = 
        filterReviewed === 'all' || 
        (filterReviewed === 'reviewed' && app.reviewCount > 0) ||
        (filterReviewed === 'unreviewed' && app.reviewCount === 0)
      
      return matchesStage && matchesWorkflow && matchesSearch && matchesStatus && 
             matchesScoreMin && matchesScoreMax && matchesTags && matchesReviewed
    })
  }, [applications, selectedStageId, workflow, searchQuery, filterStatus, filterScoreMin, filterScoreMax, filterTags, filterReviewed])

  // Current application
  const currentApp = stageApps[selectedAppIndex] || null
  const currentStage = stages.find(s => s.id === selectedStageId) || (currentApp ? stages.find(s => s.id === currentApp.stageId) : null)
  const currentRubric = currentStage?.rubric || null

  // Stats for current workflow
  const stats = useMemo(() => {
    const workflowApps = workflow 
      ? applications.filter(a => a.workflowId === workflow.id || !a.workflowId)
      : applications
    const pending = workflowApps.filter(a => a.status === 'pending').length
    const inReview = workflowApps.filter(a => a.status === 'in_review').length
    const approved = workflowApps.filter(a => a.status === 'approved').length
    const rejected = workflowApps.filter(a => a.status === 'rejected').length
    const unassigned = workflowApps.filter(a => !a.workflowId).length
    const avgScore = workflowApps.filter(a => a.score !== null).reduce((acc, a) => acc + (a.score || 0), 0) / 
                     Math.max(workflowApps.filter(a => a.score !== null).length, 1)
    return { pending, inReview, approved, rejected, unassigned, avgScore: Math.round(avgScore), total: workflowApps.length }
  }, [applications, workflow])

  // Navigation
  const goToNext = () => {
    if (selectedAppIndex < stageApps.length - 1) {
      setSelectedAppIndex(prev => prev + 1)
      resetReview()
    }
  }
  
  const goToPrev = () => {
    if (selectedAppIndex > 0) {
      setSelectedAppIndex(prev => prev - 1)
      resetReview()
    }
  }

  const resetReview = () => {
    setEditingScores({})
    setEditingComments('')
    setReviewTimer(0)
    setTimerActive(false)
  }

  const startReview = () => {
    if (currentApp) {
      setIsReviewMode(true)
      setEditingScores(currentApp.scores)
      setEditingComments(currentApp.comments)
      setTimerActive(true)
    }
  }

  const handleMoveToStage = async (appId: string, newStageId: string, reason?: string) => {
    if (!formId) return
    
    try {
      // Persist to backend
      await workflowsClient.moveToStage(formId, appId, newStageId, reason)
      
      // Update local state
      setApplications(prev => prev.map(app => 
        app.id === appId 
          ? { ...app, stageId: newStageId, stageName: stages.find(s => s.id === newStageId)?.name || '' }
          : app
      ))
      
      // Update stage counts
      setStages(prev => prev.map(stage => ({
        ...stage,
        applicationCount: applications.filter(a => 
          a.id === appId ? newStageId === stage.id : a.stageId === stage.id
        ).length
      })))
    } catch (error) {
      console.error('Failed to move to stage:', error)
    }
  }

  const handleAssignWorkflow = async (appId: string, workflowId: string, stageId: string) => {
    if (!formId) return
    
    try {
      await workflowsClient.assignWorkflow(formId, appId, workflowId, stageId)
      
      setApplications(prev => prev.map(app => 
        app.id === appId 
          ? { ...app, workflowId, stageId, stageName: stages.find(s => s.id === stageId)?.name || '' }
          : app
      ))
    } catch (error) {
      console.error('Failed to assign workflow:', error)
    }
  }

  const handleBulkAssignWorkflow = async (workflowId: string, stageId: string) => {
    if (!formId || selectedAppsForBulk.length === 0) return
    
    try {
      await workflowsClient.bulkAssignWorkflow(formId, selectedAppsForBulk, workflowId, stageId)
      
      setApplications(prev => prev.map(app => 
        selectedAppsForBulk.includes(app.id)
          ? { ...app, workflowId, stageId, stageName: stages.find(s => s.id === stageId)?.name || '' }
          : app
      ))
      
      setSelectedAppsForBulk([])
    } catch (error) {
      console.error('Failed to bulk assign workflow:', error)
    }
  }

  const handleSaveAndNext = async () => {
    if (!currentApp || !formId) return
    setIsSaving(true)
    try {
      const totalScore = Object.values(editingScores).reduce((sum, val) => sum + (val || 0), 0)
      
      // Persist to backend
      await workflowsClient.updateReviewData(formId, currentApp.id, {
        scores: editingScores,
        comments: editingComments,
        status: 'in_review'
      })
      
      setApplications(prev => prev.map(app => 
        app.id === currentApp.id
          ? { ...app, scores: editingScores, comments: editingComments, score: totalScore, status: 'in_review' as const }
          : app
      ))
      
      // Move to next or exit review mode
      if (selectedAppIndex < stageApps.length - 1) {
        goToNext()
      } else {
        setIsReviewMode(false)
      }
    } finally {
      setIsSaving(false)
    }
  }

  const handleDecision = async (decision: 'approved' | 'rejected') => {
    if (!currentApp || !formId) return
    
    try {
      // Persist decision to backend
      await workflowsClient.updateReviewData(formId, currentApp.id, {
        decision,
        status: decision
      })
      
      setApplications(prev => prev.map(app => 
        app.id === currentApp.id
          ? { ...app, status: decision }
          : app
      ))
      
      // If approved and there's a next stage, optionally move to it
      if (decision === 'approved') {
        const currentStageIndex = stages.findIndex(s => s.id === currentApp.stageId)
        if (currentStageIndex >= 0 && currentStageIndex < stages.length - 1) {
          const nextStage = stages[currentStageIndex + 1]
          await handleMoveToStage(currentApp.id, nextStage.id, 'Auto-advanced after approval')
        }
      }
      
      goToNext()
    } catch (error) {
      console.error('Failed to save decision:', error)
    }
  }

  const handleSwitchWorkflow = (newWorkflow: ReviewWorkflow) => {
    setWorkflow(newWorkflow)
    setSelectedStageId('all')
    setSelectedAppIndex(0)
    setShowWorkflowSelector(false)
  }

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500">Loading review workspace...</p>
        </div>
      </div>
    )
  }

  if (!workflow || stages.length === 0) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 bg-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="w-10 h-10 text-amber-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-3">No Workflow Configured</h2>
          <p className="text-gray-600 mb-8">
            Set up a review workflow with stages to start reviewing applications.
          </p>
          <Button className="bg-blue-600 hover:bg-blue-700">
            <Zap className="w-4 h-4 mr-2" />
            Configure Workflow
          </Button>
        </div>
      </div>
    )
  }

  // Full-screen review mode
  if (isReviewMode && currentApp) {
    return (
      <FocusReviewMode
        app={currentApp}
        appIndex={selectedAppIndex}
        totalApps={stageApps.length}
        stage={currentStage!}
        rubric={currentRubric}
        scores={editingScores}
        comments={editingComments}
        timer={reviewTimer}
        timerActive={timerActive}
        isSaving={isSaving}
        onScoreChange={(cat, val) => setEditingScores(p => ({ ...p, [cat]: val }))}
        onCommentsChange={setEditingComments}
        onToggleTimer={() => setTimerActive(!timerActive)}
        onSaveAndNext={handleSaveAndNext}
        onDecision={handleDecision}
        onPrev={goToPrev}
        onNext={goToNext}
        onExit={() => {
          setIsReviewMode(false)
          setTimerActive(false)
        }}
      />
    )
  }

  return (
    <div className="h-full flex flex-col bg-gray-50 overflow-hidden">
      {/* Top Bar */}
      <div className="bg-white border-b border-gray-200 px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <h1 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Eye className="w-5 h-5 text-blue-600" />
              Review Center
            </h1>
            
            {/* Workflow Selector */}
            <div className="relative">
              <button
                onClick={() => setShowWorkflowSelector(!showWorkflowSelector)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors"
              >
                <Layers className="w-4 h-4 text-blue-600" />
                <span className="font-medium text-blue-900">{workflow?.name || 'Select Workflow'}</span>
                <Badge className="bg-green-100 text-green-700 border-green-200 text-xs">
                  {workflow?.is_active ? 'Active' : 'Draft'}
                </Badge>
                <ChevronDown className={cn("w-4 h-4 text-blue-600 transition-transform", showWorkflowSelector && "rotate-180")} />
              </button>
              
              {showWorkflowSelector && (
                <div className="absolute top-full left-0 mt-2 w-72 bg-white border border-gray-200 rounded-xl shadow-xl z-50 overflow-hidden">
                  <div className="p-3 border-b border-gray-100 bg-gray-50">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Available Workflows</p>
                  </div>
                  <div className="max-h-64 overflow-y-auto p-2">
                    {workflows.map(wf => (
                      <button
                        key={wf.id}
                        onClick={() => handleSwitchWorkflow(wf)}
                        className={cn(
                          "w-full text-left p-3 rounded-lg flex items-center justify-between hover:bg-gray-50 transition-colors",
                          workflow?.id === wf.id && "bg-blue-50 border border-blue-200"
                        )}
                      >
                        <div>
                          <p className="font-medium text-gray-900">{wf.name}</p>
                          <p className="text-xs text-gray-500">{wf.description || 'No description'}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {wf.is_active && (
                            <Badge className="bg-green-100 text-green-700 border-green-200 text-xs">Active</Badge>
                          )}
                          {workflow?.id === wf.id && (
                            <CheckCircle className="w-4 h-4 text-blue-600" />
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            
            {/* View Mode Tabs */}
            <div className="flex bg-gray-100 rounded-lg p-1">
              {[
                { id: 'queue' as const, icon: Inbox, label: 'Queue' },
                { id: 'focus' as const, icon: Target, label: 'Focus' },
                { id: 'analytics' as const, icon: BarChart3, label: 'Analytics' }
              ].map(mode => (
                <button
                  key={mode.id}
                  onClick={() => setViewMode(mode.id)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all",
                    viewMode === mode.id 
                      ? "bg-white text-blue-600 shadow-sm border border-gray-200" 
                      : "text-gray-500 hover:text-gray-900"
                  )}
                >
                  <mode.icon className="w-4 h-4" />
                  {mode.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search applicants..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 py-2 w-64 bg-white border border-gray-200 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              />
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setShowFilters(!showFilters)} 
              className={cn(
                "text-gray-500 hover:text-gray-900 hover:bg-gray-100",
                showFilters && "bg-blue-50 text-blue-600"
              )}
            >
              <Filter className="w-4 h-4" />
              {(filterStatus !== 'all' || filterTags.length > 0 || filterScoreMin !== null || filterScoreMax !== null || filterReviewed !== 'all') && (
                <span className="ml-1 w-2 h-2 bg-blue-500 rounded-full" />
              )}
            </Button>
            <Button variant="ghost" size="sm" onClick={loadData} className="text-gray-500 hover:text-gray-900 hover:bg-gray-100">
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>
        
        {/* Advanced Filters Panel */}
        {showFilters && (
          <div className="border-b border-gray-200 bg-gray-50 px-6 py-4">
            <div className="flex flex-wrap items-end gap-4">
              {/* Status Filter */}
              <div className="w-40">
                <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm"
                >
                  <option value="all">All Statuses</option>
                  <option value="pending">Pending</option>
                  <option value="in_review">In Review</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>

              {/* Review Status Filter */}
              <div className="w-40">
                <label className="block text-xs font-medium text-gray-500 mb-1">Review Status</label>
                <select
                  value={filterReviewed}
                  onChange={(e) => setFilterReviewed(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm"
                >
                  <option value="all">All</option>
                  <option value="reviewed">Reviewed</option>
                  <option value="unreviewed">Unreviewed</option>
                </select>
              </div>

              {/* Score Range Filter */}
              <div className="flex items-end gap-2">
                <div className="w-24">
                  <label className="block text-xs font-medium text-gray-500 mb-1">Min Score</label>
                  <input
                    type="number"
                    value={filterScoreMin ?? ''}
                    onChange={(e) => setFilterScoreMin(e.target.value ? parseInt(e.target.value) : null)}
                    placeholder="0"
                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm"
                  />
                </div>
                <span className="text-gray-400 pb-2">–</span>
                <div className="w-24">
                  <label className="block text-xs font-medium text-gray-500 mb-1">Max Score</label>
                  <input
                    type="number"
                    value={filterScoreMax ?? ''}
                    onChange={(e) => setFilterScoreMax(e.target.value ? parseInt(e.target.value) : null)}
                    placeholder="100"
                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm"
                  />
                </div>
              </div>

              {/* Tags Filter */}
              {allTags.length > 0 && (
                <div className="flex-1 min-w-48 max-w-md">
                  <label className="block text-xs font-medium text-gray-500 mb-1">Tags</label>
                  <div className="flex flex-wrap gap-1 p-2 bg-white border border-gray-200 rounded-lg min-h-[38px]">
                    {allTags.map(tag => (
                      <button
                        key={tag}
                        onClick={() => {
                          if (filterTags.includes(tag)) {
                            setFilterTags(filterTags.filter(t => t !== tag))
                          } else {
                            setFilterTags([...filterTags, tag])
                          }
                        }}
                        className={cn(
                          "px-2 py-0.5 text-xs rounded-full border transition-all",
                          filterTags.includes(tag)
                            ? "bg-blue-100 text-blue-700 border-blue-200"
                            : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"
                        )}
                      >
                        {tag}
                      </button>
                    ))}
                    {allTags.length === 0 && (
                      <span className="text-xs text-gray-400">No tags available</span>
                    )}
                  </div>
                </div>
              )}

              {/* Clear Filters */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setFilterStatus('all')
                  setFilterReviewed('all')
                  setFilterScoreMin(null)
                  setFilterScoreMax(null)
                  setFilterTags([])
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-4 h-4 mr-1" />
                Clear Filters
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Stages */}
        <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
          <div className="p-4 border-b border-gray-200">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Workflow Stages</h3>
            <p className="text-xs text-gray-400">{workflow.name}</p>
          </div>
          
          <div className="flex-1 overflow-y-auto p-2">
            {/* All Applications Option */}
            <button
              onClick={() => {
                setSelectedStageId('all')
                setSelectedAppIndex(0)
              }}
              className={cn(
                "w-full text-left px-3 py-3 rounded-lg mb-2 transition-all group",
                selectedStageId === 'all' 
                  ? "bg-blue-50 border border-blue-200" 
                  : "hover:bg-gray-50 border border-transparent"
              )}
            >
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center",
                  selectedStageId === 'all' ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-500"
                )}>
                  <Inbox className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={cn(
                    "font-medium",
                    selectedStageId === 'all' ? "text-gray-900" : "text-gray-700"
                  )}>All Applications</p>
                  <p className="text-xs text-gray-400">View all stages</p>
                </div>
                <Badge className="bg-gray-100 text-gray-600 border-gray-200">
                  {stats.total}
                </Badge>
              </div>
            </button>

            {/* Unassigned Applications */}
            {stats.unassigned > 0 && (
              <div className="px-3 py-2 mb-2 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-600" />
                    <span className="text-sm font-medium text-amber-800">Unassigned</span>
                  </div>
                  <Badge className="bg-amber-100 text-amber-700 border-amber-200">
                    {stats.unassigned}
                  </Badge>
                </div>
              </div>
            )}

            <div className="border-t border-gray-100 my-2" />
            
            {stages.map((stage, idx) => {
              const count = applications.filter(a => a.stageId === stage.id).length
              const isActive = stage.id === selectedStageId
              
              return (
                <button
                  key={stage.id}
                  onClick={() => {
                    setSelectedStageId(stage.id)
                    setSelectedAppIndex(0)
                  }}
                  className={cn(
                    "w-full text-left px-3 py-3 rounded-lg mb-1 transition-all group",
                    isActive 
                      ? "bg-blue-50 border border-blue-200" 
                      : "hover:bg-gray-50"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold",
                      isActive ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-500"
                    )}>
                      {idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn(
                        "font-medium truncate",
                        isActive ? "text-gray-900" : "text-gray-700"
                      )}>{stage.name}</p>
                      <p className="text-xs text-gray-400">{stage.stage_type}</p>
                    </div>
                    <Badge className={cn(
                      "ml-auto",
                      count > 0 
                        ? "bg-blue-100 text-blue-700 border-blue-200" 
                        : "bg-gray-100 text-gray-400"
                    )}>
                      {count}
                    </Badge>
                  </div>
                  
                  {stage.rubric && (
                    <div className="mt-2 ml-11 flex items-center gap-1 text-xs text-gray-400">
                      <Award className="w-3 h-3" />
                      {stage.rubric.name}
                    </div>
                  )}
                </button>
              )
            })}
          </div>

          {/* Quick Stats */}
          <div className="p-4 border-t border-gray-200 space-y-3">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Overview</h3>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-gray-50 rounded-lg p-2 text-center">
                <p className="text-lg font-bold text-amber-600">{stats.pending}</p>
                <p className="text-xs text-gray-500">Pending</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-2 text-center">
                <p className="text-lg font-bold text-blue-600">{stats.inReview}</p>
                <p className="text-xs text-gray-500">In Review</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-2 text-center">
                <p className="text-lg font-bold text-green-600">{stats.approved}</p>
                <p className="text-xs text-gray-500">Approved</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-2 text-center">
                <p className="text-lg font-bold text-red-600">{stats.rejected}</p>
                <p className="text-xs text-gray-500">Rejected</p>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {viewMode === 'queue' && (
            <QueueView
              apps={stageApps}
              selectedIndex={selectedAppIndex}
              onSelect={(idx) => setSelectedAppIndex(idx)}
              onStartReview={startReview}
              currentApp={currentApp}
              stage={currentStage || undefined}
              rubric={currentRubric}
            />
          )}
          
          {viewMode === 'focus' && (
            <div className="flex-1 flex items-center justify-center bg-gray-50">
              {stageApps.length > 0 ? (
                <div className="text-center">
                  <div className="w-20 h-20 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
                    <Target className="w-10 h-10 text-blue-600" />
                  </div>
                  <h2 className="text-xl font-bold text-gray-900 mb-2">Focus Mode</h2>
                  <p className="text-gray-500 mb-6 max-w-sm">
                    Review applications one by one without distractions. Timer tracks your review time.
                  </p>
                  <Button onClick={startReview} className="bg-blue-600 hover:bg-blue-700">
                    <Play className="w-4 h-4 mr-2" />
                    Start Reviewing ({stageApps.length} applications)
                  </Button>
                </div>
              ) : (
                <div className="text-center">
                  <div className="w-20 h-20 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
                    <CheckCircle className="w-10 h-10 text-green-600" />
                  </div>
                  <h2 className="text-xl font-bold text-gray-900 mb-2">All Clear!</h2>
                  <p className="text-gray-500">No applications in this stage to review.</p>
                </div>
              )}
            </div>
          )}

          {viewMode === 'analytics' && (
            <AnalyticsView stats={stats} stages={stages} applications={applications} />
          )}
        </div>
      </div>
    </div>
  )
}

// Queue View - List of applications with preview
function QueueView({
  apps,
  selectedIndex,
  onSelect,
  onStartReview,
  currentApp,
  stage,
  rubric
}: {
  apps: ApplicationData[]
  selectedIndex: number
  onSelect: (idx: number) => void
  onStartReview: () => void
  currentApp: ApplicationData | null
  stage?: StageWithConfig
  rubric: Rubric | null
}) {
  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Application List */}
      <div className="w-96 border-r border-gray-200 flex flex-col bg-white">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="font-medium text-gray-900">{apps.length} Applications</h3>
          <select className="bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-700">
            <option>Most Recent</option>
            <option>Oldest First</option>
            <option>Highest Score</option>
          </select>
        </div>
        
        <div className="flex-1 overflow-y-auto">
          {apps.map((app, idx) => (
            <button
              key={app.id}
              onClick={() => onSelect(idx)}
              className={cn(
                "w-full text-left px-4 py-4 border-b border-gray-100 transition-all",
                idx === selectedIndex 
                  ? "bg-blue-50 border-l-2 border-l-blue-600" 
                  : "hover:bg-gray-50"
              )}
            >
              <div className="flex items-start gap-3">
                <div className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0",
                  app.status === 'approved' ? "bg-green-100 text-green-700" :
                  app.status === 'rejected' ? "bg-red-100 text-red-700" :
                  app.status === 'in_review' ? "bg-blue-100 text-blue-700" :
                  "bg-gray-100 text-gray-600"
                )}>
                  {app.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-gray-900 truncate">{app.name}</p>
                    {app.flagged && <Flag className="w-3 h-3 text-red-500 shrink-0" />}
                  </div>
                  <p className="text-xs text-gray-500 truncate">{app.email}</p>
                  <div className="flex items-center gap-2 mt-2">
                    {app.stageName && (
                      <Badge className="bg-purple-100 text-purple-700 border-purple-200 text-xs">
                        {app.stageName}
                      </Badge>
                    )}
                    {app.score !== null && (
                      <span className="flex items-center gap-1 text-xs text-amber-600">
                        <Star className="w-3 h-3 fill-current" />
                        {app.score}/{app.maxScore}
                      </span>
                    )}
                    <span className="flex items-center gap-1 text-xs text-gray-400">
                      <Users className="w-3 h-3" />
                      {app.reviewCount}/{app.requiredReviews}
                    </span>
                  </div>
                </div>
              </div>
            </button>
          ))}
          
          {apps.length === 0 && (
            <div className="p-8 text-center">
              <Inbox className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No applications in this stage</p>
            </div>
          )}
        </div>
      </div>

      {/* Preview Panel */}
      <div className="flex-1 flex flex-col bg-gray-50">
        {currentApp ? (
          <>
            <div className="p-6 border-b border-gray-200 bg-white">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">{currentApp.name}</h2>
                  <p className="text-gray-500">{currentApp.email}</p>
                </div>
                <Button onClick={onStartReview} className="bg-blue-600 hover:bg-blue-700">
                  <Play className="w-4 h-4 mr-2" />
                  Start Review
                </Button>
              </div>
              
              {/* Status & Score */}
              <div className="flex items-center gap-4 mt-4">
                <Badge className={cn(
                  "capitalize",
                  currentApp.status === 'approved' && "bg-green-100 text-green-700 border-green-200",
                  currentApp.status === 'rejected' && "bg-red-100 text-red-700 border-red-200",
                  currentApp.status === 'in_review' && "bg-blue-100 text-blue-700 border-blue-200",
                  currentApp.status === 'pending' && "bg-amber-100 text-amber-700 border-amber-200"
                )}>
                  {currentApp.status.replace('_', ' ')}
                </Badge>
                
                {currentApp.score !== null && (
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-blue-500 to-blue-600"
                        style={{ width: `${(currentApp.score / currentApp.maxScore) * 100}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium text-gray-900">{currentApp.score}/{currentApp.maxScore}</span>
                  </div>
                )}
                
                <span className="text-sm text-gray-500 flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  Submitted {new Date(currentApp.submittedAt).toLocaleDateString()}
                </span>
              </div>
            </div>

            {/* Application Data Preview */}
            <div className="flex-1 overflow-y-auto p-6">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Application Data</h3>
              <div className="grid grid-cols-2 gap-4">
                {Object.entries(currentApp.raw_data).slice(0, 8).map(([key, value]) => {
                  if (typeof value === 'object') return null
                  return (
                    <div key={key} className="bg-white rounded-lg p-4 border border-gray-200">
                      <p className="text-xs font-medium text-gray-400 uppercase mb-1">{key}</p>
                      <p className="text-gray-900 truncate">{String(value)}</p>
                    </div>
                  )
                })}
              </div>
              
              {rubric && (
                <div className="mt-8">
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Scoring Rubric</h3>
                  <div className="bg-white rounded-lg p-4 border border-gray-200">
                    <p className="font-medium text-gray-900 mb-2">{rubric.name}</p>
                    <p className="text-sm text-gray-500 mb-3">{rubric.description}</p>
                    <div className="flex items-center gap-2">
                      <Award className="w-4 h-4 text-blue-600" />
                      <span className="text-sm text-gray-700">Max Score: {rubric.max_score}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <Eye className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">Select an application to preview</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// Focus Review Mode - Full screen immersive review
function FocusReviewMode({
  app,
  appIndex,
  totalApps,
  stage,
  rubric,
  scores,
  comments,
  timer,
  timerActive,
  isSaving,
  onScoreChange,
  onCommentsChange,
  onToggleTimer,
  onSaveAndNext,
  onDecision,
  onPrev,
  onNext,
  onExit
}: {
  app: ApplicationData
  appIndex: number
  totalApps: number
  stage: StageWithConfig
  rubric: Rubric | null
  scores: Record<string, number>
  comments: string
  timer: number
  timerActive: boolean
  isSaving: boolean
  onScoreChange: (cat: string, val: number) => void
  onCommentsChange: (c: string) => void
  onToggleTimer: () => void
  onSaveAndNext: () => void
  onDecision: (d: 'approved' | 'rejected') => void
  onPrev: () => void
  onNext: () => void
  onExit: () => void
}) {
  const totalScore = Object.values(scores).reduce((sum, val) => sum + (val || 0), 0)
  const maxScore = rubric?.max_score || 100
  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`

  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col">
      {/* Top Bar */}
      <div className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6">
        <div className="flex items-center gap-4">
          <button onClick={onExit} className="text-gray-500 hover:text-gray-900 transition-colors">
            <X className="w-5 h-5" />
          </button>
          <div className="h-6 w-px bg-gray-200" />
          <span className="text-gray-500 text-sm">
            Reviewing <span className="text-gray-900 font-medium">{appIndex + 1}</span> of <span className="text-gray-900">{totalApps}</span>
          </span>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-1.5">
            <button onClick={onToggleTimer} className="text-gray-500 hover:text-gray-900">
              {timerActive ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </button>
            <span className="text-gray-900 font-mono text-sm min-w-[50px]">{formatTime(timer)}</span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={onPrev}
              disabled={appIndex === 0}
              className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={onNext}
              disabled={appIndex === totalApps - 1}
              className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left - Application Data */}
        <div className="w-1/2 border-r border-gray-200 overflow-y-auto bg-gray-50">
          <div className="p-8">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 mb-1">{app.name}</h1>
                <p className="text-gray-500">{app.email}</p>
              </div>
              {app.flagged && (
                <Badge className="bg-red-100 text-red-700 border-red-200">
                  <Flag className="w-3 h-3 mr-1" />
                  Flagged
                </Badge>
              )}
            </div>

            <div className="space-y-6">
              {Object.entries(app.raw_data).map(([key, value]) => {
                if (typeof value === 'object') return null
                const strValue = String(value)
                const isLongText = strValue.length > 100
                
                return (
                  <div key={key} className="border-b border-gray-200 pb-4">
                    <p className="text-xs font-semibold text-blue-600 uppercase tracking-wider mb-2">{key}</p>
                    <p className={cn(
                      "text-gray-700",
                      isLongText && "text-sm leading-relaxed"
                    )}>{strValue}</p>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Right - Scoring */}
        <div className="w-1/2 flex flex-col bg-white">
          <div className="p-8 flex-1 overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-gray-900">Score Application</h2>
              <Badge className="bg-blue-100 text-blue-700 border-blue-200">
                {stage.name}
              </Badge>
            </div>

            {/* Total Score */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 mb-8 border border-blue-100">
              <div className="flex items-center justify-between mb-4">
                <span className="text-gray-600">Total Score</span>
                <span className="text-3xl font-bold text-gray-900">
                  {totalScore}<span className="text-lg text-gray-400">/{maxScore}</span>
                </span>
              </div>
              <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-300"
                  style={{ width: `${(totalScore / maxScore) * 100}%` }}
                />
              </div>
            </div>

            {/* Rubric Categories */}
            {rubric && Array.isArray(rubric.categories) ? (
              <div className="space-y-6">
                {rubric.categories.map((cat: any) => (
                  <div key={cat.id} className="bg-gray-50 rounded-xl p-5 border border-gray-200">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-semibold text-gray-900">{cat.name}</h3>
                        {cat.description && (
                          <p className="text-sm text-gray-500 mt-1">{cat.description}</p>
                        )}
                      </div>
                      <span className="font-bold text-gray-900 text-lg">
                        {scores[cat.id] || 0}<span className="text-gray-400">/{cat.points}</span>
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max={cat.points}
                      value={scores[cat.id] || 0}
                      onChange={(e) => onScoreChange(cat.id, parseInt(e.target.value))}
                      className="w-full h-2 bg-gray-200 rounded-full appearance-none cursor-pointer accent-blue-600"
                    />
                    <div className="flex justify-between text-xs text-gray-400 mt-1">
                      <span>0</span>
                      <span>{cat.points}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 bg-gray-50 rounded-xl border border-gray-200">
                <Award className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No rubric configured for this stage</p>
              </div>
            )}

            {/* Comments */}
            <div className="mt-8">
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                <MessageSquare className="w-4 h-4 inline mr-2" />
                Review Notes
              </label>
              <textarea
                value={comments}
                onChange={(e) => onCommentsChange(e.target.value)}
                placeholder="Add your notes about this application..."
                rows={4}
                className="w-full p-4 bg-white border border-gray-200 rounded-xl text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-none"
              />
            </div>
          </div>

          {/* Action Footer */}
          <div className="p-6 bg-gray-50 border-t border-gray-200">
            <div className="flex items-center gap-3">
              <Button 
                variant="outline" 
                onClick={() => onDecision('rejected')}
                className="flex-1 border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300"
              >
                <ThumbsDown className="w-4 h-4 mr-2" />
                Reject
              </Button>
              <Button 
                onClick={onSaveAndNext}
                disabled={isSaving}
                className="flex-1 bg-blue-600 hover:bg-blue-700"
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                Save & Next
              </Button>
              <Button 
                onClick={() => onDecision('approved')}
                className="flex-1 bg-green-600 hover:bg-green-700"
              >
                <ThumbsUp className="w-4 h-4 mr-2" />
                Approve
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Analytics View
function AnalyticsView({ 
  stats, 
  stages, 
  applications 
}: { 
  stats: { pending: number; inReview: number; approved: number; rejected: number; avgScore: number; total: number }
  stages: StageWithConfig[]
  applications: ApplicationData[]
}) {
  // Calculate score distribution buckets (0-20, 20-40, 40-60, 60-80, 80-100)
  const scoredApps = applications.filter(a => a.score !== null)
  const scoreDistribution = useMemo(() => {
    const buckets = [
      { label: '0-20%', min: 0, max: 20, count: 0, color: 'bg-red-500' },
      { label: '20-40%', min: 20, max: 40, count: 0, color: 'bg-orange-500' },
      { label: '40-60%', min: 40, max: 60, count: 0, color: 'bg-yellow-500' },
      { label: '60-80%', min: 60, max: 80, count: 0, color: 'bg-blue-500' },
      { label: '80-100%', min: 80, max: 100, count: 0, color: 'bg-green-500' },
    ]
    
    scoredApps.forEach(app => {
      const percentage = (app.score || 0) / (app.maxScore || 100) * 100
      for (const bucket of buckets) {
        if (percentage >= bucket.min && percentage < bucket.max + (bucket.max === 100 ? 1 : 0)) {
          bucket.count++
          break
        }
      }
    })
    
    return buckets
  }, [scoredApps])

  // Calculate average scores per rubric category
  const categoryScores = useMemo(() => {
    const categoryMap: Record<string, { name: string; total: number; count: number; maxPoints: number }> = {}
    
    applications.forEach(app => {
      if (app.scores && Object.keys(app.scores).length > 0) {
        Object.entries(app.scores).forEach(([catId, score]) => {
          if (!categoryMap[catId]) {
            // Try to find category name from stage rubrics
            let catName = catId
            let maxPts = 100
            for (const stage of stages) {
              if (stage.rubric?.categories) {
                const categories = typeof stage.rubric.categories === 'string' 
                  ? JSON.parse(stage.rubric.categories) 
                  : stage.rubric.categories
                const cat = (categories as any[]).find((c: any) => c.id === catId)
                if (cat) {
                  catName = cat.name || cat.category || catId
                  maxPts = cat.maxPoints || cat.max_points || cat.max || 100
                  break
                }
              }
            }
            categoryMap[catId] = { name: catName, total: 0, count: 0, maxPoints: maxPts }
          }
          categoryMap[catId].total += score as number
          categoryMap[catId].count++
        })
      }
    })
    
    return Object.entries(categoryMap).map(([id, data]) => ({
      id,
      name: data.name,
      avgScore: data.count > 0 ? Math.round(data.total / data.count * 10) / 10 : 0,
      maxPoints: data.maxPoints,
      percentage: data.count > 0 ? Math.round((data.total / data.count) / data.maxPoints * 100) : 0
    }))
  }, [applications, stages])

  // Calculate reviewer performance metrics
  const reviewerMetrics = useMemo(() => {
    const reviewerMap: Record<string, { 
      id: string; 
      name: string; 
      completedCount: number; 
      totalScore: number;
      scores: number[];
      avgScore: number;
      variance: number;
      lastActive?: string;
    }> = {}
    
    applications.forEach(app => {
      const metadata = app.raw_data
      // We need to access review_history which is in the original metadata
      // For now, use assigned reviewers count
      app.assignedReviewers.forEach(reviewerId => {
        if (!reviewerMap[reviewerId]) {
          reviewerMap[reviewerId] = { 
            id: reviewerId, 
            name: `Reviewer ${reviewerId.substring(0, 4)}`,
            completedCount: 0, 
            totalScore: 0,
            scores: [],
            avgScore: 0,
            variance: 0
          }
        }
        if (app.reviewCount > 0) {
          reviewerMap[reviewerId].completedCount++
        }
      })
    })
    
    // Calculate stats for each reviewer
    Object.values(reviewerMap).forEach(reviewer => {
      if (reviewer.scores.length > 0) {
        reviewer.avgScore = Math.round(reviewer.scores.reduce((a, b) => a + b, 0) / reviewer.scores.length)
        const mean = reviewer.avgScore
        reviewer.variance = Math.round(
          reviewer.scores.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / reviewer.scores.length
        )
      }
    })
    
    return Object.values(reviewerMap).sort((a, b) => b.completedCount - a.completedCount)
  }, [applications])

  // Tags distribution
  const tagDistribution = useMemo(() => {
    const tagMap: Record<string, number> = {}
    applications.forEach(app => {
      app.tags.forEach(tag => {
        tagMap[tag] = (tagMap[tag] || 0) + 1
      })
    })
    return Object.entries(tagMap)
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
  }, [applications])

  const maxDistributionCount = Math.max(...scoreDistribution.map(b => b.count), 1)

  return (
    <div className="flex-1 overflow-y-auto p-8 bg-gray-50">
      <h2 className="text-xl font-bold text-gray-900 mb-6">Review Analytics</h2>
      
      {/* Overview Cards */}
      <div className="grid grid-cols-5 gap-4 mb-8">
        <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
              <FileText className="w-5 h-5 text-gray-500" />
            </div>
            <span className="text-gray-500 text-sm">Total</span>
          </div>
          <p className="text-3xl font-bold text-gray-900">{applications.length}</p>
        </div>
        
        <div className="bg-amber-50 rounded-xl p-5 border border-amber-200">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
              <Clock className="w-5 h-5 text-amber-600" />
            </div>
            <span className="text-amber-700 text-sm">Pending</span>
          </div>
          <p className="text-3xl font-bold text-amber-600">{stats.pending}</p>
        </div>
        
        <div className="bg-blue-50 rounded-xl p-5 border border-blue-200">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Eye className="w-5 h-5 text-blue-600" />
            </div>
            <span className="text-blue-700 text-sm">In Review</span>
          </div>
          <p className="text-3xl font-bold text-blue-600">{stats.inReview}</p>
        </div>
        
        <div className="bg-green-50 rounded-xl p-5 border border-green-200">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <ThumbsUp className="w-5 h-5 text-green-600" />
            </div>
            <span className="text-green-700 text-sm">Approved</span>
          </div>
          <p className="text-3xl font-bold text-green-600">{stats.approved}</p>
        </div>
        
        <div className="bg-red-50 rounded-xl p-5 border border-red-200">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
              <ThumbsDown className="w-5 h-5 text-red-600" />
            </div>
            <span className="text-red-700 text-sm">Rejected</span>
          </div>
          <p className="text-3xl font-bold text-red-600">{stats.rejected}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-8 mb-8">
        {/* Score Distribution Chart */}
        <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Score Distribution</h3>
            <span className="text-sm text-gray-500">{scoredApps.length} scored</span>
          </div>
          <div className="space-y-3">
            {scoreDistribution.map((bucket) => (
              <div key={bucket.label} className="flex items-center gap-3">
                <span className="w-16 text-sm text-gray-600">{bucket.label}</span>
                <div className="flex-1 h-8 bg-gray-100 rounded-lg overflow-hidden">
                  <div 
                    className={cn("h-full transition-all flex items-center justify-end pr-2", bucket.color)}
                    style={{ width: `${Math.max((bucket.count / maxDistributionCount) * 100, bucket.count > 0 ? 10 : 0)}%` }}
                  >
                    {bucket.count > 0 && (
                      <span className="text-xs font-bold text-white">{bucket.count}</span>
                    )}
                  </div>
                </div>
                <span className="w-8 text-right text-sm font-medium text-gray-700">{bucket.count}</span>
              </div>
            ))}
          </div>
          {scoredApps.length === 0 && (
            <p className="text-gray-500 text-center py-4">No scored applications yet</p>
          )}
        </div>

        {/* Average Scores by Category */}
        <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">Average Scores by Category</h3>
          <div className="space-y-4">
            {categoryScores.length > 0 ? categoryScores.map((cat) => (
              <div key={cat.id}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-gray-700">{cat.name}</span>
                  <span className="text-sm font-medium text-gray-900">{cat.avgScore}/{cat.maxPoints}</span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    className={cn(
                      "h-full rounded-full transition-all",
                      cat.percentage >= 80 ? "bg-green-500" :
                      cat.percentage >= 60 ? "bg-blue-500" :
                      cat.percentage >= 40 ? "bg-yellow-500" :
                      "bg-red-500"
                    )}
                    style={{ width: `${cat.percentage}%` }}
                  />
                </div>
              </div>
            )) : (
              <p className="text-gray-500 text-center py-4">No category scores yet</p>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-8 mb-8">
        {/* Stage Distribution */}
        <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">Stage Distribution</h3>
          <div className="space-y-4">
            {stages.map((stage, idx) => {
              const count = applications.filter(a => a.stageId === stage.id).length
              const percentage = applications.length > 0 ? (count / applications.length) * 100 : 0
              
              return (
                <div key={stage.id}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 bg-blue-600 rounded flex items-center justify-center text-xs font-bold text-white">
                        {idx + 1}
                      </span>
                      <span className="text-gray-700">{stage.name}</span>
                    </div>
                    <span className="text-gray-900 font-medium">{count}</span>
                  </div>
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Tags Distribution */}
        <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">Top Tags</h3>
          {tagDistribution.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {tagDistribution.map(({ tag, count }) => (
                <Badge 
                  key={tag} 
                  className="bg-purple-100 text-purple-700 border-purple-200 px-3 py-1.5"
                >
                  {tag} <span className="ml-1 font-bold">{count}</span>
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-4">No tags assigned yet</p>
          )}
        </div>
      </div>

      {/* Reviewer Performance */}
      <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm mb-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-6">Reviewer Activity</h3>
        {reviewerMetrics.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Reviewer</th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-gray-500">Assigned</th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-gray-500">Completed</th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-gray-500">Avg Score</th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-gray-500">Variance</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">Completion Rate</th>
                </tr>
              </thead>
              <tbody>
                {reviewerMetrics.slice(0, 10).map((reviewer) => {
                  const assignedCount = applications.filter(a => 
                    a.assignedReviewers.includes(reviewer.id)
                  ).length
                  const completionRate = assignedCount > 0 
                    ? Math.round((reviewer.completedCount / assignedCount) * 100) 
                    : 0
                  
                  return (
                    <tr key={reviewer.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                            <User className="w-4 h-4 text-blue-600" />
                          </div>
                          <span className="text-gray-900 font-medium">{reviewer.name}</span>
                        </div>
                      </td>
                      <td className="text-center py-3 px-4 text-gray-600">{assignedCount}</td>
                      <td className="text-center py-3 px-4 text-gray-900 font-medium">{reviewer.completedCount}</td>
                      <td className="text-center py-3 px-4">
                        {reviewer.avgScore > 0 ? (
                          <span className="text-amber-600 font-medium">{reviewer.avgScore}</span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="text-center py-3 px-4">
                        {reviewer.variance > 0 ? (
                          <span className="text-gray-600">±{Math.sqrt(reviewer.variance).toFixed(1)}</span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="text-right py-3 px-4">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div 
                              className={cn(
                                "h-full rounded-full",
                                completionRate >= 80 ? "bg-green-500" :
                                completionRate >= 50 ? "bg-blue-500" :
                                "bg-amber-500"
                              )}
                              style={{ width: `${completionRate}%` }}
                            />
                          </div>
                          <span className="text-sm font-medium text-gray-900 w-10 text-right">{completionRate}%</span>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-500 text-center py-4">No reviewer activity yet</p>
        )}
      </div>

      {/* Average Score Card */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-100">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">Average Score</h3>
            <p className="text-gray-500 text-sm">Across all reviewed applications</p>
          </div>
          <div className="flex items-center gap-3">
            <Star className="w-8 h-8 text-amber-500 fill-amber-500" />
            <span className="text-4xl font-bold text-gray-900">{stats.avgScore}</span>
          </div>
        </div>
      </div>
    </div>
  )
}