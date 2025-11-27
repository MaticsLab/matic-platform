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
  const [workflow, setWorkflow] = useState<ReviewWorkflow | null>(null)
  const [stages, setStages] = useState<StageWithConfig[]>([])
  const [applications, setApplications] = useState<ApplicationData[]>([])
  const [reviewerTypes, setReviewerTypes] = useState<ReviewerType[]>([])
  const [rubrics, setRubrics] = useState<Rubric[]>([])
  
  // UI state - completely different approach
  const [viewMode, setViewMode] = useState<ViewMode>('queue')
  const [selectedStageId, setSelectedStageId] = useState<string>('')
  const [selectedAppIndex, setSelectedAppIndex] = useState(0)
  const [isReviewMode, setIsReviewMode] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [filterStatus, setFilterStatus] = useState<string>('all')
  
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

  const loadData = async () => {
    setIsLoading(true)
    try {
      const form = await goClient.get<Form>(`/forms/${formId}`)
      const settings = form.settings || {}
      const workflowId = settings.workflow_id

      const [workflows, allRubrics, allReviewerTypes] = await Promise.all([
        workflowsClient.listWorkflows(workspaceId),
        workflowsClient.listRubrics(workspaceId),
        workflowsClient.listReviewerTypes(workspaceId)
      ])
      
      setRubrics(allRubrics)
      setReviewerTypes(allReviewerTypes)

      let activeWorkflow = workflowId 
        ? workflows.find(w => w.id === workflowId) 
        : workflows.find(w => w.is_active) || workflows[0]
      
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
        const reviewData = (sub as any).review_data || {}
        
        const name = data['Full Name'] || data['name'] || data['Name'] || 
                    `${data['First Name'] || ''} ${data['Last Name'] || ''}`.trim() ||
                    `Applicant ${sub.id.substring(0, 6)}`
        
        const email = data['Email'] || data['email'] || ''
        const stageId = reviewData.stage_id || (loadedStages.length > 0 ? loadedStages[0].id : '')
        const stage = loadedStages.find(s => s.id === stageId)
        
        return {
          id: sub.id,
          name,
          email,
          submittedAt: sub.submitted_at,
          stageId,
          stageName: stage?.name || 'Unassigned',
          status: reviewData.status || 'pending',
          score: reviewData.total_score || null,
          maxScore: stage?.rubric?.max_score || 100,
          reviewCount: reviewData.review_count || 0,
          requiredReviews: stage?.reviewerConfigs?.[0]?.min_reviews_required || 1,
          assignedReviewers: reviewData.assigned_reviewers || [],
          tags: reviewData.tags || [],
          raw_data: data,
          scores: reviewData.scores || {},
          comments: reviewData.comments || '',
          flagged: reviewData.flagged || false
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
  const stageApps = useMemo(() => {
    return applications.filter(app => {
      const matchesStage = app.stageId === selectedStageId
      const matchesSearch = !searchQuery || 
        app.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        app.email.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesStatus = filterStatus === 'all' || app.status === filterStatus
      return matchesStage && matchesSearch && matchesStatus
    })
  }, [applications, selectedStageId, searchQuery, filterStatus])

  // Current application
  const currentApp = stageApps[selectedAppIndex] || null
  const currentStage = stages.find(s => s.id === selectedStageId)
  const currentRubric = currentStage?.rubric || null

  // Stats
  const stats = useMemo(() => {
    const pending = applications.filter(a => a.status === 'pending').length
    const inReview = applications.filter(a => a.status === 'in_review').length
    const approved = applications.filter(a => a.status === 'approved').length
    const rejected = applications.filter(a => a.status === 'rejected').length
    const avgScore = applications.filter(a => a.score !== null).reduce((acc, a) => acc + (a.score || 0), 0) / 
                     Math.max(applications.filter(a => a.score !== null).length, 1)
    return { pending, inReview, approved, rejected, avgScore: Math.round(avgScore) }
  }, [applications])

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

  const handleMoveToStage = async (appId: string, newStageId: string) => {
    setApplications(prev => prev.map(app => 
      app.id === appId 
        ? { ...app, stageId: newStageId, stageName: stages.find(s => s.id === newStageId)?.name || '' }
        : app
    ))
    
    setStages(prev => prev.map(stage => ({
      ...stage,
      applicationCount: applications.filter(a => 
        a.id === appId ? newStageId === stage.id : a.stageId === stage.id
      ).length
    })))
  }

  const handleSaveAndNext = async () => {
    if (!currentApp) return
    setIsSaving(true)
    try {
      const totalScore = Object.values(editingScores).reduce((sum, val) => sum + (val || 0), 0)
      
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
    if (!currentApp) return
    
    setApplications(prev => prev.map(app => 
      app.id === currentApp.id
        ? { ...app, status: decision }
        : app
    ))
    
    goToNext()
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
            <Button variant="ghost" size="sm" onClick={loadData} className="text-gray-500 hover:text-gray-900 hover:bg-gray-100">
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Stages */}
        <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
          <div className="p-4 border-b border-gray-200">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Workflow Stages</h3>
            <p className="text-xs text-gray-400">{workflow.name}</p>
          </div>
          
          <div className="flex-1 overflow-y-auto p-2">
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
              stage={currentStage}
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
                  <div className="flex items-center gap-3 mt-2">
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
                    <span className="text-xs text-gray-400">
                      {new Date(app.submittedAt).toLocaleDateString()}
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
  stats: { pending: number; inReview: number; approved: number; rejected: number; avgScore: number }
  stages: StageWithConfig[]
  applications: ApplicationData[]
}) {
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

      {/* Stage Distribution */}
      <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm mb-8">
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

      {/* Average Score */}
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