'use client'

import { useState, useEffect } from 'react'
import { 
  CheckCircle, ChevronRight, AlertCircle, FileText, DollarSign, 
  GraduationCap, Info, X, Edit2, MessageSquare, Loader2,
  ChevronLeft, Star, Award, BookOpen, Users, Clock, Send,
  Eye, EyeOff, Sparkles, Lock, Unlock, Tag, Save
} from 'lucide-react'
import { goClient } from '@/lib/api/go-client'
import { Form, FormField } from '@/types/forms'
import { StageReviewerConfig, Rubric, ApplicationStage } from '@/lib/api/workflows-client'
import { cn } from '@/lib/utils'

interface ExternalReviewInterfaceProps {
  reviewerName: string
  token: string
}

// Enhanced response from backend including workflow stage config
interface ExternalReviewResponse {
  form: Form
  submissions: any[]
  reviewer?: {
    id: string
    name: string
    email: string
    reviewer_type_id?: string
  }
  stage_config?: StageReviewerConfig
  rubric?: Rubric
  stage?: ApplicationStage // ApplicationStage with custom_statuses, custom_tags
}

// Field visibility config types
type FieldVisibility = boolean | 'visible' | 'hidden' | 'score_only'
type FieldVisibilityConfig = Record<string, FieldVisibility>

// Dynamic application structure based on form fields
interface Application {
  id: string
  redactedName: string
  // Dynamic fields from form
  fields: Record<string, any>
  // Grouped by section
  sections: Array<{
    id: string
    title: string
    fields: Array<{ id: string; label: string; value: any; type: string }>
  }>
  // Legacy fields for backwards compatibility  
  gpa?: number | string
  school?: string
  major?: string
  financials?: { gap: number | string; agi: string; pell: boolean }
  essays?: { personal: string; challenge: string }
  activities?: Array<{ role: string; org: string; duration: string }>
  data: any
  // Prior review data if can_view_prior_scores is enabled
  priorReviews?: Array<{
    reviewer_id: string
    reviewer_name?: string
    scores: Record<string, number>
    total_score: number
    notes?: Record<string, string>
    submitted_at: string
  }>
}

// Score level within a rubric category
interface RubricScoreLevel {
  id: string
  minScore: number
  maxScore: number
  label?: string
  description: string
}

// New format rubric category (from enhanced rubric builder)
interface NewRubricCategory {
  id: string
  name: string
  maxPoints: number
  levels: RubricScoreLevel[]
}

// Legacy format for backward compatibility  
interface LegacyRubricCategory {
  id: string
  category: string
  max: number
  description: string
  criteria?: Array<{ range: string; desc: string }>
}

// Union type for both formats
type RubricCategory = NewRubricCategory | LegacyRubricCategory

// Helper to normalize rubric categories to a consistent format
function normalizeRubricCategory(cat: RubricCategory): { id: string; name: string; max: number; levels: Array<{ minScore: number; maxScore: number; description: string }> } {
  if ('maxPoints' in cat && 'levels' in cat) {
    // New format
    return {
      id: cat.id,
      name: cat.name,
      max: cat.maxPoints,
      levels: cat.levels.map(l => ({
        minScore: l.minScore,
        maxScore: l.maxScore,
        description: l.description || l.label || ''
      }))
    }
  } else {
    // Legacy format
    const legacy = cat as LegacyRubricCategory
    return {
      id: legacy.id,
      name: legacy.category,
      max: legacy.max,
      levels: legacy.criteria?.map(c => {
        const [min, max] = c.range.split('-').map(n => parseInt(n.trim()))
        return { minScore: min || 0, maxScore: max || legacy.max, description: c.desc }
      }) || []
    }
  }
}

const DEFAULT_RUBRIC: RubricCategory[] = [
  { 
    id: 'academic', 
    name: 'Academic Performance', 
    maxPoints: 20, 
    levels: [
      { id: '1', minScore: 18, maxScore: 20, description: 'GPA 3.5+, rigorous AP/IB workload, strong test scores' },
      { id: '2', minScore: 14, maxScore: 17, description: 'GPA 3.0-3.4, solid college prep curriculum' },
      { id: '3', minScore: 10, maxScore: 13, description: 'GPA 2.7-2.9, meets basic requirements' }
    ]
  },
  { 
    id: 'financial', 
    name: 'Financial Need', 
    maxPoints: 30, 
    levels: [
      { id: '1', minScore: 25, maxScore: 30, description: 'High gap (>$10k), Pell eligible, significant hardship' },
      { id: '2', minScore: 15, maxScore: 24, description: 'Moderate gap ($5k-$10k), some family contribution' },
      { id: '3', minScore: 0, maxScore: 14, description: 'Low gap (<$5k) or high family contribution' }
    ]
  },
  { 
    id: 'essays', 
    name: 'Essay Quality', 
    maxPoints: 25, 
    levels: [
      { id: '1', minScore: 21, maxScore: 25, description: 'Compelling narrative, clear goals, authentic voice' },
      { id: '2', minScore: 15, maxScore: 20, description: 'Good writing, some unique insights' },
      { id: '3', minScore: 0, maxScore: 14, description: 'Basic writing, limited depth' }
    ]
  },
  { 
    id: 'leadership', 
    name: 'Leadership & Impact', 
    maxPoints: 25, 
    levels: [
      { id: '1', minScore: 21, maxScore: 25, description: 'Founded organizations, significant community impact' },
      { id: '2', minScore: 15, maxScore: 20, description: 'Active involvement, some leadership roles' },
      { id: '3', minScore: 0, maxScore: 14, description: 'Minimal extracurricular engagement' }
    ]
  },
]

export function ExternalReviewInterface({ reviewerName, token }: ExternalReviewInterfaceProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [applications, setApplications] = useState<Application[]>([])
  const [rubric, setRubric] = useState<RubricCategory[]>(DEFAULT_RUBRIC)
  const [fieldVisibilityConfig, setFieldVisibilityConfig] = useState<FieldVisibilityConfig>({})
  const [canViewPriorScores, setCanViewPriorScores] = useState(false)
  const [canViewPriorComments, setCanViewPriorComments] = useState(false)
  const [formFields, setFormFields] = useState<FormField[]>([])
  const [formSections, setFormSections] = useState<FormField[]>([]) // Section-type FormFields
  
  const [currentIndex, setCurrentIndex] = useState(0)
  const [scores, setScores] = useState<Record<string, Record<string, number>>>({})
  const [submitted, setSubmitted] = useState<string[]>([])
  const [drafts, setDrafts] = useState<string[]>([]) // Track applications saved as draft
  const [showRubric, setShowRubric] = useState(false)
  const [rubricNotes, setRubricNotes] = useState<Record<string, Record<string, string>>>({})
  const [overallComments, setOverallComments] = useState<Record<string, string>>({}) // Overall comments per application
  const [selectedStatus, setSelectedStatus] = useState<Record<string, string>>({}) // Status selection per application
  const [selectedTags, setSelectedTags] = useState<Record<string, string[]>>({}) // Tags selection per application
  const [activeSection, setActiveSection] = useState<string>('overview')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSavingDraft, setIsSavingDraft] = useState(false)
  const [customStatuses, setCustomStatuses] = useState<string[]>([]) // Available statuses from stage
  const [customTags, setCustomTags] = useState<string[]>([]) // Available tags from stage

  // Helper to check if a field is visible based on visibility config
  const isFieldVisible = (fieldId: string): boolean => {
    const visibility = fieldVisibilityConfig[fieldId]
    if (visibility === undefined) return true // Default to visible
    if (visibility === 'hidden') return false
    if (visibility === false) return false
    return true // 'visible', 'score_only', or true
  }

  // Helper to check if field is score_only (hidden from view but used for scoring)
  const isFieldScoreOnly = (fieldId: string): boolean => {
    return fieldVisibilityConfig[fieldId] === 'score_only'
  }

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true)
        const response = await goClient.get<ExternalReviewResponse>(`/external-review/${token}`)
        const { form, submissions, stage_config, rubric: stageRubric, reviewer, stage } = response
        const settings = form.settings || {}
        
        // Store form structure for dynamic rendering
        const formFieldsArray = form.fields || []
        const sections = formFieldsArray.filter((f) => f.type === 'section')
        const fields = formFieldsArray.filter((f) => f.type !== 'section')
        setFormSections(sections)
        setFormFields(fields)
        
        // Parse custom statuses and tags from ApplicationStage
        if (stage) {
          const statuses = typeof stage.custom_statuses === 'string'
            ? JSON.parse(stage.custom_statuses)
            : stage.custom_statuses
          if (Array.isArray(statuses)) {
            setCustomStatuses(statuses)
          }
          
          const tags = typeof stage.custom_tags === 'string'
            ? JSON.parse(stage.custom_tags)
            : stage.custom_tags
          if (Array.isArray(tags)) {
            setCustomTags(tags)
          }
        }
        
        // Priority: stage config rubric > stage rubric from response > form settings rubric
        if (stageRubric && stageRubric.categories) {
          // Parse rubric categories from stage-specific rubric
          const categories = typeof stageRubric.categories === 'string' 
            ? JSON.parse(stageRubric.categories) 
            : stageRubric.categories
          if (Array.isArray(categories) && categories.length > 0) {
            setRubric(categories as RubricCategory[])
          }
        } else if (settings.rubric && Array.isArray(settings.rubric) && settings.rubric.length > 0) {
          // Fallback to form settings rubric
          setRubric(settings.rubric as RubricCategory[])
        }

        // Apply field visibility config from stage config
        if (stage_config?.field_visibility_config) {
          const visConfig = typeof stage_config.field_visibility_config === 'string'
            ? JSON.parse(stage_config.field_visibility_config)
            : stage_config.field_visibility_config
          setFieldVisibilityConfig(visConfig as FieldVisibilityConfig)
        }

        // Set prior score/comment visibility
        setCanViewPriorScores(stage_config?.can_view_prior_scores || false)
        setCanViewPriorComments(stage_config?.can_view_prior_comments || false)

        const mappedApps = submissions.map(sub => {
          const data = typeof sub.data === 'string' ? JSON.parse(sub.data) : sub.data
          const metadata = typeof sub.metadata === 'string' ? JSON.parse(sub.metadata) : sub.metadata || {}
          
          if (metadata.review || sub.status === 'reviewed') {
            setSubmitted(prev => prev.includes(sub.id) ? prev : [...prev, sub.id])
            if (metadata.review?.scores) setScores(prev => ({ ...prev, [sub.id]: metadata.review.scores }))
            if (metadata.review?.notes) setRubricNotes(prev => ({ ...prev, [sub.id]: metadata.review.notes }))
            if (metadata.review?.overall_comments) setOverallComments(prev => ({ ...prev, [sub.id]: metadata.review.overall_comments }))
            if (metadata.review?.status) setSelectedStatus(prev => ({ ...prev, [sub.id]: metadata.review.status }))
            if (metadata.review?.tags) setSelectedTags(prev => ({ ...prev, [sub.id]: metadata.review.tags }))
          }
          
          // Check if this is a draft
          if (metadata.review?.is_draft) {
            setDrafts(prev => prev.includes(sub.id) ? prev : [...prev, sub.id])
          }

          // Build sections with visible fields only
          const appSections = sections.map(section => {
            const sectionFields = fields
              .filter(f => f.section_id === section.id)
              .filter(f => isFieldVisible(f.id))
              .map(f => ({
                id: f.id,
                label: f.label || f.name || f.id,
                value: data[f.id] || data[f.name] || '',
                type: f.type
              }))
            return {
              id: section.id,
              title: section.title || section.name || 'Section',
              fields: sectionFields
            }
          }).filter(s => s.fields.length > 0)

          // Extract prior reviews if enabled
          let priorReviews: Application['priorReviews'] = undefined
          if (canViewPriorScores && metadata.review_history) {
            priorReviews = (metadata.review_history as any[])
              .filter(r => r.reviewer_id !== reviewer?.id) // Exclude current reviewer
              .map(r => ({
                reviewer_id: r.reviewer_id,
                reviewer_name: r.reviewer_name || `Reviewer ${r.reviewer_id?.substring(0, 4)}`,
                scores: r.scores || {},
                total_score: r.total_score || Object.values(r.scores || {}).reduce((a: number, b: any) => a + (Number(b) || 0), 0),
                notes: canViewPriorComments ? r.notes : undefined,
                submitted_at: r.submitted_at
              }))
          }

          return {
            id: sub.id,
            redactedName: `Applicant ${sub.id.substring(0, 6).toUpperCase()}`,
            fields: data,
            sections: appSections,
            // Legacy fields for backwards compatibility
            gpa: data.gpa || data.GPA || 'N/A',
            school: data.school || data.university || 'N/A',
            major: data.major || data.intended_major || 'N/A',
            financials: { gap: data.efc || data.financial_need || 0, agi: 'Redacted', pell: data.pell_eligible === 'yes' || data.pell === true },
            essays: { personal: data.personal_statement || data.essay || 'No essay provided.', challenge: data.challenge_essay || data.resilience || '' },
            activities: Array.isArray(data.activities) ? data.activities : [],
            data,
            priorReviews
          }
        })

        setApplications(mappedApps)
        
        const initialScores: Record<string, Record<string, number>> = {}
        mappedApps.forEach(app => {
          if (!scores[app.id]) {
            initialScores[app.id] = {}
            rubric.forEach(cat => { initialScores[app.id][cat.id] = 0 })
          }
        })
        setScores(prev => ({ ...initialScores, ...prev }))
      } catch (err) {
        console.error('Failed to fetch review data:', err)
        setError('Invalid review token or session expired.')
      } finally {
        setIsLoading(false)
      }
    }
    if (token) fetchData()
  }, [token])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4 animate-pulse">
            <Sparkles className="w-8 h-8 text-blue-600" />
          </div>
          <p className="text-gray-600 font-medium">Loading your review session...</p>
        </div>
      </div>
    )
  }

  if (error || applications.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-8 max-w-md text-center">
          <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-500">{error || 'No applications available for review.'}</p>
        </div>
      </div>
    )
  }

  const currentApp = applications[currentIndex]
  const isSubmittedApp = submitted.includes(currentApp.id)
  const isDraftApp = drafts.includes(currentApp.id)
  const currentScore = scores[currentApp.id] || {}
  const currentStatus = selectedStatus[currentApp.id] || ''
  const currentTags = selectedTags[currentApp.id] || []
  const currentOverallComments = overallComments[currentApp.id] || ''
  
  // Normalize rubric categories for consistent access
  const normalizedRubric = rubric.map(normalizeRubricCategory)
  const maxScore = normalizedRubric.reduce((a, b) => a + b.max, 0)
  const totalScore = Object.values(currentScore).reduce((a, b) => a + b, 0)
  const scorePercent = Math.round((totalScore / maxScore) * 100)

  const handleScoreChange = (categoryId: string, value: number) => {
    if (isSubmittedApp) return
    setScores({ ...scores, [currentApp.id]: { ...currentScore, [categoryId]: value } })
  }

  const handleNoteChange = (categoryId: string, value: string) => {
    if (isSubmittedApp) return
    setRubricNotes({ ...rubricNotes, [currentApp.id]: { ...(rubricNotes[currentApp.id] || {}), [categoryId]: value } })
  }

  const handleSubmit = async () => {
    setIsSubmitting(true)
    try {
      await goClient.post(`/external-review/${token}/submit/${currentApp.id}`, {
        scores: currentScore,
        notes: rubricNotes[currentApp.id],
        overall_comments: overallComments[currentApp.id],
        status: selectedStatus[currentApp.id] || 'reviewed',
        tags: selectedTags[currentApp.id] || [],
        is_draft: false
      })
      setSubmitted([...submitted, currentApp.id])
      setDrafts(drafts.filter(id => id !== currentApp.id)) // Remove from drafts
      if (currentIndex < applications.length - 1) {
        setTimeout(() => setCurrentIndex(currentIndex + 1), 1000)
      }
    } catch (err) {
      console.error('Failed to submit:', err)
      alert('Failed to submit review')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSaveDraft = async () => {
    setIsSavingDraft(true)
    try {
      await goClient.post(`/external-review/${token}/submit/${currentApp.id}`, {
        scores: currentScore,
        notes: rubricNotes[currentApp.id],
        overall_comments: overallComments[currentApp.id],
        status: selectedStatus[currentApp.id] || 'draft',
        tags: selectedTags[currentApp.id] || [],
        is_draft: true
      })
      setDrafts(prev => prev.includes(currentApp.id) ? prev : [...prev, currentApp.id])
    } catch (err) {
      console.error('Failed to save draft:', err)
      alert('Failed to save draft')
    } finally {
      setIsSavingDraft(false)
    }
  }

  const handleEdit = () => setSubmitted(submitted.filter(id => id !== currentApp.id))

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-lg border-b border-gray-200/50 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center">
                <Award className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="font-semibold text-gray-900">Scholarship Review Portal</h1>
                <p className="text-sm text-gray-500">Welcome, {reviewerName}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full text-sm font-medium border border-blue-100">
                <EyeOff className="w-4 h-4" />
                PII Protected
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-full text-sm">
                <span className="text-gray-500">Progress:</span>
                <span className="font-semibold text-gray-900">{submitted.length}/{applications.length}</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-12 gap-8">
          {/* Left Column - Application Queue */}
          <div className="col-span-3">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden sticky top-24">
              <div className="p-4 border-b border-gray-100 bg-gray-50/50">
                <h3 className="font-semibold text-gray-900 text-sm">Review Queue</h3>
                <div className="mt-2 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-500" style={{ width: `${(submitted.length / applications.length) * 100}%` }} />
                </div>
              </div>
              <div className="max-h-[calc(100vh-280px)] overflow-y-auto p-2">
                {applications.map((app, idx) => {
                  const isDone = submitted.includes(app.id)
                  const isActive = idx === currentIndex
                  return (
                    <button key={app.id} onClick={() => setCurrentIndex(idx)} className={cn("w-full text-left p-3 rounded-xl mb-1 transition-all flex items-center justify-between", isActive ? "bg-blue-50 border border-blue-200" : "hover:bg-gray-50 border border-transparent")}>
                      <div>
                        <p className={cn("font-medium text-sm", isActive ? "text-blue-900" : "text-gray-900")}>{app.redactedName}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{app.major}</p>
                      </div>
                      {isDone ? <CheckCircle className="w-5 h-5 text-green-500" /> : isActive ? <ChevronRight className="w-4 h-4 text-blue-500" /> : <div className="w-2 h-2 rounded-full bg-gray-300" />}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Middle Column - Application Content */}
          <div className="col-span-5 space-y-6">
            {/* Applicant Card */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-blue-100 text-sm mb-1">Application #{currentIndex + 1} of {applications.length}</p>
                    <h2 className="text-2xl font-bold">{currentApp.redactedName}</h2>
                    <p className="text-blue-100 mt-1">{currentApp.major} • {currentApp.school}</p>
                  </div>
                  {isSubmittedApp && (
                    <div className="bg-white/20 backdrop-blur-sm rounded-xl px-4 py-2 flex items-center gap-2">
                      <CheckCircle className="w-5 h-5" />
                      <span className="font-medium">Reviewed</span>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Quick Stats */}
              <div className="grid grid-cols-3 divide-x divide-gray-100 bg-gray-50/50">
                <div className="p-4 text-center">
                  <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center mx-auto mb-2">
                    <GraduationCap className="w-5 h-5 text-blue-600" />
                  </div>
                  <p className="text-lg font-bold text-gray-900">{currentApp.gpa}</p>
                  <p className="text-xs text-gray-500">GPA</p>
                </div>
                <div className="p-4 text-center">
                  <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center mx-auto mb-2">
                    <DollarSign className="w-5 h-5 text-green-600" />
                  </div>
                  <p className="text-lg font-bold text-gray-900">${Number(currentApp.financials?.gap || 0).toLocaleString()}</p>
                  <p className="text-xs text-gray-500">Need Gap</p>
                </div>
                <div className="p-4 text-center">
                  <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center mx-auto mb-2">
                    <Award className="w-5 h-5 text-purple-600" />
                  </div>
                  <p className="text-lg font-bold text-gray-900">{currentApp.financials?.pell ? 'Yes' : 'No'}</p>
                  <p className="text-xs text-gray-500">Pell Eligible</p>
                </div>
              </div>
            </div>

            {/* Content Tabs */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="flex border-b border-gray-100 overflow-x-auto">
                {/* Dynamic section tabs based on form structure */}
                {currentApp.sections && currentApp.sections.length > 0 ? (
                  <>
                    {currentApp.sections.map((section, idx) => (
                      <button 
                        key={section.id} 
                        onClick={() => setActiveSection(section.id)} 
                        className={cn(
                          "flex-shrink-0 flex items-center justify-center gap-2 py-4 px-4 text-sm font-medium transition-colors border-b-2",
                          activeSection === section.id ? "border-blue-600 text-blue-600 bg-blue-50/50" : "border-transparent text-gray-500 hover:text-gray-700"
                        )}
                      >
                        {idx === 0 ? <Eye className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                        {section.title}
                      </button>
                    ))}
                    {/* Prior Reviews tab if enabled */}
                    {canViewPriorScores && currentApp.priorReviews && currentApp.priorReviews.length > 0 && (
                      <button 
                        onClick={() => setActiveSection('prior-reviews')} 
                        className={cn(
                          "flex-shrink-0 flex items-center justify-center gap-2 py-4 px-4 text-sm font-medium transition-colors border-b-2",
                          activeSection === 'prior-reviews' ? "border-blue-600 text-blue-600 bg-blue-50/50" : "border-transparent text-gray-500 hover:text-gray-700"
                        )}
                      >
                        <Star className="w-4 h-4" />
                        Prior Reviews ({currentApp.priorReviews.length})
                      </button>
                    )}
                  </>
                ) : (
                  /* Fallback to legacy tabs if no sections */
                  [
                    { id: 'overview', label: 'Overview', icon: Eye },
                    { id: 'essays', label: 'Essays', icon: FileText },
                    { id: 'activities', label: 'Activities', icon: Users }
                  ].map(tab => (
                    <button key={tab.id} onClick={() => setActiveSection(tab.id as any)} className={cn("flex-1 flex items-center justify-center gap-2 py-4 text-sm font-medium transition-colors border-b-2", activeSection === tab.id ? "border-blue-600 text-blue-600 bg-blue-50/50" : "border-transparent text-gray-500 hover:text-gray-700")}>
                      <tab.icon className="w-4 h-4" />
                      {tab.label}
                    </button>
                  ))
                )}
              </div>
              
              <div className="p-6">
                {/* Dynamic section content */}
                {currentApp.sections && currentApp.sections.length > 0 ? (
                  <>
                    {currentApp.sections.map(section => (
                      activeSection === section.id && (
                        <div key={section.id} className="space-y-4">
                          <h4 className="text-gray-900 font-semibold mb-3">{section.title}</h4>
                          {section.fields.map(field => (
                            <div key={field.id} className="bg-gray-50 rounded-lg p-4">
                              <p className="text-xs text-gray-500 mb-1">{field.label}</p>
                              {/* Render based on field type */}
                              {field.type === 'textarea' || field.type === 'long_text' || field.type === 'essay' ? (
                                <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{field.value || 'No content provided.'}</p>
                              ) : field.type === 'repeater' || Array.isArray(field.value) ? (
                                <div className="space-y-2 mt-2">
                                  {(Array.isArray(field.value) ? field.value : []).map((item: any, i: number) => (
                                    <div key={i} className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200">
                                      <div>
                                        <p className="font-medium text-gray-900">{item.role || item.title || item.name || JSON.stringify(item)}</p>
                                        <p className="text-sm text-gray-500">{item.org || item.organization || item.description || ''}</p>
                                      </div>
                                      {(item.duration || item.years) && (
                                        <span className="text-sm text-gray-500 bg-gray-50 px-3 py-1 rounded-full border border-gray-200">{item.duration || item.years}</span>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              ) : field.type === 'file' || field.type === 'upload' ? (
                                <div className="flex items-center gap-2 text-blue-600">
                                  <FileText className="w-4 h-4" />
                                  <span className="text-sm">File uploaded</span>
                                </div>
                              ) : (
                                <p className="font-medium text-gray-900">{String(field.value || 'N/A')}</p>
                              )}
                            </div>
                          ))}
                          {section.fields.length === 0 && (
                            <p className="text-gray-500 text-sm">No visible fields in this section.</p>
                          )}
                        </div>
                      )
                    ))}
                    
                    {/* Prior Reviews Section */}
                    {activeSection === 'prior-reviews' && canViewPriorScores && currentApp.priorReviews && (
                      <div className="space-y-4">
                        <h4 className="text-gray-900 font-semibold mb-3 flex items-center gap-2">
                          <Star className="w-4 h-4 text-amber-500" />
                          Prior Reviews
                        </h4>
                        {currentApp.priorReviews.map((review, idx) => (
                          <div key={idx} className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                            <div className="flex items-center justify-between mb-3">
                              <span className="font-medium text-gray-900">{review.reviewer_name}</span>
                              <span className="text-lg font-bold text-blue-600">{review.total_score} pts</span>
                            </div>
                            <div className="grid grid-cols-2 gap-2 mb-3">
                              {Object.entries(review.scores).map(([catId, score]) => {
                                const cat = normalizedRubric.find(r => r.id === catId)
                                return (
                                  <div key={catId} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-gray-100">
                                    <span className="text-xs text-gray-600">{cat?.name || catId}</span>
                                    <span className="text-sm font-semibold text-gray-900">{score}/{cat?.max || '?'}</span>
                                  </div>
                                )
                              })}
                            </div>
                            {canViewPriorComments && review.notes && Object.keys(review.notes).length > 0 && (
                              <div className="border-t border-gray-200 pt-3 mt-3">
                                <p className="text-xs text-gray-500 mb-2">Comments</p>
                                {Object.entries(review.notes).map(([catId, note]) => {
                                  const cat = normalizedRubric.find(r => r.id === catId)
                                  return note ? (
                                    <div key={catId} className="text-sm text-gray-700 mb-2">
                                      <span className="font-medium">{cat?.name || catId}:</span> {note}
                                    </div>
                                  ) : null
                                })}
                              </div>
                            )}
                            <p className="text-xs text-gray-400 mt-2">
                              Submitted {new Date(review.submitted_at).toLocaleDateString()}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  /* Legacy content rendering */
                  <>
                    {activeSection === 'overview' && (
                      <div className="prose prose-sm max-w-none">
                        <h4 className="text-gray-900 font-semibold mb-3">Application Summary</h4>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="bg-gray-50 rounded-lg p-3">
                            <p className="text-xs text-gray-500 mb-1">Intended Major</p>
                            <p className="font-medium text-gray-900">{currentApp.major}</p>
                          </div>
                          <div className="bg-gray-50 rounded-lg p-3">
                            <p className="text-xs text-gray-500 mb-1">School</p>
                            <p className="font-medium text-gray-900">{currentApp.school}</p>
                          </div>
                        </div>
                        <p className="text-gray-600 mt-4 leading-relaxed">{currentApp.essays?.personal?.substring(0, 300)}...</p>
                      </div>
                    )}
                    
                    {activeSection === 'essays' && (
                      <div className="space-y-6">
                        <div>
                          <h4 className="text-gray-900 font-semibold mb-3 flex items-center gap-2">
                            <BookOpen className="w-4 h-4 text-blue-600" />
                            Personal Statement
                          </h4>
                          <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{currentApp.essays?.personal}</p>
                        </div>
                        {currentApp.essays?.challenge && (
                          <div className="pt-6 border-t border-gray-100">
                            <h4 className="text-gray-900 font-semibold mb-3">Challenge & Resilience</h4>
                            <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{currentApp.essays.challenge}</p>
                          </div>
                        )}
                      </div>
                    )}
                    
                    {activeSection === 'activities' && (
                      <div className="space-y-3">
                        <h4 className="text-gray-900 font-semibold mb-3">Extracurricular Activities</h4>
                        {(currentApp.activities?.length || 0) === 0 ? (
                          <p className="text-gray-500 text-sm">No activities listed.</p>
                        ) : (
                          currentApp.activities?.map((act, i) => (
                            <div key={i} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                              <div>
                                <p className="font-medium text-gray-900">{act.role}</p>
                                <p className="text-sm text-gray-500">{act.org}</p>
                              </div>
                              <span className="text-sm text-gray-500 bg-white px-3 py-1 rounded-full border border-gray-200">{act.duration}</span>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Right Column - Scoring */}
          <div className="col-span-4">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden sticky top-24">
              <div className="p-5 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900">Evaluation</h3>
                  <p className="text-sm text-gray-500">Rate each category</p>
                </div>
                <button onClick={() => setShowRubric(true)} className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
                  <Info className="w-4 h-4" />
                  Rubric
                </button>
              </div>

              {isSubmittedApp ? (
                <div className="p-8 text-center">
                  <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="w-10 h-10 text-green-600" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-1">Review Complete</h3>
                  <p className="text-gray-500 mb-2">Score: {totalScore}/{maxScore}</p>
                  <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden mb-6">
                    <div className={cn("h-full rounded-full", scorePercent >= 80 ? "bg-green-500" : scorePercent >= 60 ? "bg-blue-500" : "bg-amber-500")} style={{ width: `${scorePercent}%` }} />
                  </div>
                  <button onClick={handleEdit} className="text-blue-600 hover:text-blue-700 font-medium flex items-center gap-2 mx-auto">
                    <Edit2 className="w-4 h-4" />
                    Edit Review
                  </button>
                </div>
              ) : (
                <div className="p-5">
                  {/* Score Summary */}
                  <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-100">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-blue-900">Total Score</span>
                      <span className="text-2xl font-bold text-blue-600">{totalScore}<span className="text-sm text-blue-400 font-normal">/{maxScore}</span></span>
                    </div>
                    <div className="w-full h-2 bg-blue-200/50 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-300" style={{ width: `${scorePercent}%` }} />
                    </div>
                  </div>

                  {/* Category Scores */}
                  <div className="space-y-5">
                    {normalizedRubric.map((cat) => (
                      <div key={cat.id} className="group">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <p className="font-medium text-gray-900 text-sm">{cat.name}</p>
                            {cat.levels.length > 0 && (
                              <p className="text-xs text-gray-500">
                                {cat.levels[0]?.minScore}-{cat.levels[0]?.maxScore}: {cat.levels[0]?.description?.substring(0, 40)}...
                              </p>
                            )}
                          </div>
                          <span className="text-sm font-semibold text-gray-900">{currentScore[cat.id] || 0}/{cat.max}</span>
                        </div>
                        <input type="range" min="0" max={cat.max} value={currentScore[cat.id] || 0} onChange={(e) => handleScoreChange(cat.id, parseInt(e.target.value))} className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600" />
                        <input type="text" value={rubricNotes[currentApp.id]?.[cat.id] || ''} onChange={(e) => handleNoteChange(cat.id, e.target.value)} placeholder="Add note..." className="w-full mt-2 text-xs p-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none" />
                      </div>
                    ))}
                  </div>

                  {/* Status Selection */}
                  {customStatuses.length > 0 && (
                    <div className="mt-6 pt-5 border-t border-gray-100">
                      <label className="block text-sm font-medium text-gray-900 mb-2">Application Status</label>
                      <select
                        value={currentStatus}
                        onChange={(e) => setSelectedStatus({ ...selectedStatus, [currentApp.id]: e.target.value })}
                        className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                      >
                        <option value="">Select status...</option>
                        {customStatuses.map((status) => (
                          <option key={status} value={status}>{status}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Tags Selection */}
                  {customTags.length > 0 && (
                    <div className="mt-4">
                      <label className="block text-sm font-medium text-gray-900 mb-2">
                        <Tag className="w-4 h-4 inline mr-1" />
                        Tags
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {customTags.map((tag) => {
                          const isSelected = currentTags.includes(tag)
                          return (
                            <button
                              key={tag}
                              onClick={() => {
                                if (isSelected) {
                                  setSelectedTags({ ...selectedTags, [currentApp.id]: currentTags.filter(t => t !== tag) })
                                } else {
                                  setSelectedTags({ ...selectedTags, [currentApp.id]: [...currentTags, tag] })
                                }
                              }}
                              className={cn(
                                "px-3 py-1.5 text-xs font-medium rounded-full transition-all border",
                                isSelected
                                  ? "bg-blue-100 text-blue-700 border-blue-200"
                                  : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"
                              )}
                            >
                              {tag}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Overall Comments */}
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-900 mb-2">
                      <MessageSquare className="w-4 h-4 inline mr-1" />
                      Overall Comments
                    </label>
                    <textarea
                      value={currentOverallComments}
                      onChange={(e) => setOverallComments({ ...overallComments, [currentApp.id]: e.target.value })}
                      placeholder="Add any overall comments about this application..."
                      rows={3}
                      className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none"
                    />
                  </div>

                  {/* Draft indicator */}
                  {isDraftApp && (
                    <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2 text-amber-700 text-sm">
                      <Save className="w-4 h-4" />
                      <span>Draft saved - continue editing or submit when ready</span>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="mt-6 space-y-3">
                    {/* Submit Button */}
                    <button onClick={handleSubmit} disabled={isSubmitting} className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-semibold hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg shadow-blue-200 flex items-center justify-center gap-2 disabled:opacity-50">
                      {isSubmitting ? (
                        <><Loader2 className="w-5 h-5 animate-spin" />Submitting...</>
                      ) : (
                        <><Send className="w-5 h-5" />Submit Review</>
                      )}
                    </button>

                    {/* Save as Draft Button */}
                    <button onClick={handleSaveDraft} disabled={isSavingDraft} className="w-full py-2.5 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                      {isSavingDraft ? (
                        <><Loader2 className="w-4 h-4 animate-spin" />Saving...</>
                      ) : (
                        <><Save className="w-4 h-4" />Save as Draft</>
                      )}
                    </button>
                  </div>

                  {/* Navigation */}
                  <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
                    <button onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))} disabled={currentIndex === 0} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 disabled:opacity-50">
                      <ChevronLeft className="w-4 h-4" />Previous
                    </button>
                    <button onClick={() => setCurrentIndex(Math.min(applications.length - 1, currentIndex + 1))} disabled={currentIndex === applications.length - 1} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 disabled:opacity-50">
                      Next<ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Rubric Modal */}
      {showRubric && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">Scoring Rubric Guidelines</h3>
              <button onClick={() => setShowRubric(false)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {normalizedRubric.map((section) => (
                <div key={section.id} className="border border-gray-200 rounded-xl overflow-hidden">
                  <div className="bg-gray-50 px-4 py-3 flex items-center justify-between">
                    <h4 className="font-semibold text-gray-900">{section.name}</h4>
                    <span className="text-sm text-gray-500">Max: {section.max} pts</span>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {section.levels.map((level, j) => (
                      <div key={j} className="px-4 py-3 flex gap-4">
                        <span className={cn(
                          "text-sm font-semibold w-20 shrink-0",
                          j === 0 ? "text-blue-600" : j === 1 ? "text-blue-500" : "text-gray-500"
                        )}>
                          {level.minScore}-{level.maxScore} pts
                        </span>
                        <span className="text-sm text-gray-600">{level.description}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="p-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
              <button onClick={() => setShowRubric(false)} className="w-full py-2.5 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 transition-colors">Close Guide</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
