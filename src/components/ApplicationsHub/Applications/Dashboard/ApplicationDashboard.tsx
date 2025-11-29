'use client'

import { useState, useEffect, useMemo } from 'react'
import { 
  BarChart3, Users, FileText, Clock, Eye, ThumbsUp, ThumbsDown, 
  Star, User, Loader2, Tag
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/ui-components/badge'
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
  raw_data: any
}

export function ApplicationDashboard({ workspaceId, formId }: ApplicationDashboardProps) {
  const [submissions, setSubmissions] = useState<FormSubmission[]>([])
  const [applications, setApplications] = useState<ApplicationData[]>([])
  const [stages, setStages] = useState<StageData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [formSettings, setFormSettings] = useState<any>({})

  useEffect(() => {
    const fetchData = async () => {
      if (!formId) return
      try {
        setIsLoading(true)
        
        // Fetch form
        const form = await goClient.get<Form>(`/forms/${formId}`)
        setFormSettings(form.settings || {})
        
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

  // Reviewer metrics
  const reviewerMetrics = useMemo(() => {
    const reviewerMap: Record<string, { 
      id: string; 
      name: string; 
      completedCount: number; 
      avgScore: number;
      scores: number[];
      variance: number;
    }> = {}
    
    applications.forEach(app => {
      app.assignedReviewers.forEach(reviewerId => {
        if (!reviewerMap[reviewerId]) {
          reviewerMap[reviewerId] = { 
            id: reviewerId, 
            name: `Reviewer ${reviewerId.substring(0, 4)}`,
            completedCount: 0, 
            avgScore: 0,
            scores: [],
            variance: 0
          }
        }
        if (app.reviewCount > 0) {
          reviewerMap[reviewerId].completedCount++
        }
      })
    })
    
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

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    )
  }

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
            {stages.length > 0 ? stages.map((stage, idx) => {
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
            }) : (
              <p className="text-gray-500 text-center py-4">No workflow stages configured</p>
            )}
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
