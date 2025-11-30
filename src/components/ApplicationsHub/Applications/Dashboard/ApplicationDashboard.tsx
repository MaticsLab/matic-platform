'use client'

import { useState, useEffect, useMemo } from 'react'
import { 
  BarChart3, Users, FileText, Clock, Eye, ThumbsUp, ThumbsDown, 
  Star, User, Loader2, TrendingUp, TrendingDown, AlertTriangle,
  Sparkles, Brain, Target, Zap, ChevronRight, ArrowRight, 
  CheckCircle2, XCircle, Timer, Award, Lightbulb, BarChart2,
  PieChart, Activity, Filter, RefreshCw
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/ui-components/badge'
import { Button } from '@/ui-components/button'
import { Progress } from '@/ui-components/progress'
import { goClient } from '@/lib/api/go-client'
import { workflowsClient } from '@/lib/api/workflows-client'
import { FormSubmission, Form } from '@/types/forms'

interface ApplicationDashboardProps {
  workspaceId: string
  formId: string | null
}

interface StageData {
  id: string
  name: string
  position: number
  rubric?: any
}

interface ApplicationData {
  id: string
  name: string
  stageId: string | null
  status: string
  score: number | null
  maxScore: number
  scores: Record<string, number>
  reviewCount: number
  assignedReviewers: string[]
  tags: string[]
  submittedAt: string
  raw_data: any
}

interface StageMetrics {
  id: string
  name: string
  position: number
  count: number
  avgScore: number
  minScore: number
  maxScore: number
  passRate: number
  avgReviewTime: number
  bottleneck: boolean
}

export function ApplicationDashboard({ workspaceId, formId }: ApplicationDashboardProps) {
  const [submissions, setSubmissions] = useState<FormSubmission[]>([])
  const [applications, setApplications] = useState<ApplicationData[]>([])
  const [stages, setStages] = useState<StageData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [formSettings, setFormSettings] = useState<any>({})
  const [showAIInsights, setShowAIInsights] = useState(true)
  const [reviewersMap, setReviewersMap] = useState<Record<string, { name: string; email: string }>>({})

  useEffect(() => {
    const fetchData = async () => {
      if (!formId) return
      try {
        setIsLoading(true)
        
        // Fetch form
        const form = await goClient.get<Form>(`/forms/${formId}`)
        setFormSettings(form.settings || {})
        
        // Build reviewers map from form settings
        const reviewers = (form.settings?.reviewers as any[]) || []
        const rMap: Record<string, { name: string; email: string }> = {}
        reviewers.forEach((r: any) => {
          if (r.id) {
            rMap[r.id] = { 
              name: r.name || r.email?.split('@')[0] || 'Unknown Reviewer',
              email: r.email || ''
            }
          }
        })
        setReviewersMap(rMap)
        
        // Fetch submissions
        const data = await goClient.get<FormSubmission[]>(`/forms/${formId}/submissions`)
        setSubmissions(data || [])
        
        // Transform submissions to application data
        const apps: ApplicationData[] = (data || []).map(sub => {
          const metadata = sub.metadata || {}
          return {
            id: sub.id,
            name: sub.data?.['Full Name'] || sub.data?.studentName || 'Unknown',
            stageId: metadata.current_stage_id || null,
            status: sub.status,
            score: metadata.total_score || null,
            maxScore: metadata.max_score || 100,
            scores: metadata.scores || {},
            reviewCount: metadata.review_count || 0,
            assignedReviewers: metadata.assigned_reviewers || [],
            tags: metadata.tags || [],
            submittedAt: sub.submitted_at,
            raw_data: sub.data
          }
        })
        setApplications(apps)
        
        // Fetch workflow stages
        try {
          const workflows = await workflowsClient.listWorkflows(form.workspace_id || workspaceId)
          if (workflows && workflows.length > 0) {
            const stagesData = await workflowsClient.listStages(form.workspace_id || workspaceId, workflows[0].id)
            setStages(stagesData.map((s: any) => ({
              id: s.id,
              name: s.name,
              position: s.position,
              rubric: s.rubric
            })))
          }
        } catch (e) {
          console.log('No workflows found')
        }
        
      } catch (error) {
        console.error('Failed to fetch data:', error)
      } finally {
        setIsLoading(false)
      }
    }
    fetchData()
  }, [formId, workspaceId])

  // Calculate stats
  const stats = useMemo(() => {
    const pending = applications.filter(a => a.status === 'submitted' || a.status === 'pending').length
    const inReview = applications.filter(a => a.status === 'in_review' || a.reviewCount > 0).length
    const approved = applications.filter(a => a.status === 'approved').length
    const rejected = applications.filter(a => a.status === 'rejected').length
    
    const scoredApps = applications.filter(a => a.score !== null)
    const avgScore = scoredApps.length > 0 
      ? Math.round(scoredApps.reduce((sum, a) => sum + (a.score || 0), 0) / scoredApps.length)
      : 0
    
    return { pending, inReview, approved, rejected, avgScore, total: applications.length }
  }, [applications])

  // Score distribution buckets
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

  // Category scores
  const categoryScores = useMemo(() => {
    const categoryMap: Record<string, { name: string; total: number; count: number; maxPoints: number }> = {}
    
    applications.forEach(app => {
      if (app.scores && Object.keys(app.scores).length > 0) {
        Object.entries(app.scores).forEach(([catId, score]) => {
          if (!categoryMap[catId]) {
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

  // Reviewer metrics - also check formSettings directly as backup
  const reviewerMetrics = useMemo(() => {
    // Build a local map from formSettings as backup (for name lookups)
    const localReviewersMap: Record<string, { name: string; email: string }> = { ...reviewersMap }
    const settingsReviewers = (formSettings?.reviewers as any[]) || []
    
    // Build set of active (non-removed) reviewer IDs
    const activeReviewerIds = new Set(
      settingsReviewers
        .filter((r: any) => !r.removed)
        .map((r: any) => r.id)
    )
    
    settingsReviewers.forEach((r: any) => {
      if (r.id && !localReviewersMap[r.id]) {
        localReviewersMap[r.id] = {
          name: r.name || r.email?.split('@')[0] || 'Unknown',
          email: r.email || ''
        }
      }
    })

    const reviewerData: Record<string, { 
      id: string; 
      name: string; 
      email: string;
      completedCount: number; 
      assignedCount: number;
      avgScore: number;
      scores: number[];
      variance: number;
    }> = {}
    
    applications.forEach(app => {
      app.assignedReviewers.forEach(reviewerId => {
        // Skip removed reviewers
        if (!activeReviewerIds.has(reviewerId)) return
        
        if (!reviewerData[reviewerId]) {
          const reviewerInfo = localReviewersMap[reviewerId]
          reviewerData[reviewerId] = { 
            id: reviewerId, 
            name: reviewerInfo?.name || `Reviewer ${reviewerId.substring(0, 4)}`,
            email: reviewerInfo?.email || '',
            completedCount: 0, 
            assignedCount: 0,
            avgScore: 0,
            scores: [],
            variance: 0
          }
        }
        reviewerData[reviewerId].assignedCount++
        if (app.reviewCount > 0) {
          reviewerData[reviewerId].completedCount++
        }
      })
    })
    
    Object.values(reviewerData).forEach(reviewer => {
      if (reviewer.scores.length > 0) {
        reviewer.avgScore = Math.round(reviewer.scores.reduce((a, b) => a + b, 0) / reviewer.scores.length)
        const mean = reviewer.avgScore
        reviewer.variance = Math.round(
          reviewer.scores.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / reviewer.scores.length
        )
      }
    })
    
    return Object.values(reviewerData).sort((a, b) => b.assignedCount - a.assignedCount)
  }, [applications, reviewersMap, formSettings])

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

  if (isLoading) {
    return (
      <div className="absolute inset-0 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    )
  }

  return (
    <div className="absolute inset-0 overflow-y-auto p-8 bg-gray-50">
      {/* Header with AI Badge */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Stage Analytics</h2>
          <p className="text-gray-500 mt-1">Overview of all workflow stages and AI-powered insights</p>
        </div>
        <div className="flex items-center gap-2 bg-gradient-to-r from-purple-50 to-blue-50 px-4 py-2 rounded-full border border-purple-200">
          <Sparkles className="w-4 h-4 text-purple-600" />
          <span className="text-sm font-medium text-purple-700">AI Insights Enabled</span>
        </div>
      </div>

      {/* Quick Stats Row */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Applications</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{applications.length}</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <FileText className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Active Stages</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{stages.length}</p>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
              <Target className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Average Score</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{stats.avgScore}%</p>
            </div>
            <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
              <Star className="w-6 h-6 text-amber-600" />
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Completion Rate</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">
                {applications.length > 0 ? Math.round((stats.approved + stats.rejected) / applications.length * 100) : 0}%
              </p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>
      </div>

      {/* AI Insights Panel */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-2xl p-6 mb-8 text-white">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
            <Brain className="w-5 h-5" />
          </div>
          <h3 className="text-lg font-semibold">AI Insights & Recommendations</h3>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white/10 rounded-xl p-4 backdrop-blur-sm">
            <div className="flex items-center gap-2 mb-2">
              <Lightbulb className="w-4 h-4 text-yellow-300" />
              <span className="text-sm font-medium text-white/90">Smart Suggestion</span>
            </div>
            <p className="text-sm text-white/80">
              {stats.pending > applications.length * 0.3 
                ? `${stats.pending} applications pending review. Consider adding more reviewers to reduce backlog.`
                : stats.inReview > stats.approved + stats.rejected
                ? "Most applications are in review. Reviewers are actively working on evaluations."
                : "Pipeline is healthy with balanced distribution across stages."}
            </p>
          </div>
          <div className="bg-white/10 rounded-xl p-4 backdrop-blur-sm">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-green-300" />
              <span className="text-sm font-medium text-white/90">Pattern Detected</span>
            </div>
            <p className="text-sm text-white/80">
              {stats.avgScore >= 70 
                ? "High-quality applicant pool with strong average scores above 70%."
                : stats.avgScore >= 50
                ? "Moderate score distribution. Consider reviewing rubric criteria alignment."
                : "Lower than expected scores. AI suggests reviewing scoring consistency."}
            </p>
          </div>
          <div className="bg-white/10 rounded-xl p-4 backdrop-blur-sm">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-orange-300" />
              <span className="text-sm font-medium text-white/90">Attention Needed</span>
            </div>
            <p className="text-sm text-white/80">
              {reviewerMetrics.some(r => r.completedCount === 0)
                ? "Some assigned reviewers haven't started evaluations yet."
                : stages.some(s => applications.filter(a => a.stageId === s.id).length === 0)
                ? "Some stages have no applications. Verify workflow configuration."
                : "No critical issues detected. All systems operating normally."}
            </p>
          </div>
        </div>
      </div>

      {/* Stage Pipeline Overview */}
      <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm mb-8">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900">Stage Pipeline Overview</h3>
          <Badge className="bg-blue-100 text-blue-700">{stages.length} stages</Badge>
        </div>
        
        {stages.length > 0 ? (
          <div className="space-y-4">
            {stages.map((stage, idx) => {
              const count = applications.filter(a => a.stageId === stage.id).length
              const percentage = applications.length > 0 ? (count / applications.length) * 100 : 0
              const stageApps = applications.filter(a => a.stageId === stage.id)
              const stageScored = stageApps.filter(a => a.score !== null)
              const stageAvgScore = stageScored.length > 0 
                ? Math.round(stageScored.reduce((sum, a) => sum + ((a.score || 0) / (a.maxScore || 100) * 100), 0) / stageScored.length)
                : null
              
              return (
                <div key={stage.id} className="relative">
                  <div className="flex items-center gap-4">
                    {/* Stage Number */}
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold",
                      idx === 0 ? "bg-blue-600 text-white" :
                      idx === stages.length - 1 ? "bg-green-600 text-white" :
                      "bg-gray-200 text-gray-700"
                    )}>
                      {idx + 1}
                    </div>
                    
                    {/* Stage Info */}
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <span className="font-medium text-gray-900">{stage.name}</span>
                          <Badge variant="outline" className="text-xs">
                            {count} {count === 1 ? 'application' : 'applications'}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4">
                          {stageAvgScore !== null && (
                            <div className="flex items-center gap-2">
                              <Star className="w-4 h-4 text-amber-500" />
                              <span className={cn(
                                "text-sm font-medium",
                                stageAvgScore >= 70 ? "text-green-600" :
                                stageAvgScore >= 50 ? "text-amber-600" :
                                "text-red-600"
                              )}>
                                {stageAvgScore}% avg
                              </span>
                            </div>
                          )}
                          <span className="text-sm text-gray-500">{percentage.toFixed(1)}%</span>
                        </div>
                      </div>
                      
                      {/* Progress Bar */}
                      <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                        <div 
                          className={cn(
                            "h-full rounded-full transition-all duration-500",
                            idx === 0 ? "bg-blue-500" :
                            idx === stages.length - 1 ? "bg-green-500" :
                            "bg-purple-500"
                          )}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  </div>
                  
                  {/* Connector Arrow */}
                  {idx < stages.length - 1 && (
                    <div className="absolute left-5 top-12 h-4 flex items-center">
                      <div className="w-0.5 h-full bg-gray-300" />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          <div className="text-center py-12">
            <Target className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No workflow stages configured</p>
            <p className="text-sm text-gray-400 mt-1">Set up workflow stages in the Workflows tab</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-8 mb-8">
        {/* Score Distribution */}
        <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
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

        {/* Category Performance */}
        <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Rubric Category Performance</h3>
            <Sparkles className="w-4 h-4 text-purple-500" />
          </div>
          <div className="space-y-4">
            {categoryScores.length > 0 ? categoryScores.map((cat) => (
              <div key={cat.id}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-gray-700">{cat.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900">{cat.avgScore}/{cat.maxPoints}</span>
                    {cat.percentage >= 70 && <TrendingUp className="w-3 h-3 text-green-500" />}
                    {cat.percentage < 40 && <TrendingDown className="w-3 h-3 text-red-500" />}
                  </div>
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
              <div className="text-center py-8">
                <BarChart3 className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                <p className="text-gray-500 text-sm">No category scores yet</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Reviewer Performance */}
      <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm mb-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold text-gray-900">Reviewer Activity</h3>
            <Badge className="bg-purple-100 text-purple-700">
              <Brain className="w-3 h-3 mr-1" />
              AI Monitored
            </Badge>
          </div>
          <span className="text-sm text-gray-500">{reviewerMetrics.length} reviewers</span>
        </div>
        {reviewerMetrics.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Reviewer</th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-gray-500">Assigned</th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-gray-500">Completed</th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-gray-500">Avg Score</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">Progress</th>
                </tr>
              </thead>
              <tbody>
                {reviewerMetrics.slice(0, 8).map((reviewer) => {
                  const completionRate = reviewer.assignedCount > 0 
                    ? Math.round((reviewer.completedCount / reviewer.assignedCount) * 100) 
                    : 0
                  
                  return (
                    <tr key={reviewer.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                            <User className="w-4 h-4 text-white" />
                          </div>
                          <div>
                            <span className="text-gray-900 font-medium block">{reviewer.name}</span>
                            {reviewer.email && (
                              <span className="text-xs text-gray-500">{reviewer.email}</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="text-center py-3 px-4 text-gray-600">{reviewer.assignedCount}</td>
                      <td className="text-center py-3 px-4 text-gray-900 font-medium">{reviewer.completedCount}</td>
                      <td className="text-center py-3 px-4">
                        {reviewer.avgScore > 0 ? (
                          <span className="text-amber-600 font-medium">{reviewer.avgScore}%</span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="text-right py-3 px-4">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div 
                              className={cn(
                                "h-full rounded-full transition-all",
                                completionRate >= 80 ? "bg-green-500" :
                                completionRate >= 50 ? "bg-blue-500" :
                                "bg-amber-500"
                              )}
                              style={{ width: `${completionRate}%` }}
                            />
                          </div>
                          <span className="text-sm font-medium text-gray-700 w-10">{completionRate}%</span>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12">
            <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No reviewer activity yet</p>
          </div>
        )}
      </div>

      {/* Status Summary */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-5 h-5 text-amber-600" />
            <span className="text-amber-700 font-medium">Pending</span>
          </div>
          <p className="text-2xl font-bold text-amber-600">{stats.pending}</p>
        </div>
        
        <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
          <div className="flex items-center gap-2 mb-2">
            <Eye className="w-5 h-5 text-blue-600" />
            <span className="text-blue-700 font-medium">In Review</span>
          </div>
          <p className="text-2xl font-bold text-blue-600">{stats.inReview}</p>
        </div>
        
        <div className="bg-green-50 rounded-xl p-4 border border-green-200">
          <div className="flex items-center gap-2 mb-2">
            <ThumbsUp className="w-5 h-5 text-green-600" />
            <span className="text-green-700 font-medium">Approved</span>
          </div>
          <p className="text-2xl font-bold text-green-600">{stats.approved}</p>
        </div>
        
        <div className="bg-red-50 rounded-xl p-4 border border-red-200">
          <div className="flex items-center gap-2 mb-2">
            <ThumbsDown className="w-5 h-5 text-red-600" />
            <span className="text-red-700 font-medium">Rejected</span>
          </div>
          <p className="text-2xl font-bold text-red-600">{stats.rejected}</p>
        </div>
      </div>
    </div>
  )
}
