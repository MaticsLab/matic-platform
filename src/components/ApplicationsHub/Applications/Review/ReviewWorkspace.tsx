'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { 
  ChevronRight, ChevronLeft, Star, CheckCircle, Check,
  FileText, Users, Award, Flag, 
  ThumbsUp, ThumbsDown, AlertCircle, Loader2, 
  Eye, EyeOff, Clock, User, MessageSquare,
  ArrowRight, Filter, LayoutGrid, List,
  X, Save, RefreshCw, Zap, Play, Pause,
  ChevronDown, ChevronUp, Maximize2, Minimize2, Send,
  Target, TrendingUp, BarChart3, Layers,
  UserCheck, UserPlus, ArrowUpRight, Inbox,
  GraduationCap, Search, Settings2, Type, Shield,
  Plus, Sparkles, Trash2
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { goClient } from '@/lib/api/go-client'
import { formsClient } from '@/lib/api/forms-client'
import { FormSubmission, Form, FormField } from '@/types/forms'
import { 
  workflowsClient, 
  ApplicationStage, 
  Rubric, 
  StageReviewerConfig, 
  ReviewerType,
  ReviewWorkflow,
  WorkflowAction,
  ApplicationGroup,
  StageAction,
  StageGroup,
  StatusOption
} from '@/lib/api/workflows-client'
import { Button } from '@/ui-components/button'
import { Badge } from '@/ui-components/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/ui-components/dropdown-menu'
import { useSearchSafe, HubSearchContext } from '@/components/Search'
import { ReviewerManagement } from '../Reviewers/ReviewerManagement'
import { CommunicationsCenter } from '../Communications/CommunicationsCenter'
import { Circle, Folder, FolderOpen } from 'lucide-react'

// Stage color palette - semantic colors for workflow stages
const STAGE_COLORS = {
  blue: { bg: 'bg-blue-500', bgLight: 'bg-blue-100', border: 'border-blue-200', text: 'text-blue-700', textLight: 'text-blue-500' },
  green: { bg: 'bg-green-500', bgLight: 'bg-green-100', border: 'border-green-200', text: 'text-green-700', textLight: 'text-green-500' },
  yellow: { bg: 'bg-yellow-500', bgLight: 'bg-yellow-100', border: 'border-yellow-200', text: 'text-yellow-700', textLight: 'text-yellow-500' },
  orange: { bg: 'bg-orange-500', bgLight: 'bg-orange-100', border: 'border-orange-200', text: 'text-orange-700', textLight: 'text-orange-500' },
  red: { bg: 'bg-red-500', bgLight: 'bg-red-100', border: 'border-red-200', text: 'text-red-700', textLight: 'text-red-500' },
  purple: { bg: 'bg-purple-500', bgLight: 'bg-purple-100', border: 'border-purple-200', text: 'text-purple-700', textLight: 'text-purple-500' },
  pink: { bg: 'bg-pink-500', bgLight: 'bg-pink-100', border: 'border-pink-200', text: 'text-pink-700', textLight: 'text-pink-500' },
  teal: { bg: 'bg-teal-500', bgLight: 'bg-teal-100', border: 'border-teal-200', text: 'text-teal-700', textLight: 'text-teal-500' },
  indigo: { bg: 'bg-indigo-500', bgLight: 'bg-indigo-100', border: 'border-indigo-200', text: 'text-indigo-700', textLight: 'text-indigo-500' },
  slate: { bg: 'bg-slate-500', bgLight: 'bg-slate-100', border: 'border-slate-200', text: 'text-slate-700', textLight: 'text-slate-500' },
} as const

type StageColorKey = keyof typeof STAGE_COLORS

// Default stage colors based on index
const getDefaultStageColor = (index: number): StageColorKey => {
  const colorOrder: StageColorKey[] = ['blue', 'green', 'purple', 'orange', 'teal', 'pink', 'yellow', 'indigo', 'red', 'slate']
  return colorOrder[index % colorOrder.length]
}

// Reviewer info for external review mode
interface ReviewerInfo {
  id: string
  name: string
  email?: string
  reviewer_type_id?: string
}

// Review mode: 'internal' for staff/admin, 'external' for shareable link
type ReviewMode = 'internal' | 'external'

interface ReviewWorkspaceProps {
  // Internal mode props
  workspaceId?: string
  formId?: string | null
  // External mode props
  mode?: ReviewMode
  token?: string
  // UI control props
  showReviewersPanel?: boolean
  onToggleReviewersPanel?: () => void
  showCommunicationsPanel?: boolean
  onToggleCommunicationsPanel?: () => void
}

// Helper function to render nested data (groups, repeaters, objects) nicely
function renderFieldValue(key: string, value: any, depth: number = 0): React.ReactNode {
  if (value === null || value === undefined || value === '') {
    return <span className="text-gray-400 italic">Not provided</span>
  }
  
  if (typeof value === 'boolean') {
    return <span className={value ? 'text-green-600' : 'text-gray-500'}>{value ? 'Yes' : 'No'}</span>
  }
  
  if (typeof value === 'number') {
    return <span className="font-medium">{value}</span>
  }
  
  if (typeof value === 'string') {
    // Check if it's a long text
    if (value.length > 200) {
      return <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">{value}</p>
    }
    return <span className="text-gray-900">{value}</span>
  }
  
  // Handle arrays (repeaters)
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return <span className="text-gray-400 italic">None</span>
    }
    
    // Check if it's an array of primitives
    if (value.every(v => typeof v !== 'object')) {
      return <span className="text-gray-900">{value.join(', ')}</span>
    }
    
    // Array of objects (repeater items)
    return (
      <div className="space-y-3 mt-2">
        {value.map((item, idx) => (
          <div key={idx} className="bg-gray-50 border border-gray-200 rounded-lg p-3">
            <div className="text-xs font-medium text-gray-500 uppercase mb-2">Item {idx + 1}</div>
            <div className="grid gap-2">
              {typeof item === 'object' && item !== null ? (
                Object.entries(item).map(([k, v]) => (
                  <div key={k} className="flex flex-wrap gap-x-2">
                    <span className="text-xs font-medium text-gray-500 min-w-[80px]">{k.replace(/_/g, ' ')}:</span>
                    <span className="text-sm text-gray-900">{renderFieldValue(k, v, depth + 1)}</span>
                  </div>
                ))
              ) : (
                <span className="text-sm text-gray-900">{String(item)}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    )
  }
  
  // Handle objects (groups)
  if (typeof value === 'object') {
    const entries = Object.entries(value).filter(([k]) => !k.startsWith('_'))
    
    if (entries.length === 0) {
      return <span className="text-gray-400 italic">Empty</span>
    }
    
    // Check if all values are simple (no nested objects)
    const allSimple = entries.every(([, v]) => typeof v !== 'object' || v === null)
    
    if (allSimple && entries.length <= 4) {
      // Render inline for simple groups with few fields
      return (
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {entries.map(([k, v]) => (
            <span key={k} className="text-sm">
              <span className="text-gray-500">{k.replace(/_/g, ' ')}:</span>{' '}
              <span className="text-gray-900 font-medium">{v === null || v === '' ? '-' : String(v)}</span>
            </span>
          ))}
        </div>
      )
    }
    
    // Render as nested card for complex groups
    return (
      <div className={cn("mt-2 rounded-lg border border-gray-200 overflow-hidden", depth === 0 ? "bg-white" : "bg-gray-50")}>
        <div className="divide-y divide-gray-100">
          {entries.map(([k, v]) => (
            <div key={k} className="px-3 py-2">
              <div className="text-xs font-medium text-blue-600 uppercase tracking-wide mb-1">
                {k.replace(/_/g, ' ')}
              </div>
              <div className="text-gray-900">{renderFieldValue(k, v, depth + 1)}</div>
            </div>
          ))}
        </div>
      </div>
    )
  }
  
  return <span className="text-gray-900">{String(value)}</span>
}

// Types for section-based field grouping
interface FormSection {
  id: string
  name: string
  description?: string
  position: number
  fields: FormField[]
}

interface GroupedFormData {
  sections: FormSection[]
  ungroupedFields: FormField[]
}

// Helper to get config from field (handles both direct config and nested)
function getFieldConfig(field: FormField): Record<string, any> {
  if (field.config && typeof field.config === 'object') {
    return field.config as Record<string, any>
  }
  if (field.settings && typeof field.settings === 'object') {
    return field.settings as Record<string, any>
  }
  return {}
}

// Helper to organize form fields into sections based on form.settings.sections
function groupFieldsBySections(fields: FormField[] | undefined, formSettings: Record<string, any> | undefined): GroupedFormData {
  if (!fields || fields.length === 0) {
    return { sections: [], ungroupedFields: [] }
  }

  const excludedFieldLabels = ['IP', '_user_agent', 'ip', 'user_agent', '_ip', 'id']
  
  // Filter out excluded fields and layout-only fields
  const regularFields = fields.filter(f => 
    f.type !== 'section' && 
    f.type !== 'divider' && 
    f.type !== 'heading' && 
    f.type !== 'paragraph' &&
    !excludedFieldLabels.includes(f.label) &&
    !excludedFieldLabels.includes(f.name)
  )

  // If form has sections defined in settings, use those
  if (formSettings?.sections && Array.isArray(formSettings.sections)) {
    const sections: FormSection[] = formSettings.sections.map((section: any, index: number) => {
      // Find fields that belong to this section via config.section_id
      const sectionFields = regularFields
        .filter(f => {
          const config = getFieldConfig(f)
          return config.section_id === section.id
        })
        .sort((a, b) => a.position - b.position)
      
      return {
        id: section.id,
        name: section.title || section.name || `Section ${index + 1}`,
        description: section.description,
        position: index,
        fields: sectionFields
      }
    }).filter((s: FormSection) => s.fields.length > 0) // Only include sections with fields
    
    // Find fields not assigned to any section
    const assignedFieldIds = new Set(sections.flatMap(s => s.fields.map(f => f.id)))
    const ungroupedFields = regularFields
      .filter(f => !assignedFieldIds.has(f.id))
      .sort((a, b) => a.position - b.position)
    
    return { sections, ungroupedFields }
  }
  
  // Fallback: check if fields themselves have section type
  const sectionFields = fields.filter(f => f.type === 'section')
  
  if (sectionFields.length > 0) {
    const sections: FormSection[] = sectionFields.map(section => ({
      id: section.id,
      name: section.title || section.label || section.name || 'Untitled Section',
      description: section.description,
      position: section.position,
      fields: regularFields
        .filter(f => {
          const config = getFieldConfig(f)
          return config.section_id === section.id || f.section_id === section.id
        })
        .sort((a, b) => a.position - b.position)
    })).filter(s => s.fields.length > 0)

    sections.sort((a, b) => a.position - b.position)
    
    const assignedFieldIds = new Set(sections.flatMap(s => s.fields.map(f => f.id)))
    const ungroupedFields = regularFields
      .filter(f => !assignedFieldIds.has(f.id))
      .sort((a, b) => a.position - b.position)
      
    return { sections, ungroupedFields }
  }
  
  // No sections at all - return all as ungrouped
  return { sections: [], ungroupedFields: regularFields.sort((a, b) => a.position - b.position) }
}

// Get list of fields that can be used as title
function getTitleCandidateFields(fields: FormField[] | undefined): FormField[] {
  if (!fields) return []
  return fields.filter(f => 
    ['text', 'email', 'select'].includes(f.type) && 
    f.type !== 'section' &&
    !f.name.toLowerCase().includes('password')
  ).sort((a, b) => a.position - b.position)
}

// Helper to redact PII values from text - returns JSX with redacted spans
function RedactedText({ text, piiValues }: { text: string, piiValues: string[] }): JSX.Element {
  if (!text || piiValues.length === 0) return <>{text}</>
  
  // Build a regex that matches any of the PII values
  const validPiiValues = piiValues.filter(v => v && v.length >= 2)
  if (validPiiValues.length === 0) return <>{text}</>
  
  const pattern = validPiiValues
    .map(v => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|')
  
  const regex = new RegExp(`(${pattern})`, 'gi')
  const parts = text.split(regex)
  
  return (
    <>
      {parts.map((part, i) => {
        const isRedacted = validPiiValues.some(v => v.toLowerCase() === part.toLowerCase())
        if (isRedacted) {
          return (
            <span 
              key={i}
              className="bg-gray-900 text-gray-900 rounded px-1 select-none cursor-help hover:bg-gray-700 hover:text-gray-700 transition-colors"
              title="Hidden for privacy"
            >
              {part}
            </span>
          )
        }
        return <span key={i}>{part}</span>
      })}
    </>
  )
}

// Get display name for an application
function getApplicationDisplayName(
  app: ApplicationData, 
  titleFieldName: string | null, 
  hidePII: boolean
): string {
  if (hidePII) {
    return `Applicant ${app.id.substring(0, 6)}`
  }
  
  if (titleFieldName && app.raw_data[titleFieldName]) {
    return String(app.raw_data[titleFieldName])
  }
  
  return app.name
}

// Single review entry from a reviewer
interface ReviewHistoryEntry {
  reviewer_id: string
  reviewer_name: string
  reviewed_at: string
  scores: Record<string, number>
  total_score?: number
  notes?: string
  comments?: string
  criteria_comments?: Record<string, string>
}

interface ApplicationData {
  id: string
  name: string
  email: string
  submittedAt: string
  stageId: string
  stageName: string
  status: string // Custom statuses supported
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
  reviewHistory: ReviewHistoryEntry[]
}

interface StageWithConfig extends ApplicationStage {
  reviewerConfigs: StageReviewerConfig[]
  rubric: Rubric | null
  applicationCount: number
  stageActions: StageAction[]
}

type ViewMode = 'focus' | 'queue' | 'analytics'

export function ReviewWorkspace({ 
  workspaceId: propWorkspaceId, 
  formId: propFormId, 
  mode = 'internal',
  token,
  showReviewersPanel: externalShowReviewersPanel, 
  onToggleReviewersPanel,
  showCommunicationsPanel: externalShowCommunicationsPanel,
  onToggleCommunicationsPanel
}: ReviewWorkspaceProps) {
  // Determine if this is external review mode
  const isExternalMode = mode === 'external' && !!token
  
  // Dynamic workspaceId and formId (will be set from token response in external mode)
  const [workspaceId, setWorkspaceId] = useState<string>(propWorkspaceId || '')
  const [formId, setFormId] = useState<string | null>(propFormId || null)
  
  // External reviewer state
  const [reviewerInfo, setReviewerInfo] = useState<ReviewerInfo | null>(null)
  const [reviewerConfig, setReviewerConfig] = useState<StageReviewerConfig | null>(null)
  const [fieldVisibilityConfig, setFieldVisibilityConfig] = useState<Record<string, boolean | 'visible' | 'hidden' | 'score_only'>>({})
  const [externalError, setExternalError] = useState<string | null>(null)
  
  // Core state
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [workflows, setWorkflows] = useState<ReviewWorkflow[]>([])
  const [workflow, setWorkflow] = useState<ReviewWorkflow | null>(null)
  const [stages, setStages] = useState<StageWithConfig[]>([])
  const [applications, setApplications] = useState<ApplicationData[]>([])
  const [reviewerTypes, setReviewerTypes] = useState<ReviewerType[]>([])
  const [rubrics, setRubrics] = useState<Rubric[]>([])
  const [form, setForm] = useState<Form | null>(null)
  const [workflowActions, setWorkflowActions] = useState<WorkflowAction[]>([])
  const [groups, setGroups] = useState<ApplicationGroup[]>([]) // Application Groups (global, shown everywhere)
  const [stageGroups, setStageGroups] = useState<StageGroup[]>([]) // Stage Groups (shown only within stage)
  const [selectedStageGroupId, setSelectedStageGroupId] = useState<string | null>(null) // Filter by stage group
  const [stageActions, setStageActions] = useState<StageAction[]>([])
  
  // Form display settings
  const [titleFieldName, setTitleFieldName] = useState<string | null>(null)
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set())
  const [showTitleFieldSelector, setShowTitleFieldSelector] = useState(false)
  
  // Section comments (per application, per section)
  const [sectionComments, setSectionComments] = useState<Record<string, Record<string, string>>>({})
  
  // UI state
  const [viewMode, setViewMode] = useState<ViewMode>('queue')
  const [internalShowReviewersPanel, setInternalShowReviewersPanel] = useState(false)
  const [internalShowCommunicationsPanel, setInternalShowCommunicationsPanel] = useState(false)
  
  // Use external control if provided, otherwise use internal state
  const showReviewersPanel = externalShowReviewersPanel !== undefined ? externalShowReviewersPanel : internalShowReviewersPanel
  const setShowReviewersPanel = onToggleReviewersPanel || (() => setInternalShowReviewersPanel(!internalShowReviewersPanel))
  const showCommunicationsPanel = externalShowCommunicationsPanel !== undefined ? externalShowCommunicationsPanel : internalShowCommunicationsPanel
  const setShowCommunicationsPanel = onToggleCommunicationsPanel || (() => setInternalShowCommunicationsPanel(!internalShowCommunicationsPanel))
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
  const [showOnlyUnassigned, setShowOnlyUnassigned] = useState(false)
  const [isAssigningUnassigned, setIsAssigningUnassigned] = useState(false)
  
  // Scoring state
  const [editingScores, setEditingScores] = useState<Record<string, number>>({})
  const [editingComments, setEditingComments] = useState('')
  const [reviewTimer, setReviewTimer] = useState(0)
  const [timerActive, setTimerActive] = useState(false)

  // Get search context (may be null in external mode)
  const searchContext = useSearchSafe()
  const globalSearchQuery = searchContext?.query || ''

  // Sync global search with local search
  useEffect(() => {
    if (globalSearchQuery) {
      setSearchQuery(globalSearchQuery)
    }
  }, [globalSearchQuery])

  // Timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout
    if (timerActive && isReviewMode) {
      interval = setInterval(() => setReviewTimer(t => t + 1), 1000)
    }
    return () => clearInterval(interval)
  }, [timerActive, isReviewMode])

  // Load all data - different paths for internal vs external mode
  useEffect(() => {
    if (isExternalMode && token) {
      loadExternalReviewData()
    } else if (formId && workspaceId) {
      loadData()
    }
  }, [isExternalMode, token, formId, workspaceId])

  // Load data for external review mode via token
  const loadExternalReviewData = async () => {
    if (!token) return
    
    setIsLoading(true)
    setExternalError(null)
    
    try {
      const response = await goClient.get<{
        form: Form
        submissions: Array<{ id: string; data: any; metadata: any; created_at: string }>
        reviewer: { id: string; name: string; email?: string; reviewer_type_id?: string } | null
        stage_config: StageReviewerConfig | null
        rubric: Rubric | null
        stage: ApplicationStage | null
      }>(`/external-review/${token}`)
      
      const { form: loadedForm, submissions, reviewer, stage_config, rubric, stage } = response
      
      // Set form and workspace info
      setForm(loadedForm)
      setFormId(loadedForm.id)
      setWorkspaceId(loadedForm.workspace_id)
      
      // Set reviewer info
      if (reviewer) {
        setReviewerInfo({
          id: reviewer.id,
          name: reviewer.name,
          email: reviewer.email,
          reviewer_type_id: reviewer.reviewer_type_id
        })
      }
      
      // Set reviewer config and permissions
      if (stage_config) {
        setReviewerConfig(stage_config)
        // Parse field visibility config if present
        if (stage_config.field_visibility_config) {
          const visConfig = typeof stage_config.field_visibility_config === 'string'
            ? JSON.parse(stage_config.field_visibility_config as string)
            : stage_config.field_visibility_config
          setFieldVisibilityConfig(visConfig || {})
        }
      }
      
      // Set up stages and rubrics from the stage config
      if (stage) {
        const stageWithConfig: StageWithConfig = {
          ...stage,
          reviewerConfigs: stage_config ? [stage_config] : [],
          rubric: rubric || null,
          applicationCount: submissions.length,
          stageActions: []
        }
        setStages([stageWithConfig])
        setSelectedStageId(stage.id)
      }
      
      if (rubric) {
        setRubrics([rubric])
      }
      
      // Set title field
      if (!titleFieldName && loadedForm.fields) {
        const candidates = getTitleCandidateFields(loadedForm.fields)
        const defaultTitleField = candidates.find(f => 
          f.name.toLowerCase().includes('name') || 
          f.label.toLowerCase().includes('name')
        ) || candidates[0]
        if (defaultTitleField) {
          setTitleFieldName(defaultTitleField.name)
        }
      }
      
      // Map submissions to ApplicationData format
      const mappedApplications: ApplicationData[] = submissions.map((sub, idx) => {
        const data = typeof sub.data === 'string' ? JSON.parse(sub.data) : sub.data
        const metadata = typeof sub.metadata === 'string' ? JSON.parse(sub.metadata) : (sub.metadata || {})
        
        const review = metadata.review || {}
        const reviewHistory = Array.isArray(metadata.review_history) ? metadata.review_history : []
        
        return {
          id: sub.id,
          name: data.name || data.full_name || data.student_name || `Applicant ${idx + 1}`,
          email: data.email || data.personal_email || '',
          school: data.school || data.university || '',
          major: data.major || data.intended_major || '',
          gpa: data.gpa ? parseFloat(data.gpa) : null,
          score: review.total_score || null,
          maxScore: rubric?.max_score || 100,
          status: metadata.status || 'pending',
          stageId: stage?.id || '',
          stageName: stage?.name || '',
          workflowId: stage?.review_workflow_id || '',
          workflowName: '',
          tags: metadata.tags || [],
          scores: review.scores || {},
          notes: review.notes || {},
          comments: review.overall_comments || '',
          flagged: metadata.flagged || false,
          assignedReviewers: metadata.assigned_reviewers || [],
          reviewCount: reviewHistory.length,
          raw_data: data,
          createdAt: sub.created_at,
          submittedAt: sub.created_at,
          requiredReviews: metadata.required_reviews || 1,
          reviewHistory: reviewHistory.map((rh: any) => ({
            reviewer_id: rh.reviewer_id || '',
            reviewer_name: rh.reviewer_name || 'Reviewer',
            scores: rh.scores || {},
            total_score: rh.total_score || 0,
            notes: rh.notes || {},
            submitted_at: rh.submitted_at || ''
          }))
        }
      })
      
      setApplications(mappedApplications)
      
      // Start in focus review mode by default for external reviewers
      if (mappedApplications.length > 0) {
        setSelectedAppIndex(0)
        setViewMode('focus')
        setIsReviewMode(true)
      }
      
    } catch (error: any) {
      console.error('Failed to load external review data:', error)
      setExternalError(error.message || 'Invalid review token or session expired')
    } finally {
      setIsLoading(false)
    }
  }

  // Reload stages when workflow changes (internal mode only)
  useEffect(() => {
    if (isExternalMode) return
    if (!workflow || !workspaceId) return
    loadStagesForWorkflow(workflow.id)
  }, [workflow?.id, isExternalMode])

  const loadStagesForWorkflow = async (workflowId: string) => {
    try {
      const stagesData = await workflowsClient.listStages(workspaceId, workflowId)
      
      const loadedStages = await Promise.all(
        stagesData.map(async (stage) => {
          let configs: StageReviewerConfig[] = []
          let actions: StageAction[] = []
          try {
            [configs, actions] = await Promise.all([
              workflowsClient.listStageConfigs(stage.id),
              workflowsClient.listStageActions(stage.id)
            ])
          } catch {}
          
          const primaryConfig = configs[0]
          const rubric = primaryConfig?.rubric_id 
            ? rubrics.find(r => r.id === primaryConfig.rubric_id) || null
            : null
          
          return {
            ...stage,
            reviewerConfigs: configs,
            rubric,
            applicationCount: applications.filter(a => a.stageId === stage.id).length,
            stageActions: actions
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
      const loadedForm = await goClient.get<Form>(`/forms/${formId}`)
      setForm(loadedForm)
      
      // Set default title field if not already set
      if (!titleFieldName && loadedForm.fields) {
        const candidates = getTitleCandidateFields(loadedForm.fields)
        const defaultTitleField = candidates.find(f => 
          f.name.toLowerCase().includes('name') || 
          f.label.toLowerCase().includes('name')
        ) || candidates[0]
        if (defaultTitleField) {
          setTitleFieldName(defaultTitleField.name)
        }
      }
      
      const settings = loadedForm.settings || {}
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
        
        // Load workflow actions, application groups (global), and stage groups (per stage)
        const [actionsData, groupsData, stageGroupsData] = await Promise.all([
          workflowsClient.listWorkflowActions(activeWorkflow.id),
          workflowsClient.listGroups(activeWorkflow.id),
          workflowsClient.listStageGroups(undefined, workspaceId) // Get all stage groups for this workspace
        ])
        setWorkflowActions(actionsData)
        setGroups(groupsData) // Application Groups - global, visible everywhere
        setStageGroups(stageGroupsData) // Stage Groups - visible only in their linked stage
        
        const stagesData = await workflowsClient.listStages(workspaceId, activeWorkflow.id)
        
        loadedStages = await Promise.all(
          stagesData.map(async (stage) => {
            let configs: StageReviewerConfig[] = []
            let actions: StageAction[] = []
            try {
              [configs, actions] = await Promise.all([
                workflowsClient.listStageConfigs(stage.id),
                workflowsClient.listStageActions(stage.id)
              ])
            } catch {}
            
            const primaryConfig = configs[0]
            // Priority: stage config rubric > assigned rubric > workflow default rubric
            let rubric: Rubric | null = null
            if (primaryConfig?.rubric_id) {
              rubric = allRubrics.find(r => r.id === primaryConfig.rubric_id) || null
            } else if (primaryConfig?.assigned_rubric_id) {
              rubric = allRubrics.find(r => r.id === primaryConfig.assigned_rubric_id) || null
            }
            // Fall back to workflow's default rubric
            if (!rubric && activeWorkflow.default_rubric_id) {
              rubric = allRubrics.find(r => r.id === activeWorkflow.default_rubric_id) || null
            }
            
            return {
              ...stage,
              reviewerConfigs: configs,
              rubric,
              applicationCount: 0,
              stageActions: actions
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
          workflowId: assignedWorkflowId,
          reviewHistory: (metadata.review_history || []) as ReviewHistoryEntry[]
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
      // If showing only unassigned, filter to apps without workflowId
      if (showOnlyUnassigned) {
        return !app.workflowId
      }
      
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
  }, [applications, selectedStageId, workflow, searchQuery, filterStatus, filterScoreMin, filterScoreMax, filterTags, filterReviewed, showOnlyUnassigned])

  // Register hub context for applications hub (after stageApps is defined)
  useEffect(() => {
    const hubContext: HubSearchContext = {
      hubType: 'applications',
      hubId: formId || undefined,
      hubName: 'Applications Hub',
      placeholder: 'Search applicants by name or email...',
      actions: [
        {
          id: 'filter-pending',
          label: 'Show pending applications',
          icon: Clock,
          action: () => {
            setFilterStatus('pending')
            setShowFilters(true)
          }
        },
        {
          id: 'filter-approved',
          label: 'Show approved applications',
          icon: CheckCircle,
          action: () => {
            setFilterStatus('approved')
            setShowFilters(true)
          }
        },
        {
          id: 'filter-unreviewed',
          label: 'Show unreviewed only',
          icon: Eye,
          action: () => {
            setFilterReviewed('unreviewed')
            setShowFilters(true)
          }
        },
        {
          id: 'start-review',
          label: 'Start reviewing',
          icon: Play,
          action: () => {
            if (stageApps.length > 0) {
              setSelectedAppIndex(0)
              setIsReviewMode(true)
              setTimerActive(true)
            }
          }
        },
        {
          id: 'assign-reviewers',
          label: 'Assign unassigned applications',
          icon: UserPlus,
          action: () => {
            setShowOnlyUnassigned(true)
          }
        },
        {
          id: 'refresh',
          label: 'Refresh applications',
          icon: RefreshCw,
          action: () => loadData()
        }
      ],
      onSearch: (query) => {
        setSearchQuery(query)
      }
    }

    // Only register hub context if search provider is available (internal mode)
    if (searchContext?.setHubContext) {
      searchContext.setHubContext(hubContext)
    }
    
    return () => {
      if (searchContext?.setHubContext) {
        searchContext.setHubContext(null)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formId, stageApps.length])

  // Current application
  const currentApp = stageApps[selectedAppIndex] || null
  const currentStage = stages.find(s => s.id === selectedStageId) || (currentApp ? stages.find(s => s.id === currentApp.stageId) : null)
  const currentRubric = currentStage?.rubric || null
  
  // PII settings from stage (read-only, configured in stage settings)
  // If hidden_pii_fields has entries, treat PII hiding as enabled (implied intent)
  const hiddenPIIFields = currentStage?.hidden_pii_fields || []
  const hidePII = currentStage?.hide_pii || hiddenPIIFields.length > 0

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

  const handleDeleteApplication = async (appId: string) => {
    if (!formId) return
    
    try {
      await formsClient.deleteSubmission(formId, appId)
      
      // Remove from local state
      setApplications(prev => prev.filter(app => app.id !== appId))
      
      // Update stage counts
      setStages(prev => prev.map(stage => ({
        ...stage,
        applicationCount: applications.filter(a => a.id !== appId && a.stageId === stage.id).length
      })))
      
      // Reset selection if deleted app was selected
      if (selectedAppIndex >= applications.length - 1) {
        setSelectedAppIndex(Math.max(0, selectedAppIndex - 1))
      }
    } catch (error) {
      console.error('Failed to delete application:', error)
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

  // Assign all unassigned applications to the first stage of the current workflow
  const handleAssignAllUnassigned = async () => {
    if (!formId || !workflow || stages.length === 0) return
    
    const firstStage = stages[0]
    const unassignedApps = applications.filter(a => !a.workflowId)
    
    if (unassignedApps.length === 0) return
    
    setIsAssigningUnassigned(true)
    try {
      const unassignedIds = unassignedApps.map(a => a.id)
      await workflowsClient.bulkAssignWorkflow(formId, unassignedIds, workflow.id, firstStage.id)
      
      setApplications(prev => prev.map(app => 
        !app.workflowId
          ? { ...app, workflowId: workflow.id, stageId: firstStage.id, stageName: firstStage.name }
          : app
      ))
      
      setShowOnlyUnassigned(false)
    } catch (error) {
      console.error('Failed to assign unassigned applications:', error)
    } finally {
      setIsAssigningUnassigned(false)
    }
  }

  const handleSaveAndNext = async () => {
    if (!currentApp || !formId) return
    setIsSaving(true)
    try {
      const totalScore = Object.values(editingScores).reduce((sum, val) => sum + (val || 0), 0)
      
      if (isExternalMode && token) {
        // External mode: use external review endpoint (no auth, uses token)
        await goClient.post(`/external-review/${token}/submit/${currentApp.id}`, {
          scores: editingScores,
          overall_comments: editingComments,
          status: 'in_review',
          is_draft: false
        })
      } else {
        // Internal mode: use authenticated endpoint
        await workflowsClient.updateReviewData(formId, currentApp.id, {
          scores: editingScores,
          comments: editingComments,
          status: 'in_review'
        })
      }
      
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

  const handleDecision = async (decision: string) => {
    if (!currentApp || !formId) return
    
    try {
      const totalScore = Object.values(editingScores).reduce((sum, val) => sum + (val || 0), 0)
      
      if (isExternalMode && token) {
        // External mode: submit via external review endpoint
        await goClient.post(`/external-review/${token}/submit/${currentApp.id}`, {
          scores: editingScores,
          overall_comments: editingComments,
          status: decision,
          is_draft: false
        })
      } else {
        // Internal mode: persist decision to backend
        await workflowsClient.updateReviewData(formId, currentApp.id, {
          decision,
          status: decision
        })
        
        // If approved and there's a next stage, optionally move to it (internal only)
        if (decision === 'approved') {
          const currentStageIndex = stages.findIndex(s => s.id === currentApp.stageId)
          if (currentStageIndex >= 0 && currentStageIndex < stages.length - 1) {
            const nextStage = stages[currentStageIndex + 1]
            await handleMoveToStage(currentApp.id, nextStage.id, 'Auto-advanced after approval')
          }
        }
      }
      
      setApplications(prev => prev.map(app => 
        app.id === currentApp.id
          ? { ...app, status: decision, score: totalScore }
          : app
      ))
      
      goToNext()
    } catch (error) {
      console.error('Failed to save decision:', error)
    }
  }

  // Execute a workflow or stage action
  const handleExecuteAction = async (action: WorkflowAction | StageAction, comment?: string) => {
    if (!currentApp || !formId) return
    
    const isWorkflowAction = 'review_workflow_id' in action
    
    try {
      // Execute the action via API
      await workflowsClient.executeAction({
        action_id: action.id,
        action_type: isWorkflowAction ? 'workflow_action' : 'stage_action',
        submission_id: currentApp.id,
        form_id: formId,
        comment
      })
      
      // Update local state based on action type
      if (action.action_type === 'move_to_group' && action.target_group_id) {
        const targetGroup = groups.find(g => g.id === action.target_group_id)
        setApplications(prev => prev.map(app => 
          app.id === currentApp.id
            ? { ...app, status: targetGroup?.name.toLowerCase() || 'moved', groupId: action.target_group_id }
            : app
        ))
      } else if (action.action_type === 'advance_stage' || action.action_type === 'move_to_stage') {
        const currentStageIndex = stages.findIndex(s => s.id === currentApp.stageId)
        if (currentStageIndex >= 0 && currentStageIndex < stages.length - 1) {
          const nextStage = stages[currentStageIndex + 1]
          await handleMoveToStage(currentApp.id, nextStage.id, 'Advanced via action')
        }
      } else if (action.action_type === 'set_status' && 'status_value' in action) {
        setApplications(prev => prev.map(app => 
          app.id === currentApp.id
            ? { ...app, status: action.status_value || action.name.toLowerCase() }
            : app
        ))
      }
      
      goToNext()
    } catch (error) {
      console.error('Failed to execute action:', error)
    }
  }

  const handleSelectRubric = async (rubricId: string) => {
    if (!currentStage) return
    
    try {
      // Update stage to use this rubric
      await workflowsClient.updateStage(currentStage.id, {
        rubric_id: rubricId
      } as any)
      
      // Update local state
      const selectedRubric = rubrics.find(r => r.id === rubricId)
      setStages(prev => prev.map(s => 
        s.id === currentStage.id
          ? { ...s, rubric: selectedRubric || null }
          : s
      ))
    } catch (error) {
      console.error('Failed to assign rubric:', error)
    }
  }

  const handleSectionComment = (sectionId: string, comment: string) => {
    if (!currentApp) return
    setSectionComments(prev => ({
      ...prev,
      [currentApp.id]: {
        ...(prev[currentApp.id] || {}),
        [sectionId]: comment
      }
    }))
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
          <p className="text-gray-500">
            {isExternalMode ? 'Loading your review session...' : 'Loading review workspace...'}
          </p>
        </div>
      </div>
    )
  }

  // External mode error
  if (isExternalMode && externalError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50">
        <div className="text-center max-w-md bg-white rounded-2xl shadow-xl p-8">
          <div className="w-20 h-20 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="w-10 h-10 text-red-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-3">Session Expired</h2>
          <p className="text-gray-600">
            {externalError}
          </p>
        </div>
      </div>
    )
  }

  if (!isExternalMode && (!workflow || stages.length === 0)) {
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
        availableRubrics={rubrics}
        scores={editingScores}
        comments={editingComments}
        timer={reviewTimer}
        timerActive={timerActive}
        isSaving={isSaving}
        form={form}
        titleFieldName={titleFieldName}
        setTitleFieldName={setTitleFieldName}
        showTitleFieldSelector={showTitleFieldSelector}
        setShowTitleFieldSelector={setShowTitleFieldSelector}
        collapsedSections={collapsedSections}
        setCollapsedSections={setCollapsedSections}
        hidePII={hidePII}
        hiddenPIIFields={hiddenPIIFields}
        sectionComments={sectionComments[currentApp.id] || {}}
        isExternalMode={isExternalMode}
        reviewerInfo={reviewerInfo}
        fieldVisibilityConfig={fieldVisibilityConfig}
        onScoreChange={(cat, val) => setEditingScores(p => ({ ...p, [cat]: val }))}
        onCommentsChange={setEditingComments}
        onToggleTimer={() => setTimerActive(!timerActive)}
        onSaveAndNext={handleSaveAndNext}
        onDecision={handleDecision}
        onSelectRubric={handleSelectRubric}
        onSectionComment={handleSectionComment}
        onPrev={goToPrev}
        onNext={goToNext}
        onExit={() => {
          // In external mode, don't allow exiting to dashboard
          if (!isExternalMode) {
            setIsReviewMode(false)
            setTimerActive(false)
          }
        }}
      />
    )
  }

  // Active filters count for badge
  const activeFiltersCount = [
    filterStatus !== 'all',
    filterReviewed !== 'all',
    filterScoreMin !== null,
    filterScoreMax !== null,
    filterTags.length > 0
  ].filter(Boolean).length

  return (
    <div className="h-full flex flex-col bg-gray-50 overflow-hidden">
      {/* Compact Header Bar - Workflow + Stats + Actions */}
      <div className="bg-white border-b border-gray-200">
        {/* Top row - Workflow selector and actions */}
        <div className="px-4 py-3 flex items-center justify-between gap-4">
          {/* Left side - Workflow Selector (internal only) or Reviewer info (external) */}
          <div className="flex items-center gap-3">
            {isExternalMode ? (
              /* External mode: show reviewer info */
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-lg">
                  <User className="w-4 h-4 text-blue-600" />
                  <span className="font-medium text-blue-900 text-sm">{reviewerInfo?.name || 'Reviewer'}</span>
                </div>
                {stages[0] && (
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-lg">
                    <span className="text-sm text-gray-600">Stage:</span>
                    <span className="font-medium text-gray-900 text-sm">{stages[0].name}</span>
                  </div>
                )}
              </div>
            ) : (
              /* Internal mode: Workflow Selector */
              <div className="relative">
                <button
                  onClick={() => setShowWorkflowSelector(!showWorkflowSelector)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-white hover:bg-gray-50 border border-gray-200 rounded-lg transition-colors"
                >
                  <Layers className="w-4 h-4 text-gray-500" />
                  <span className="font-medium text-gray-900 text-sm">{workflow?.name || 'Select Workflow'}</span>
                  <ChevronDown className={cn("w-3.5 h-3.5 text-gray-400 transition-transform", showWorkflowSelector && "rotate-180")} />
                </button>
                
                {showWorkflowSelector && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowWorkflowSelector(false)} />
                    <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl z-50 min-w-[200px] overflow-hidden">
                      <div className="max-h-64 overflow-y-auto py-1">
                        {workflows.map(wf => (
                          <button
                            key={wf.id}
                            onClick={() => handleSwitchWorkflow(wf)}
                            className={cn(
                              "w-full text-left px-3 py-2 flex items-center justify-between hover:bg-gray-50 transition-colors",
                              workflow?.id === wf.id && "bg-blue-50"
                            )}
                          >
                            <span className="font-medium text-gray-900 text-sm">{wf.name}</span>
                            <div className="flex items-center gap-2">
                              {wf.is_active && (
                                <span className="text-[10px] font-medium text-green-600 bg-green-50 px-1.5 py-0.5 rounded">Active</span>
                              )}
                              {workflow?.id === wf.id && <Check className="w-4 h-4 text-blue-600" />}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
            
            {/* View Toggle */}
            <div className="flex bg-gray-100 rounded-lg p-0.5">
              <button
                onClick={() => setViewMode('queue')}
                className={cn(
                  "px-3 py-1.5 rounded-md text-sm font-medium transition-all",
                  viewMode === 'queue' ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                )}
              >
                Queue
              </button>
              {/* Analytics tab - internal only */}
              {!isExternalMode && (
                <button
                  onClick={() => setViewMode('analytics')}
                  className={cn(
                    "px-3 py-1.5 rounded-md text-sm font-medium transition-all",
                    viewMode === 'analytics' ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                  )}
                >
                  Analytics
                </button>
              )}
            </div>

            {/* Contact Button - internal only */}
            {!isExternalMode && (
              <Button
                variant="outline"
                size="sm"
                onClick={setShowCommunicationsPanel}
                className="flex items-center gap-2"
              >
                <MessageSquare className="w-4 h-4" />
                Contact
              </Button>
            )}
          </div>
          
          {/* Right side - Stats summary + Actions */}
          <div className="flex items-center gap-4">
            {/* Inline Stats - Compact pills */}
            <div className="hidden md:flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-amber-50 text-amber-700 rounded-md text-xs font-medium">
                <Clock className="w-3 h-3" />
                {stats.pending}
              </span>
              <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-blue-50 text-blue-700 rounded-md text-xs font-medium">
                <Eye className="w-3 h-3" />
                {stats.inReview}
              </span>
              <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-green-50 text-green-700 rounded-md text-xs font-medium">
                <CheckCircle className="w-3 h-3" />
                {stats.approved}
              </span>
              <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-red-50 text-red-700 rounded-md text-xs font-medium">
                <X className="w-3 h-3" />
                {stats.rejected}
              </span>
            </div>
            
            {/* Divider */}
            <div className="h-6 w-px bg-gray-200 hidden md:block" />
            
            {/* Filter button with badge */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                showFilters || activeFiltersCount > 0
                  ? "bg-blue-50 text-blue-700 border border-blue-200"
                  : "text-gray-600 hover:bg-gray-100 border border-transparent"
              )}
            >
              <Filter className="w-4 h-4" />
              Filters
              {activeFiltersCount > 0 && (
                <span className="ml-1 w-5 h-5 bg-blue-600 text-white rounded-full text-xs flex items-center justify-center">
                  {activeFiltersCount}
                </span>
              )}
            </button>
            
            {/* Refresh */}
            <button
              onClick={loadData}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            
            {/* Start Review - Primary CTA */}
            {stageApps.length > 0 && (
              <Button onClick={startReview} size="sm" className="bg-blue-600 hover:bg-blue-700">
                <Play className="w-4 h-4 mr-1.5" />
                Review
              </Button>
            )}
          </div>
        </div>
        
        {/* Filters Panel - Slide down when active */}
        {showFilters && (
          <div className="px-4 pb-3 pt-1 border-t border-gray-100 bg-gray-50/50">
            <div className="flex flex-wrap items-end gap-3">
              {/* Status */}
              <div className="w-36">
                <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-sm"
                >
                  <option value="all">All</option>
                  <option value="pending">Pending</option>
                  <option value="in_review">In Review</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>

              {/* Review Status */}
              <div className="w-36">
                <label className="block text-xs font-medium text-gray-500 mb-1">Reviewed</label>
                <select
                  value={filterReviewed}
                  onChange={(e) => setFilterReviewed(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-sm"
                >
                  <option value="all">All</option>
                  <option value="reviewed">Yes</option>
                  <option value="unreviewed">No</option>
                </select>
              </div>

              {/* Score Range */}
              <div className="flex items-end gap-1.5">
                <div className="w-20">
                  <label className="block text-xs font-medium text-gray-500 mb-1">Score</label>
                  <input
                    type="number"
                    value={filterScoreMin ?? ''}
                    onChange={(e) => setFilterScoreMin(e.target.value ? parseInt(e.target.value) : null)}
                    placeholder="Min"
                    className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-sm"
                  />
                </div>
                <span className="text-gray-400 pb-2">–</span>
                <div className="w-20">
                  <input
                    type="number"
                    value={filterScoreMax ?? ''}
                    onChange={(e) => setFilterScoreMax(e.target.value ? parseInt(e.target.value) : null)}
                    placeholder="Max"
                    className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-sm"
                  />
                </div>
              </div>

              {/* Tags */}
              {allTags.length > 0 && (
                <div className="flex-1 min-w-[150px] max-w-xs">
                  <label className="block text-xs font-medium text-gray-500 mb-1">Tags</label>
                  <div className="flex flex-wrap gap-1 p-1.5 bg-white border border-gray-200 rounded-lg min-h-[32px]">
                    {allTags.slice(0, 5).map(tag => (
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
                          "px-2 py-0.5 text-xs rounded-full transition-all",
                          filterTags.includes(tag)
                            ? "bg-blue-100 text-blue-700"
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        )}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Clear */}
              {activeFiltersCount > 0 && (
                <button
                  onClick={() => {
                    setFilterStatus('all')
                    setFilterReviewed('all')
                    setFilterScoreMin(null)
                    setFilterScoreMax(null)
                    setFilterTags([])
                  }}
                  className="text-xs text-gray-500 hover:text-gray-700 underline pb-2"
                >
                  Clear all
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Slim Stage Sidebar */}
        <div className="w-14 bg-white border-r border-gray-100 flex flex-col items-center py-3 gap-1">
          {/* All stages */}
          <button
            onClick={() => {
              setSelectedStageId('all')
              setSelectedAppIndex(0)
              setShowOnlyUnassigned(false)
            }}
            className={cn(
              "w-10 h-10 rounded-xl flex flex-col items-center justify-center transition-all group relative",
              selectedStageId === 'all' && !showOnlyUnassigned
                ? "bg-blue-600 text-white shadow-md"
                : "text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            )}
            title="All Applications"
          >
            <Inbox className="w-5 h-5" />
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-gray-900 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
              {stats.total}
            </span>
          </button>
          
          {/* Unassigned */}
          {stats.unassigned > 0 && (
            <button
              onClick={() => {
                setShowOnlyUnassigned(!showOnlyUnassigned)
                setSelectedStageId('all')
                setSelectedAppIndex(0)
              }}
              className={cn(
                "w-10 h-10 rounded-xl flex flex-col items-center justify-center transition-all relative",
                showOnlyUnassigned
                  ? "bg-amber-500 text-white shadow-md"
                  : "text-amber-500 hover:bg-amber-50"
              )}
              title="Unassigned Applications"
            >
              <AlertCircle className="w-5 h-5" />
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-amber-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {stats.unassigned}
              </span>
            </button>
          )}
          
          <div className="w-6 h-px bg-gray-200 my-2" />
          
          {/* Stage indicators */}
          {stages.map((stage, idx) => {
            const count = applications.filter(a => a.stageId === stage.id).length
            const isActive = stage.id === selectedStageId && !showOnlyUnassigned
            const stageColorKey = ((stage as any).color as StageColorKey) || getDefaultStageColor(idx)
            const stageColor = STAGE_COLORS[stageColorKey]
            
            return (
              <button
                key={stage.id}
                onClick={() => {
                  setSelectedStageId(stage.id)
                  setSelectedAppIndex(0)
                  setShowOnlyUnassigned(false)
                }}
                className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold transition-all relative group",
                  isActive
                    ? `${stageColor.bg} text-white shadow-md`
                    : count > 0
                    ? `${stageColor.bgLight} ${stageColor.text} hover:opacity-80`
                    : `${stageColor.bgLight} ${stageColor.textLight} opacity-50`
                )}
                title={stage.name}
              >
                {idx + 1}
                {count > 0 && (
                  <span className={cn(
                    "absolute -top-1 -right-1 w-5 h-5 text-[10px] font-bold rounded-full flex items-center justify-center",
                    isActive ? "bg-white" : stageColor.bg,
                    isActive ? stageColor.text : "text-white"
                  )}>
                    {count}
                  </span>
                )}
                {/* Tooltip */}
                <span className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
                  {stage.name}
                </span>
              </button>
            )
          })}
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {viewMode === 'queue' && (
            <AccordionQueueView
              apps={stageApps}
              selectedIndex={selectedAppIndex}
              onSelect={(idx) => setSelectedAppIndex(idx)}
              onStartReview={startReview}
              currentApp={currentApp}
              stage={currentStage || undefined}
              rubric={currentRubric}
              form={form}
              titleFieldName={titleFieldName}
              hidePII={hidePII}
              hiddenPIIFields={hiddenPIIFields}
              stages={stages}
              onMoveToStage={handleMoveToStage}
              onDecision={handleDecision}
              onDelete={handleDeleteApplication}
              workflowActions={workflowActions}
              groups={groups}
              stageGroups={stageGroups}
              selectedStageGroupId={selectedStageGroupId}
              onSelectStageGroup={setSelectedStageGroupId}
              onExecuteAction={handleExecuteAction}
            />
          )}
          
          {viewMode === 'focus' && (
            <div className="flex-1 flex items-center justify-center bg-gray-50">
              {stageApps.length > 0 ? (
                <div className="text-center">
                  <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Target className="w-8 h-8 text-blue-600" />
                  </div>
                  <h2 className="text-lg font-bold text-gray-900 mb-2">Focus Mode</h2>
                  <p className="text-gray-500 mb-4 max-w-xs text-sm">
                    Review applications one by one with timer tracking.
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

          {viewMode === 'analytics' && !isExternalMode && (
            <AnalyticsView stats={stats} stages={stages} applications={applications} />
          )}
        </div>
      </div>

      {/* Reviewers Slide-over Panel - Internal mode only */}
      {!isExternalMode && showReviewersPanel && (
        <div className="fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/30 transition-opacity" 
            onClick={setShowReviewersPanel} 
          />
          
          {/* Panel */}
          <div className="absolute right-2 top-2 bottom-2 w-full max-w-2xl bg-white border border-gray-200 rounded-xl shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Users className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Team & Reviewers</h2>
                  <p className="text-sm text-gray-500">Manage review team for this workflow</p>
                </div>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={setShowReviewersPanel}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
            
            <div className="flex-1 overflow-y-auto">
              <ReviewerManagement formId={formId} workspaceId={workspaceId} />
            </div>
          </div>
        </div>
      )}

      {/* Communications Slide-over Panel - Internal mode only */}
      {!isExternalMode && showCommunicationsPanel && (
        <div className="fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/30 transition-opacity" 
            onClick={setShowCommunicationsPanel} 
          />
          
          {/* Panel */}
          <div className="absolute right-2 top-2 bottom-2 w-full max-w-3xl bg-white border border-gray-200 rounded-xl shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <MessageSquare className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Communications</h2>
                  <p className="text-sm text-gray-500">Send messages and manage templates</p>
                </div>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={setShowCommunicationsPanel}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
            
            <div className="flex-1 overflow-hidden">
              <CommunicationsCenter workspaceId={workspaceId} formId={formId} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// New Accordion Queue View - Clean single-column with expandable rows
function AccordionQueueView({
  apps,
  selectedIndex,
  onSelect,
  onStartReview,
  currentApp,
  stage,
  rubric,
  form,
  titleFieldName,
  hidePII,
  hiddenPIIFields,
  stages,
  onMoveToStage,
  onDecision,
  onDelete,
  workflowActions,
  groups,
  stageGroups,
  selectedStageGroupId,
  onSelectStageGroup,
  onExecuteAction
}: {
  apps: ApplicationData[]
  selectedIndex: number
  onSelect: (idx: number) => void
  onStartReview: () => void
  currentApp: ApplicationData | null
  stage?: StageWithConfig
  rubric: Rubric | null
  form?: Form | null
  titleFieldName?: string | null
  hidePII?: boolean
  hiddenPIIFields?: string[]
  stages?: StageWithConfig[]
  onMoveToStage?: (appId: string, stageId: string) => void
  onDecision?: (decision: string) => void
  onDelete?: (appId: string) => void
  workflowActions?: WorkflowAction[]
  groups?: ApplicationGroup[] // Application Groups - global
  stageGroups?: StageGroup[] // Stage Groups - for current stage only
  selectedStageGroupId?: string | null
  onSelectStageGroup?: (groupId: string | null) => void
  onExecuteAction?: (action: WorkflowAction | StageAction) => void
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'data' | 'reviews'>('data')
  const [sortBy, setSortBy] = useState<'recent' | 'oldest' | 'highest' | 'lowest'>('recent')

  // Get stage groups for current stage
  const currentStageGroups = useMemo(() => {
    if (!stage || !stageGroups) return []
    return stageGroups.filter(g => g.stage_id === stage.id)
  }, [stage, stageGroups])

  const sortedApps = useMemo(() => {
    const sorted = [...apps]
    switch (sortBy) {
      case 'recent':
        return sorted.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())
      case 'oldest':
        return sorted.sort((a, b) => new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime())
      case 'highest':
        return sorted.sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
      case 'lowest':
        return sorted.sort((a, b) => (a.score ?? 0) - (b.score ?? 0))
      default:
        return sorted
    }
  }, [apps, sortBy])

  const toggleExpand = (appId: string, idx: number) => {
    if (expandedId === appId) {
      setExpandedId(null)
    } else {
      setExpandedId(appId)
      onSelect(idx)
    }
  }

  if (apps.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Inbox className="w-8 h-8 text-gray-400" />
          </div>
          <p className="text-gray-600 font-medium">No applications found</p>
          <p className="text-sm text-gray-400 mt-1">Try adjusting your filters</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Stage Groups Filter Bar (only shown if stage has groups) */}
      {currentStageGroups.length > 0 && (
        <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 flex items-center gap-2 overflow-x-auto">
          <span className="text-xs text-gray-500 shrink-0">Filter:</span>
          <button
            onClick={() => onSelectStageGroup?.(null)}
            className={cn(
              "px-3 py-1 text-xs rounded-full border transition-colors shrink-0",
              selectedStageGroupId === null
                ? "bg-blue-100 border-blue-200 text-blue-700"
                : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
            )}
          >
            All ({apps.length})
          </button>
          {currentStageGroups.map(group => {
            // Count apps in this group - would need stage_group_id on apps
            const groupColors: Record<string, { bg: string; border: string; text: string }> = {
              blue: { bg: 'bg-blue-100', border: 'border-blue-200', text: 'text-blue-700' },
              green: { bg: 'bg-green-100', border: 'border-green-200', text: 'text-green-700' },
              yellow: { bg: 'bg-yellow-100', border: 'border-yellow-200', text: 'text-yellow-700' },
              orange: { bg: 'bg-orange-100', border: 'border-orange-200', text: 'text-orange-700' },
              red: { bg: 'bg-red-100', border: 'border-red-200', text: 'text-red-700' },
              purple: { bg: 'bg-purple-100', border: 'border-purple-200', text: 'text-purple-700' },
              gray: { bg: 'bg-gray-100', border: 'border-gray-200', text: 'text-gray-700' },
            }
            const colors = groupColors[group.color] || groupColors.gray
            
            return (
              <button
                key={group.id}
                onClick={() => onSelectStageGroup?.(group.id)}
                className={cn(
                  "px-3 py-1 text-xs rounded-full border transition-colors shrink-0 flex items-center gap-1.5",
                  selectedStageGroupId === group.id
                    ? `${colors.bg} ${colors.border} ${colors.text}`
                    : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                )}
              >
                <FolderOpen className="w-3 h-3" />
                {group.name}
              </button>
            )
          })}
        </div>
      )}

      {/* Sort bar */}
      <div className="px-4 py-2 bg-white border-b border-gray-100 flex items-center justify-between">
        <span className="text-sm text-gray-500">{apps.length} application{apps.length !== 1 ? 's' : ''}</span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">Sort:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="text-sm text-gray-700 bg-transparent border-none focus:ring-0 cursor-pointer pr-6"
          >
            <option value="recent">Most Recent</option>
            <option value="oldest">Oldest First</option>
            <option value="highest">Highest Score</option>
            <option value="lowest">Lowest Score</option>
          </select>
        </div>
      </div>

      {/* Application list with accordion */}
      <div className="flex-1 overflow-y-auto">
        <div className="divide-y divide-gray-100">
          {sortedApps.map((app, idx) => {
            const originalIdx = apps.findIndex(a => a.id === app.id)
            const isExpanded = expandedId === app.id
            const displayName = getApplicationDisplayName(app, titleFieldName || null, hidePII || false)
            
            
            return (
              <div key={app.id} className={cn("bg-white", isExpanded && "bg-gray-50")}>
                {/* Row header - always visible */}
                <button
                  onClick={() => toggleExpand(app.id, originalIdx)}
                  className={cn(
                    "w-full px-4 py-3 flex items-center gap-4 hover:bg-gray-50 transition-colors",
                    isExpanded && "bg-blue-50/50"
                  )}
                >
                  {/* Status indicator */}
                  <div className={cn(
                    "w-2 h-2 rounded-full shrink-0",
                    app.status === 'approved' && "bg-green-500",
                    app.status === 'rejected' && "bg-red-500",
                    app.status === 'in_review' && "bg-blue-500",
                    app.status === 'pending' && "bg-amber-500"
                  )} />
                  
                  {/* Avatar */}
                  <div className={cn(
                    "w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold shrink-0",
                    app.status === 'approved' ? "bg-green-100 text-green-700" :
                    app.status === 'rejected' ? "bg-red-100 text-red-700" :
                    app.status === 'in_review' ? "bg-blue-100 text-blue-700" :
                    "bg-gray-100 text-gray-600"
                  )}>
                    {hidePII ? '#' : displayName.charAt(0).toUpperCase()}
                  </div>
                  
                  {/* Name & email */}
                  <div className="flex-1 min-w-0 text-left">
                    <p className="font-medium text-gray-900 truncate">{displayName}</p>
                  </div>
                  
                  {/* Score */}
                  {app.score !== null && (
                    <div className="flex items-center gap-1.5 text-sm shrink-0">
                      <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                      <span className="font-semibold text-gray-900">{app.score}</span>
                      <span className="text-gray-400">/ {app.maxScore}</span>
                    </div>
                  )}
                  
                  {/* Reviews */}
                  <div className="flex items-center gap-1 text-xs text-gray-500 shrink-0">
                    <Users className="w-3.5 h-3.5" />
                    <span>{app.reviewCount}/{app.requiredReviews}</span>
                  </div>
                  
                  {/* Stage badge */}
                  <Badge className="bg-purple-50 text-purple-700 border-purple-100 text-xs shrink-0">
                    {app.stageName}
                  </Badge>
                  
                  {/* Expand icon */}
                  <ChevronDown className={cn(
                    "w-4 h-4 text-gray-400 transition-transform shrink-0",
                    isExpanded && "rotate-180"
                  )} />
                </button>
                
                {/* Expanded content */}
                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-gray-100">
                    {/* Action bar */}
                    <div className="py-3 flex items-center justify-between border-b border-gray-100">
                      {/* Tabs */}
                      <div className="flex gap-1">
                        <button
                          onClick={() => setActiveTab('data')}
                          className={cn(
                            "px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
                            activeTab === 'data' ? "bg-gray-900 text-white" : "text-gray-600 hover:bg-gray-100"
                          )}
                        >
                          Application
                        </button>
                        <button
                          onClick={() => setActiveTab('reviews')}
                          className={cn(
                            "px-3 py-1.5 text-sm font-medium rounded-md transition-colors flex items-center gap-1.5",
                            activeTab === 'reviews' ? "bg-gray-900 text-white" : "text-gray-600 hover:bg-gray-100"
                          )}
                        >
                          Reviews
                          {app.reviewHistory.length > 0 && (
                            <span className={cn(
                              "w-5 h-5 rounded-full text-xs flex items-center justify-center",
                              activeTab === 'reviews' ? "bg-white/20" : "bg-gray-200"
                            )}>
                              {app.reviewHistory.length}
                            </span>
                          )}
                        </button>
                      </div>
                      
                      {/* Quick actions */}
                      <div className="flex items-center gap-2">
                        {stages && stages.length > 1 && onMoveToStage && (
                          <select
                            value={app.stageId}
                            onChange={(e) => onMoveToStage(app.id, e.target.value)}
                            className="text-xs px-2 py-1 border border-gray-200 rounded-md bg-white"
                          >
                            {stages.map(s => (
                              <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                          </select>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={onStartReview}
                          className="text-xs h-7"
                        >
                          <Play className="w-3 h-3 mr-1" />
                          Review
                        </Button>
                        {onDelete && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation()
                              if (confirm('Are you sure you want to delete this application? This action cannot be undone.')) {
                                onDelete(app.id)
                              }
                            }}
                            className="text-xs h-7 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                    
                    {/* Tab content */}
                    <div className="pt-4 max-h-[400px] overflow-y-auto">
                      {activeTab === 'data' ? (
                        <div className="space-y-3">
                          {(() => {
                            // PII redaction helpers for accordion view
                            const isFieldHidden = (fieldId: string, fieldName?: string, fieldLabel?: string): boolean => {
                              if (!hidePII || !hiddenPIIFields || hiddenPIIFields.length === 0) return false
                              return hiddenPIIFields.includes(fieldId) || 
                                     (fieldName ? hiddenPIIFields.includes(fieldName) : false) || 
                                     (fieldLabel ? hiddenPIIFields.includes(fieldLabel) : false)
                            }
                            
                            // Collect PII values from hidden fields using form field definitions
                            const piiValues: string[] = (() => {
                              if (!hidePII || !hiddenPIIFields || hiddenPIIFields.length === 0) return []
                              if (!form?.fields) return []
                              
                              const values: string[] = []
                              form.fields.forEach(field => {
                                // Check if this field is in the hidden list (by id, name, or label)
                                if (hiddenPIIFields.includes(field.id) || 
                                    hiddenPIIFields.includes(field.name) || 
                                    (field.label && hiddenPIIFields.includes(field.label))) {
                                  const val = app.raw_data[field.name] || app.raw_data[field.label || '']
                                  if (val && typeof val === 'string' && val.trim().length >= 2) {
                                    values.push(val.trim())
                                    // Also add parts for names like "John Smith"
                                    const parts = val.trim().split(/[\s,]+/).filter((p: string) => p.length >= 2)
                                    values.push(...parts)
                                  }
                                }
                              })
                              return [...new Set(values)]
                            })()
                            
                            // Render value with PII redaction
                            const renderPIIValue = (fieldId: string, fieldName: string, fieldLabel: string | undefined, value: any) => {
                              // Check if this specific field is hidden
                              if (isFieldHidden(fieldId, fieldName, fieldLabel)) {
                                return (
                                  <span className="bg-gray-900 text-gray-900 rounded px-1 select-none cursor-help" title="Hidden for privacy">
                                    ████████████
                                  </span>
                                )
                              }
                              
                              // For string values, apply inline PII redaction
                              if (typeof value === 'string') {
                                if (piiValues.length > 0) {
                                  return <RedactedText text={value} piiValues={piiValues} />
                                }
                                return value
                              }
                              
                              return JSON.stringify(value)
                            }
                            
                            if (form?.fields && form.fields.length > 0) {
                              const { sections, ungroupedFields } = groupFieldsBySections(form.fields, form.settings)
                              const allFields = [...ungroupedFields, ...sections.flatMap(s => s.fields)]
                              
                              return allFields.slice(0, 8).map(field => {
                                const value = app.raw_data[field.name] || app.raw_data[field.label]
                                if (value === undefined || value === null || value === '') return null
                                
                                return (
                                  <div key={field.id} className="flex gap-3">
                                    <span className="text-xs font-medium text-gray-500 w-28 shrink-0 pt-0.5">
                                      {(field.label || field.name).replace(/_/g, ' ')}
                                    </span>
                                    <span className="text-sm text-gray-900 flex-1 min-w-0">
                                      {renderPIIValue(field.id, field.name, field.label, value)}
                                    </span>
                                  </div>
                                )
                              })
                            } else {
                              return Object.entries(app.raw_data).slice(0, 8).map(([key, value]) => {
                                if (key.startsWith('_') || key === 'id' || !value) return null
                                return (
                                  <div key={key} className="flex gap-3">
                                    <span className="text-xs font-medium text-gray-500 w-28 shrink-0 pt-0.5">
                                      {key.replace(/_/g, ' ')}
                                    </span>
                                    <span className="text-sm text-gray-900 flex-1 min-w-0">
                                      {renderPIIValue(key, key, key, value)}
                                    </span>
                                  </div>
                                )
                              })
                            }
                          })()}
                          <button className="text-xs text-blue-600 hover:text-blue-700 font-medium mt-2">
                            View full application →
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {app.reviewHistory.length > 0 ? (
                            app.reviewHistory.map((review, idx) => {
                              const total = review.total_score || Object.values(review.scores || {}).reduce((a, b) => a + (Number(b) || 0), 0)
                              return (
                                <div key={idx} className="flex items-start gap-3 p-3 bg-white rounded-lg border border-gray-100">
                                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white font-bold text-xs shrink-0">
                                    {(review.reviewer_name || 'R')[0].toUpperCase()}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between">
                                      <p className="font-medium text-gray-900 text-sm">{review.reviewer_name || `Reviewer ${idx + 1}`}</p>
                                      <span className="text-sm font-bold text-gray-900">{total} pts</span>
                                    </div>
                                    <p className="text-xs text-gray-500">
                                      {review.reviewed_at ? new Date(review.reviewed_at).toLocaleDateString() : 'No date'}
                                    </p>
                                    {(review.notes || review.comments) && (
                                      <p className="mt-2 text-sm text-gray-600 line-clamp-2">
                                        {review.notes || review.comments}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              )
                            })
                          ) : (
                            <div className="text-center py-6 text-gray-500">
                              <Users className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                              <p className="text-sm">No reviews yet</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    
                    {/* Decision footer */}
                    <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <Clock className="w-3.5 h-3.5" />
                        Submitted {new Date(app.submittedAt).toLocaleDateString()}
                      </div>
                      {/* Custom Status Actions Dropdown */}
                      {stage?.custom_statuses && stage.custom_statuses.length > 0 ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5">
                              <Zap className="w-3.5 h-3.5" />
                              Actions
                              <ChevronDown className="w-3.5 h-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            {stage.custom_statuses.map((status, idx) => {
                              const statusObj = typeof status === 'string' 
                                ? { name: status, color: 'gray', icon: 'circle' } 
                                : status
                              const statusColors: Record<string, string> = {
                                gray: 'text-gray-600',
                                red: 'text-red-600',
                                orange: 'text-orange-600',
                                yellow: 'text-yellow-600',
                                green: 'text-green-600',
                                blue: 'text-blue-600',
                                purple: 'text-purple-600',
                                pink: 'text-pink-600',
                              }
                              const colorClass = statusColors[statusObj.color] || statusColors.gray
                              
                              return (
                                <DropdownMenuItem
                                  key={idx}
                                  onClick={() => onExecuteAction?.({ 
                                    id: `status-${statusObj.name}`,
                                    name: statusObj.name,
                                    color: statusObj.color,
                                    action_type: 'set_status',
                                    status_value: statusObj.name
                                  } as any)}
                                  className={cn("cursor-pointer", colorClass)}
                                >
                                  {statusObj.icon === 'check' && <Check className="w-4 h-4 mr-2" />}
                                  {statusObj.icon === 'x' && <X className="w-4 h-4 mr-2" />}
                                  {statusObj.icon === 'clock' && <Clock className="w-4 h-4 mr-2" />}
                                  {statusObj.icon === 'arrow-right' && <ArrowRight className="w-4 h-4 mr-2" />}
                                  {!['check', 'x', 'clock', 'arrow-right'].includes(statusObj.icon || '') && (
                                    <Circle className="w-4 h-4 mr-2" />
                                  )}
                                  {statusObj.name}
                                </DropdownMenuItem>
                              )
                            })}
                            {groups && groups.length > 0 && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuLabel className="text-xs text-gray-500">Move to Group</DropdownMenuLabel>
                                {groups.map((group) => (
                                  <DropdownMenuItem
                                    key={group.id}
                                    onClick={() => onExecuteAction?.({
                                      id: `group-${group.id}`,
                                      name: `Move to ${group.name}`,
                                      color: group.color,
                                      action_type: 'move_to_group',
                                      target_group_id: group.id
                                    } as any)}
                                    className="cursor-pointer"
                                  >
                                    <Folder className="w-4 h-4 mr-2" />
                                    {group.name}
                                  </DropdownMenuItem>
                                ))}
                              </>
                            )}
                            {/* Stage Groups - visible only in this stage */}
                            {currentStageGroups && currentStageGroups.length > 0 && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuLabel className="text-xs text-gray-500">Move to Stage Group</DropdownMenuLabel>
                                {currentStageGroups.map((group) => (
                                  <DropdownMenuItem
                                    key={group.id}
                                    onClick={() => onExecuteAction?.({
                                      id: `stage-group-${group.id}`,
                                      name: `Move to ${group.name}`,
                                      color: group.color,
                                      action_type: 'move_to_stage_group',
                                      target_stage_group_id: group.id
                                    } as any)}
                                    className="cursor-pointer"
                                  >
                                    <FolderOpen className="w-4 h-4 mr-2" />
                                    {group.name}
                                  </DropdownMenuItem>
                                ))}
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : (stage?.stageActions?.length || workflowActions?.length || onDecision) ? (
                        <div className="flex items-center gap-2">
                          {/* Stage-specific actions */}
                          {stage?.stageActions?.map((action) => {
                            const actionColors: Record<string, { bg: string, text: string, border: string, hover: string }> = {
                              gray: { bg: 'bg-gray-600', text: 'text-gray-600', border: 'border-gray-200', hover: 'hover:bg-gray-50' },
                              red: { bg: 'bg-red-600', text: 'text-red-600', border: 'border-red-200', hover: 'hover:bg-red-50' },
                              orange: { bg: 'bg-orange-600', text: 'text-orange-600', border: 'border-orange-200', hover: 'hover:bg-orange-50' },
                              yellow: { bg: 'bg-yellow-600', text: 'text-yellow-600', border: 'border-yellow-200', hover: 'hover:bg-yellow-50' },
                              green: { bg: 'bg-green-600', text: 'text-green-600', border: 'border-green-200', hover: 'hover:bg-green-50' },
                              blue: { bg: 'bg-blue-600', text: 'text-blue-600', border: 'border-blue-200', hover: 'hover:bg-blue-50' },
                              purple: { bg: 'bg-purple-600', text: 'text-purple-600', border: 'border-purple-200', hover: 'hover:bg-purple-50' },
                              pink: { bg: 'bg-pink-600', text: 'text-pink-600', border: 'border-pink-200', hover: 'hover:bg-pink-50' },
                            }
                            const colors = actionColors[action.color] || actionColors.gray
                            const isPositive = action.action_type === 'advance_stage' || action.color === 'green'
                            
                            return (
                              <Button
                                key={action.id}
                                size="sm"
                                variant={isPositive ? "default" : "outline"}
                                onClick={() => onExecuteAction?.(action)}
                                className={cn(
                                  "h-8 text-xs",
                                  isPositive 
                                    ? `${colors.bg} hover:opacity-90 text-white` 
                                    : `${colors.text} ${colors.border} ${colors.hover}`
                                )}
                              >
                                {action.name}
                              </Button>
                            )
                          })}
                          
                          {/* Workflow-level actions */}
                          {workflowActions?.map((action) => {
                            const actionColors: Record<string, { bg: string, text: string, border: string, hover: string }> = {
                              gray: { bg: 'bg-gray-600', text: 'text-gray-600', border: 'border-gray-200', hover: 'hover:bg-gray-50' },
                              red: { bg: 'bg-red-600', text: 'text-red-600', border: 'border-red-200', hover: 'hover:bg-red-50' },
                              orange: { bg: 'bg-orange-600', text: 'text-orange-600', border: 'border-orange-200', hover: 'hover:bg-orange-50' },
                              yellow: { bg: 'bg-yellow-600', text: 'text-yellow-600', border: 'border-yellow-200', hover: 'hover:bg-yellow-50' },
                              green: { bg: 'bg-green-600', text: 'text-green-600', border: 'border-green-200', hover: 'hover:bg-green-50' },
                              blue: { bg: 'bg-blue-600', text: 'text-blue-600', border: 'border-blue-200', hover: 'hover:bg-blue-50' },
                              purple: { bg: 'bg-purple-600', text: 'text-purple-600', border: 'border-purple-200', hover: 'hover:bg-purple-50' },
                              pink: { bg: 'bg-pink-600', text: 'text-pink-600', border: 'border-pink-200', hover: 'hover:bg-pink-50' },
                            }
                            const colors = actionColors[action.color] || actionColors.gray
                            const isPositive = action.action_type === 'move_to_stage' || action.color === 'green'
                            
                            return (
                              <Button
                                key={action.id}
                                size="sm"
                                variant={isPositive ? "default" : "outline"}
                                onClick={() => onExecuteAction?.(action)}
                                className={cn(
                                  "h-8 text-xs",
                                  isPositive 
                                    ? `${colors.bg} hover:opacity-90 text-white` 
                                    : `${colors.text} ${colors.border} ${colors.hover}`
                                )}
                              >
                                {action.name}
                              </Button>
                            )
                          })}
                          
                          {/* Fallback to legacy approve/reject if no custom actions */}
                          {!stage?.stageActions?.length && !workflowActions?.length && onDecision && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => onDecision('rejected')}
                                className="text-red-600 border-red-200 hover:bg-red-50 h-8 text-xs"
                              >
                                <ThumbsDown className="w-3.5 h-3.5 mr-1" />
                                Reject
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => onDecision('approved')}
                                className="bg-green-600 hover:bg-green-700 h-8 text-xs"
                              >
                                <ThumbsUp className="w-3.5 h-3.5 mr-1" />
                                Approve
                              </Button>
                            </>
                          )}
                        </div>
                      ) : null}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
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
  rubric,
  showFilters,
  onToggleFilters,
  onRefresh,
  hasActiveFilters,
  form,
  titleFieldName,
  hidePII,
  hiddenPIIFields,
  stages,
  onMoveToStage
}: {
  apps: ApplicationData[]
  selectedIndex: number
  onSelect: (idx: number) => void
  onStartReview: () => void
  currentApp: ApplicationData | null
  stage?: StageWithConfig
  rubric: Rubric | null
  showFilters?: boolean
  onToggleFilters?: () => void
  onRefresh?: () => void
  hasActiveFilters?: boolean
  form?: Form | null
  titleFieldName?: string | null
  hidePII?: boolean
  hiddenPIIFields?: string[]
  stages?: StageWithConfig[]
  onMoveToStage?: (appId: string, stageId: string) => void
}) {
  const [sortDropdownOpen, setSortDropdownOpen] = useState(false)
  const [sortBy, setSortBy] = useState<'recent' | 'oldest' | 'highest' | 'lowest'>('recent')
  const [previewTab, setPreviewTab] = useState<'data' | 'reviews'>('data')

  const sortedApps = useMemo(() => {
    const sorted = [...apps]
    switch (sortBy) {
      case 'recent':
        return sorted.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())
      case 'oldest':
        return sorted.sort((a, b) => new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime())
      case 'highest':
        return sorted.sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
      case 'lowest':
        return sorted.sort((a, b) => (a.score ?? 0) - (b.score ?? 0))
      default:
        return sorted
    }
  }, [apps, sortBy])

  const sortLabels = {
    recent: 'Most Recent',
    oldest: 'Oldest First',
    highest: 'Highest Score',
    lowest: 'Lowest Score'
  }

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Application List */}
      <div className="w-96 border-r border-gray-200 flex flex-col bg-gray-50">
        <div className="p-4 border-b border-gray-200 bg-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
              <Users className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">{apps.length} Applications</h3>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {/* Sort & Filter Dropdown */}
            <div className="relative">
              <button
                onClick={() => setSortDropdownOpen(!sortDropdownOpen)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border transition-colors",
                  hasActiveFilters 
                    ? "bg-blue-50 border-blue-200 text-blue-700" 
                    : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
                )}
              >
                <Filter className="w-3.5 h-3.5" />
                <span>{sortLabels[sortBy]}</span>
                {hasActiveFilters && <span className="w-1.5 h-1.5 bg-blue-500 rounded-full" />}
                <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", sortDropdownOpen && "rotate-180")} />
              </button>
              
              {sortDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setSortDropdownOpen(false)} />
                  <div className="absolute right-0 mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-1">
                    <div className="px-3 py-1.5 text-xs font-medium text-gray-400 uppercase tracking-wider">Sort by</div>
                    {(['recent', 'oldest', 'highest', 'lowest'] as const).map((option) => (
                      <button
                        key={option}
                        onClick={() => {
                          setSortBy(option)
                          setSortDropdownOpen(false)
                        }}
                        className={cn(
                          "w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center justify-between",
                          sortBy === option && "text-blue-600 bg-blue-50"
                        )}
                      >
                        {sortLabels[option]}
                        {sortBy === option && <CheckCircle className="w-3.5 h-3.5" />}
                      </button>
                    ))}
                    
                    <div className="border-t border-gray-100 my-1" />
                    <div className="px-3 py-1.5 text-xs font-medium text-gray-400 uppercase tracking-wider">Filters</div>
                    <button
                      onClick={() => {
                        onToggleFilters?.()
                        setSortDropdownOpen(false)
                      }}
                      className={cn(
                        "w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2",
                        showFilters && "text-blue-600 bg-blue-50"
                      )}
                    >
                      <Settings2 className="w-3.5 h-3.5" />
                      Advanced Filters
                      {hasActiveFilters && <span className="ml-auto w-1.5 h-1.5 bg-blue-500 rounded-full" />}
                    </button>
                  </div>
                </>
              )}
            </div>
            
            {/* PII Status Indicator - Now controlled by stage settings */}
            {hidePII && (
              <div 
                className="flex items-center gap-1.5 px-2 py-1 bg-amber-100 text-amber-700 rounded-lg"
                title={`Privacy Mode enabled for this stage. ${hiddenPIIFields?.length || 0} field(s) hidden.`}
              >
                <EyeOff className="w-4 h-4" />
                <span className="text-xs font-medium">PII Hidden</span>
              </div>
            )}
            
            {/* Refresh Button */}
            <button
              onClick={onRefresh}
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {sortedApps.map((app, idx) => {
            const originalIdx = apps.findIndex(a => a.id === app.id)
            const isSelected = originalIdx === selectedIndex
            const displayName = getApplicationDisplayName(app, titleFieldName || null, hidePII || false)
          
            
            return (
            <button
              key={app.id}
              onClick={() => onSelect(originalIdx)}
              className={cn(
                "w-full text-left p-4 rounded-xl transition-all border",
                isSelected 
                  ? "bg-white border-blue-200 shadow-md ring-1 ring-blue-100" 
                  : "bg-white border-gray-100 hover:border-gray-200 hover:shadow-sm"
              )}
            >
              <div className="flex items-start gap-3">
                <div className={cn(
                  "w-11 h-11 rounded-xl flex items-center justify-center text-sm font-bold shrink-0 shadow-sm",
                  app.status === 'approved' ? "bg-gradient-to-br from-green-400 to-green-500 text-white" :
                  app.status === 'rejected' ? "bg-gradient-to-br from-red-400 to-red-500 text-white" :
                  app.status === 'in_review' ? "bg-gradient-to-br from-blue-400 to-blue-500 text-white" :
                  "bg-gradient-to-br from-gray-100 to-gray-200 text-gray-600"
                )}>
                  {hidePII ? '#' : displayName.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className={cn(
                      "font-semibold truncate",
                      isSelected ? "text-blue-900" : "text-gray-900"
                    )}>{displayName}</p>
                    {app.flagged && <Flag className="w-3.5 h-3.5 text-red-500 shrink-0" />}
                  </div>
                  <p className="text-xs text-gray-500 truncate mt-0.5">{displayEmail}</p>
                  <div className="flex items-center gap-2 mt-2.5 flex-wrap">
                    {app.stageName && (
                      <Badge className={cn(
                        "text-xs font-medium px-2 py-0.5",
                        isSelected 
                          ? "bg-blue-100 text-blue-700 border-blue-200"
                          : "bg-purple-50 text-purple-700 border-purple-100"
                      )}>
                        {app.stageName}
                      </Badge>
                    )}
                    {app.score !== null && (
                      <span className="flex items-center gap-1 text-xs font-medium text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                        <Star className="w-3 h-3 fill-current" />
                        {app.score}/{app.maxScore}
                      </span>
                    )}
                    <span className="flex items-center gap-1 text-xs text-gray-500 bg-gray-50 px-1.5 py-0.5 rounded">
                      <Users className="w-3 h-3" />
                      {app.reviewCount}/{app.requiredReviews}
                    </span>
                  </div>
                </div>
              </div>
            </button>
          )})}
          
          {sortedApps.length === 0 && (
            <div className="p-8 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Inbox className="w-8 h-8 text-gray-400" />
              </div>
              <p className="text-gray-600 font-medium">No applications yet</p>
              <p className="text-sm text-gray-400 mt-1">Applications will appear here</p>
            </div>
          )}
        </div>
      </div>

      {/* Preview Panel */}
      <div className="flex-1 flex flex-col bg-gray-50 min-w-0">
        {currentApp ? (
          <>
            {/* Header */}
            <div className="px-8 py-6 border-b border-gray-200 bg-white">
              <div className="flex items-center justify-between gap-6">
                <div className="min-w-0">
                  <h2 className="text-2xl font-bold text-gray-900">
                    {getApplicationDisplayName(currentApp, titleFieldName || null, hidePII || false)}
                  </h2>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {/* Stage Selector for Admin */}
                  {stages && stages.length > 0 && onMoveToStage && (
                    <div className="relative">
                      <select
                        value={currentApp.stageId}
                        onChange={(e) => onMoveToStage(currentApp.id, e.target.value)}
                        className="appearance-none bg-white border border-gray-300 rounded-lg px-4 py-2.5 pr-10 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 cursor-pointer"
                      >
                        {stages.map(s => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                    </div>
                  )}
                  <Button onClick={onStartReview} size="lg" className="bg-blue-600 hover:bg-blue-700 px-6">
                    <Play className="w-4 h-4 mr-2" />
                    Start Review
                  </Button>
                </div>
              </div>
              
              {/* Status & Score Row */}
              <div className="flex items-center gap-5 mt-5 flex-wrap">
                <Badge className={cn(
                  "capitalize text-sm px-3 py-1.5",
                  currentApp.status === 'approved' && "bg-green-100 text-green-700 border-green-200",
                  currentApp.status === 'rejected' && "bg-red-100 text-red-700 border-red-200",
                  currentApp.status === 'in_review' && "bg-blue-100 text-blue-700 border-blue-200",
                  currentApp.status === 'pending' && "bg-amber-100 text-amber-700 border-amber-200"
                )}>
                  {currentApp.status.replace('_', ' ')}
                </Badge>
                
                {currentApp.score !== null && (
                  <div className="flex items-center gap-3">
                    <div className="w-36 h-2.5 bg-gray-200 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full"
                        style={{ width: `${Math.min((currentApp.score / currentApp.maxScore) * 100, 100)}%` }}
                      />
                    </div>
                    <span className="text-sm font-semibold text-gray-900">{currentApp.score}/{currentApp.maxScore}</span>
                  </div>
                )}
                
                <div className="flex items-center gap-1.5 text-sm text-gray-500">
                  <Users className="w-4 h-4" />
                  <span>{currentApp.reviewCount}/{currentApp.requiredReviews} reviews</span>
                </div>
                
                <span className="text-sm text-gray-500 flex items-center gap-1.5">
                  <Clock className="w-4 h-4" />
                  Submitted {new Date(currentApp.submittedAt).toLocaleDateString()}
                </span>
              </div>
            </div>

            {/* Tab Navigation */}
            <div className="px-8 py-4 bg-white border-b border-gray-200">
              <div className="flex gap-2">
                <button
                  onClick={() => setPreviewTab('data')}
                  className={cn(
                    "px-5 py-2.5 text-sm font-medium rounded-lg transition-colors",
                    previewTab === 'data'
                      ? "bg-blue-100 text-blue-700"
                      : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                  )}
                >
                  <FileText className="w-4 h-4 inline-block mr-2" />
                  Application Data
                </button>
                <button
                  onClick={() => setPreviewTab('reviews')}
                  className={cn(
                    "px-5 py-2.5 text-sm font-medium rounded-lg transition-colors flex items-center gap-2",
                    previewTab === 'reviews'
                      ? "bg-blue-100 text-blue-700"
                      : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                  )}
                >
                  <MessageSquare className="w-4 h-4" />
                  Reviews
                  {currentApp.reviewHistory.length > 0 && (
                    <span className={cn(
                      "px-2 py-0.5 text-xs rounded-full",
                      previewTab === 'reviews' ? "bg-blue-200 text-blue-800" : "bg-gray-200 text-gray-700"
                    )}>
                      {currentApp.reviewHistory.length}
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto px-8 py-6">
              {previewTab === 'data' ? (
                <>
                  {/* Application Data Tab */}
                  {form?.fields && form.fields.length > 0 ? (
                    <div className="space-y-8">
                      {(() => {
                        const { sections, ungroupedFields } = groupFieldsBySections(form.fields, form.settings)
                        
                        // Helper to check if a field is redacted - checks id, name, and label
                        const isFieldHidden = (field: { id: string; name: string; label?: string }) => {
                          if (!hidePII || !hiddenPIIFields || hiddenPIIFields.length === 0) return false
                          return hiddenPIIFields.includes(field.id) || 
                                 hiddenPIIFields.includes(field.name) || 
                                 (field.label && hiddenPIIFields.includes(field.label))
                        }
                        
                        // Get PII values to redact from hidden fields (including name parts)
                        const piiValuesToRedact: string[] = (() => {
                          const values: string[] = []
                          form.fields.filter(f => isFieldHidden(f)).forEach(f => {
                            const val = currentApp.raw_data[f.name] || currentApp.raw_data[f.label || '']
                            if (typeof val === 'string' && val.trim().length >= 2) {
                              values.push(val.trim())
                              // Also add parts for names like "John Smith"
                              const parts = val.trim().split(/[\s,]+/).filter((p: string) => p.length >= 2)
                              values.push(...parts)
                            }
                          })
                          return [...new Set(values)]
                        })()
                        
                        // Helper to render field value with PII redaction
                        const renderWithPII = (field: { id: string; name: string; label?: string }, value: any) => {
                          // If this field is marked for hiding, show redacted
                          if (isFieldHidden(field)) {
                            return (
                              <span className="bg-gray-900 text-gray-900 rounded px-2 py-0.5 select-none cursor-help" title="Hidden for privacy">
                                ████████████████
                              </span>
                            )
                          }
                          
                          // If it's a string and PII mode is on, redact matching PII values
                          if (hidePII && typeof value === 'string' && piiValuesToRedact.length > 0) {
                            return <RedactedText text={value} piiValues={piiValuesToRedact} />
                          }
                          
                          return renderFieldValue(field.name, value)
                        }
                        
                        return (
                          <>
                            {/* Ungrouped fields */}
                            {ungroupedFields.length > 0 && (
                              <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
                                <div className="divide-y divide-gray-100">
                                  {ungroupedFields.map(field => {
                                    const value = currentApp.raw_data[field.name] || currentApp.raw_data[field.label]
                                    if (value === undefined || value === null || value === '') return null
                                    
                                    return (
                                      <div key={field.id} className="px-6 py-5">
                                        <p className="text-xs font-bold text-indigo-600 uppercase tracking-wider mb-3">
                                          {field.label || field.name.replace(/_/g, ' ')}
                                        </p>
                                        <div className="text-gray-800 text-[15px] leading-relaxed">{renderWithPII(field, value)}</div>
                                      </div>
                                    )
                                  })}
                                </div>
                              </div>
                            )}
                            
                            {/* Sections */}
                            {sections.map(section => {
                              const hasData = section.fields.some(f => {
                                const val = currentApp.raw_data[f.name] || currentApp.raw_data[f.label]
                                return val !== undefined && val !== null && val !== ''
                              })
                              
                              if (!hasData) return null
                              
                              return (
                                <div key={section.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                                  <div className="px-6 py-4 bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
                                    <span className="text-base font-bold text-gray-800">{section.name}</span>
                                  </div>
                                  <div className="divide-y divide-gray-100">
                                    {section.fields.map(field => {
                                      const value = currentApp.raw_data[field.name] || currentApp.raw_data[field.label]
                                      if (value === undefined || value === null || value === '') return null
                                      
                                      return (
                                        <div key={field.id} className="px-6 py-5">
                                          <p className="text-xs font-bold text-indigo-600 uppercase tracking-wider mb-3">
                                            {field.label || field.name.replace(/_/g, ' ')}
                                          </p>
                                          <div className="text-gray-800 text-[15px] leading-relaxed">{renderWithPII(field, value)}</div>
                                        </div>
                                      )
                                    })}
                                  </div>
                                </div>
                              )
                            })}
                          </>
                        )
                      })()}
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {(() => {
                        // Fallback PII redaction for forms without field definitions
                        const isFieldHidden = (key: string): boolean => {
                          if (!hidePII || !hiddenPIIFields || hiddenPIIFields.length === 0) return false
                          return hiddenPIIFields.includes(key)
                        }
                        
                        // Collect PII values from hidden fields
                        const piiValuesToRedact: string[] = hidePII && hiddenPIIFields && hiddenPIIFields.length > 0
                          ? hiddenPIIFields.flatMap(fieldName => {
                              const val = currentApp.raw_data[fieldName]
                              if (val && typeof val === 'string' && val.trim().length >= 2) {
                                const parts = val.trim().split(/[\s,]+/).filter(p => p.length >= 2)
                                return [val.trim(), ...parts]
                              }
                              return []
                            }).filter((v, i, arr) => arr.indexOf(v) === i)
                          : []
                        
                        return Object.entries(currentApp.raw_data).map(([key, value]) => {
                          if (key.startsWith('_') || key === 'id') return null
                          
                          // Check if this field is hidden
                          if (isFieldHidden(key)) {
                            return (
                              <div key={key} className="bg-white rounded-xl px-6 py-5 border border-gray-200 shadow-sm">
                                <p className="text-xs font-bold text-indigo-600 uppercase tracking-wider mb-3">
                                  {key.replace(/_/g, ' ')}
                                </p>
                                <div className="text-gray-800 text-[15px] leading-relaxed">
                                  <span className="bg-gray-900 text-gray-900 rounded px-2 py-0.5 select-none cursor-help" title="Hidden for privacy">
                                    ████████████████
                                  </span>
                                </div>
                              </div>
                            )
                          }
                          
                          // Apply inline PII redaction if applicable
                          const renderValue = () => {
                            if (typeof value === 'string' && piiValuesToRedact.length > 0) {
                              return <RedactedText text={value} piiValues={piiValuesToRedact} />
                            }
                            return renderFieldValue(key, value)
                          }
                          
                          return (
                            <div key={key} className="bg-white rounded-xl px-6 py-5 border border-gray-200 shadow-sm">
                              <p className="text-xs font-bold text-indigo-600 uppercase tracking-wider mb-3">
                                {key.replace(/_/g, ' ')}
                              </p>
                              <div className="text-gray-800 text-[15px] leading-relaxed">{renderValue()}</div>
                            </div>
                          )
                        })
                      })()}
                    </div>
                  )}
                  
                  {rubric && (
                    <div className="mt-10">
                      <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4">Scoring Rubric</h3>
                      <div className="bg-white rounded-xl px-6 py-5 border border-gray-200 shadow-sm">
                        <p className="font-semibold text-gray-900 text-lg mb-2">{rubric.name}</p>
                        <p className="text-gray-600 mb-4">{rubric.description}</p>
                        <div className="flex items-center gap-2 text-blue-600">
                          <Award className="w-5 h-5" />
                          <span className="font-medium">Max Score: {rubric.max_score}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                /* Reviews Tab */
                <div className="space-y-6">
                  {currentApp.reviewHistory.length > 0 ? (
                    <>
                      {/* Score Summary */}
                      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                        <div className="px-5 py-3 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-200">
                          <h3 className="text-sm font-bold text-gray-800">Score Summary</h3>
                        </div>
                        <div className="p-5">
                          {/* Overall Average */}
                          <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-100">
                            <div>
                              <p className="text-sm font-medium text-gray-500">Overall Average</p>
                              <p className="text-3xl font-bold text-gray-900">
                                {(() => {
                                  const allTotals = currentApp.reviewHistory
                                    .map(r => r.total_score || Object.values(r.scores || {}).reduce((a, b) => a + (Number(b) || 0), 0))
                                    .filter(t => t > 0)
                                  if (allTotals.length === 0) return 'N/A'
                                  return (allTotals.reduce((a, b) => a + b, 0) / allTotals.length).toFixed(1)
                                })()}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-medium text-gray-500">Reviews Completed</p>
                              <p className="text-3xl font-bold text-gray-900">{currentApp.reviewHistory.length}</p>
                            </div>
                          </div>
                          
                          {/* Per-Reviewer Scores */}
                          <div className="space-y-4">
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Individual Scores</p>
                            {currentApp.reviewHistory.map((review, idx) => {
                              const total = review.total_score || Object.values(review.scores || {}).reduce((a, b) => a + (Number(b) || 0), 0)
                              return (
                                <div key={idx} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white font-bold text-sm">
                                    {(review.reviewer_name || 'R')[0].toUpperCase()}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="font-medium text-gray-900 truncate">{review.reviewer_name || `Reviewer ${idx + 1}`}</p>
                                    <p className="text-xs text-gray-500">
                                      {review.reviewed_at ? new Date(review.reviewed_at).toLocaleDateString() : 'No date'}
                                    </p>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-lg font-bold text-gray-900">{total}</p>
                                    <p className="text-xs text-gray-500">points</p>
                                  </div>
                                </div>
                              )
                            })}
                          </div>

                          {/* Category Breakdown */}
                          {rubric?.categories && rubric.categories.length > 0 && (
                            <div className="mt-6 pt-4 border-t border-gray-100">
                              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Category Averages</p>
                              <div className="space-y-3">
                                {rubric.categories.map((category: { id: string; name: string; max_points: number }) => {
                                  const scores = currentApp.reviewHistory
                                    .map(r => r.scores?.[category.id] || r.scores?.[category.name])
                                    .filter((s): s is number => typeof s === 'number')
                                  const avg = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0
                                  
                                  return (
                                    <div key={category.id} className="flex items-center gap-3">
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between mb-1">
                                          <p className="text-sm font-medium text-gray-700 truncate">{category.name}</p>
                                          <p className="text-sm font-semibold text-gray-900">{avg.toFixed(1)}/{category.max_points}</p>
                                        </div>
                                        <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                                          <div 
                                            className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full"
                                            style={{ width: `${Math.min((avg / category.max_points) * 100, 100)}%` }}
                                          />
                                        </div>
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Reviewer Comments */}
                      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                        <div className="px-5 py-3 bg-gradient-to-r from-amber-50 to-orange-50 border-b border-gray-200">
                          <h3 className="text-sm font-bold text-gray-800">Reviewer Comments</h3>
                        </div>
                        <div className="divide-y divide-gray-100">
                          {currentApp.reviewHistory.filter(r => r.notes || r.comments || (r.criteria_comments && Object.keys(r.criteria_comments).length > 0)).length > 0 ? (
                            currentApp.reviewHistory.map((review, idx) => {
                              const hasComments = review.notes || review.comments || (review.criteria_comments && Object.keys(review.criteria_comments).length > 0)
                              if (!hasComments) return null
                              
                              return (
                                <div key={idx} className="p-5">
                                  <div className="flex items-center gap-3 mb-3">
                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white font-bold text-sm">
                                      {(review.reviewer_name || 'R')[0].toUpperCase()}
                                    </div>
                                    <div>
                                      <p className="font-medium text-gray-900">{review.reviewer_name || `Reviewer ${idx + 1}`}</p>
                                      <p className="text-xs text-gray-500">
                                        {review.reviewed_at ? new Date(review.reviewed_at).toLocaleDateString() : ''}
                                      </p>
                                    </div>
                                  </div>
                                  
                                  {/* General notes/comments */}
                                  {(review.notes || review.comments) && (
                                    <div className="bg-gray-50 rounded-lg p-4 mb-3">
                                      <p className="text-gray-800 text-sm leading-relaxed whitespace-pre-wrap">
                                        {review.notes || review.comments}
                                      </p>
                                    </div>
                                  )}
                                  
                                  {/* Category-specific comments */}
                                  {review.criteria_comments && Object.keys(review.criteria_comments).length > 0 && (
                                    <div className="space-y-2 mt-3">
                                      {Object.entries(review.criteria_comments).map(([categoryId, comment]) => {
                                        if (!comment) return null
                                        const category = rubric?.categories?.find((c: { id: string; name: string }) => c.id === categoryId || c.name === categoryId)
                                        return (
                                          <div key={categoryId} className="bg-blue-50 rounded-lg p-3">
                                            <p className="text-xs font-semibold text-blue-700 mb-1">
                                              {category?.name || categoryId}
                                            </p>
                                            <p className="text-gray-700 text-sm">{comment}</p>
                                          </div>
                                        )
                                      })}
                                    </div>
                                  )}
                                </div>
                              )
                            })
                          ) : (
                            <div className="p-8 text-center text-gray-500">
                              <MessageSquare className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                              <p className="font-medium">No comments yet</p>
                              <p className="text-sm mt-1">Reviewers haven't left any comments</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                      <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
                        <Users className="w-8 h-8 text-gray-400" />
                      </div>
                      <p className="text-gray-600 font-medium">No reviews yet</p>
                      <p className="text-sm text-gray-400 mt-1">This application hasn't been reviewed</p>
                      <Button onClick={onStartReview} className="mt-4 bg-blue-600 hover:bg-blue-700">
                        <Play className="w-4 h-4 mr-2" />
                        Start First Review
                      </Button>
                    </div>
                  )}
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
  availableRubrics,
  scores,
  comments,
  timer,
  timerActive,
  isSaving,
  form,
  titleFieldName,
  setTitleFieldName,
  showTitleFieldSelector,
  setShowTitleFieldSelector,
  collapsedSections,
  setCollapsedSections,
  hidePII,
  hiddenPIIFields,
  sectionComments,
  isExternalMode,
  reviewerInfo,
  fieldVisibilityConfig,
  onScoreChange,
  onCommentsChange,
  onToggleTimer,
  onSaveAndNext,
  onDecision,
  onSelectRubric,
  onSectionComment,
  onPrev,
  onNext,
  onExit
}: {
  app: ApplicationData
  appIndex: number
  totalApps: number
  stage: StageWithConfig
  rubric: Rubric | null
  availableRubrics: Rubric[]
  scores: Record<string, number>
  comments: string
  timer: number
  timerActive: boolean
  isSaving: boolean
  form: Form | null
  titleFieldName: string | null
  setTitleFieldName: (name: string | null) => void
  showTitleFieldSelector: boolean
  setShowTitleFieldSelector: (show: boolean) => void
  collapsedSections: Set<string>
  setCollapsedSections: (sections: Set<string>) => void
  hidePII: boolean
  hiddenPIIFields: string[]
  sectionComments: Record<string, string>
  isExternalMode?: boolean
  reviewerInfo?: ReviewerInfo | null
  fieldVisibilityConfig?: Record<string, boolean | 'visible' | 'hidden' | 'score_only'>
  onScoreChange: (cat: string, val: number) => void
  onCommentsChange: (c: string) => void
  onToggleTimer: () => void
  onSaveAndNext: () => void
  onDecision: (status: string) => void
  onSelectRubric: (rubricId: string) => void
  onSectionComment: (sectionId: string, comment: string) => void
  onPrev: () => void
  onNext: () => void
  onExit: () => void
}) {
  const [showRubricSelector, setShowRubricSelector] = useState(false)
  const [actionFeedback, setActionFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  
  // Text highlighting state
  const [textHighlights, setTextHighlights] = useState<{
    id: string
    fieldName: string
    text: string
    comment: string
    startOffset: number
    endOffset: number
  }[]>([])
  const [selectedText, setSelectedText] = useState<{
    text: string
    fieldName: string
    rect: DOMRect
  } | null>(null)
  const [highlightComment, setHighlightComment] = useState('')
  
  // Dismiss selection popover on escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedText) {
        setSelectedText(null)
        setHighlightComment('')
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedText])
  
  const totalScore = Object.values(scores).reduce((sum, val) => sum + (val || 0), 0)
  const maxScore = rubric?.max_score || 100
  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`
  
  // Show feedback briefly after action
  const showFeedback = (type: 'success' | 'error', message: string) => {
    setActionFeedback({ type, message })
    setTimeout(() => setActionFeedback(null), 2000)
  }
  
  // Handle text selection
  const handleTextSelection = (fieldName: string) => {
    const selection = window.getSelection()
    if (selection && selection.toString().trim().length > 0) {
      const range = selection.getRangeAt(0)
      const rect = range.getBoundingClientRect()
      setSelectedText({
        text: selection.toString().trim(),
        fieldName,
        rect
      })
      setHighlightComment('')
    }
  }
  
  // Add highlight with comment
  const addHighlight = () => {
    if (selectedText && highlightComment.trim()) {
      const newHighlight = {
        id: crypto.randomUUID(),
        fieldName: selectedText.fieldName,
        text: selectedText.text,
        comment: highlightComment.trim(),
        startOffset: 0,
        endOffset: selectedText.text.length
      }
      setTextHighlights(prev => [...prev, newHighlight])
      setSelectedText(null)
      setHighlightComment('')
      showFeedback('success', 'Highlight added')
    }
  }
  
  // Remove a highlight
  const removeHighlight = (id: string) => {
    setTextHighlights(prev => prev.filter(h => h.id !== id))
  }
  
  // PII redaction helper - checks field id, name, and label
  // If hiddenPIIFields has entries, we treat it as implied PII hiding (even if hidePII is false)
  const isFieldRedacted = (field: { id: string; name: string; label?: string }): boolean => {
    // If hidePII is explicitly false AND hiddenPIIFields is empty, no redaction
    // If hidePII is true OR hiddenPIIFields has entries, check if this field should be redacted
    const shouldCheckPII = hidePII || (hiddenPIIFields && hiddenPIIFields.length > 0)
    if (!shouldCheckPII) return false
    if (!hiddenPIIFields || hiddenPIIFields.length === 0) return false
    
    return hiddenPIIFields.includes(field.id) || 
           hiddenPIIFields.includes(field.name) || 
           (field.label ? hiddenPIIFields.includes(field.label) : false)
  }
  
  // Helper to check if a field is visible based on per-reviewer-type visibility config
  const isFieldVisible = (fieldId: string): boolean => {
    if (!fieldVisibilityConfig) return true
    const visibility = fieldVisibilityConfig[fieldId]
    if (visibility === undefined) return true // Default to visible
    if (visibility === 'hidden') return false
    if (visibility === false) return false
    return true // 'visible', 'score_only', or true
  }
  
  // PII redaction helper - creates visual black box effect
  const redactValue = (field: { id: string; name: string; label?: string }, value: any): any => {
    if (!isFieldRedacted(field)) return value
    // Return a visual indicator that the field is redacted
    return '████████████████'
  }
  
  // Collect PII values from hidden fields for inline redaction in all text
  // Need to use form fields to map from field ID to actual data key
  const piiValuesToRedact: string[] = useMemo(() => {
    if (!hidePII || !hiddenPIIFields || hiddenPIIFields.length === 0) return []
    if (!form?.fields) return []
    
    const values: string[] = []
    form.fields.forEach(field => {
      // Check if this field is in the hidden list (by id, name, or label)
      if (hiddenPIIFields.includes(field.id) || 
          hiddenPIIFields.includes(field.name) || 
          (field.label && hiddenPIIFields.includes(field.label))) {
        const value = app.raw_data[field.name] || app.raw_data[field.label || '']
        if (value && typeof value === 'string' && value.trim().length >= 2) {
          values.push(value.trim())
          // Also split by common separators for names like "John Smith"
          const parts = value.trim().split(/[\s,]+/)
          parts.forEach(p => {
            if (p.length >= 2) values.push(p)
          })
        }
      }
    })
    return [...new Set(values)]
  }, [app.raw_data, hidePII, hiddenPIIFields, form?.fields])
  
  // Get display title - uses Application # when PII mode is on or title field is redacted
  const getDisplayTitle = (): string => {
    // If PII mode is enabled, always show anonymized title
    if (hidePII) {
      return `Application #${appIndex + 1}`
    }
    if (titleFieldName && app.raw_data[titleFieldName]) {
      return String(app.raw_data[titleFieldName])
    }
    return app.name || `Application #${appIndex + 1}`
  }
  
  // Render text with highlights
  const renderHighlightedText = (fieldName: string, text: string): React.ReactNode => {
    const fieldHighlights = textHighlights.filter(h => h.fieldName === fieldName)
    
    // If no highlights, just apply PII redaction and return
    if (fieldHighlights.length === 0) {
      return piiValuesToRedact.length > 0 
        ? <RedactedText text={text} piiValues={piiValuesToRedact} />
        : text
    }
    
    // Sort highlights by their appearance in the text
    let result: React.ReactNode[] = []
    let lastIndex = 0
    
    fieldHighlights.forEach((highlight, idx) => {
      const highlightIndex = text.indexOf(highlight.text, lastIndex)
      if (highlightIndex >= 0) {
        // Add text before this highlight
        if (highlightIndex > lastIndex) {
          result.push(text.slice(lastIndex, highlightIndex))
        }
        // Add highlighted text
        result.push(
          <span 
            key={highlight.id}
            className="bg-yellow-200 cursor-pointer relative group"
            title={highlight.comment}
          >
            {highlight.text}
            <span className="absolute bottom-full left-0 mb-1 hidden group-hover:block bg-gray-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap z-10 max-w-xs">
              {highlight.comment}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  removeHighlight(highlight.id)
                }}
                className="ml-2 text-red-300 hover:text-red-100"
              >
                ×
              </button>
            </span>
          </span>
        )
        lastIndex = highlightIndex + highlight.text.length
      }
    })
    
    // Add remaining text
    if (lastIndex < text.length) {
      result.push(text.slice(lastIndex))
    }
    
    // If we have PII to redact and the result has text, wrap in RedactedText processing
    if (result.length > 0 && piiValuesToRedact.length > 0) {
      // Apply PII redaction to any string parts in the result
      return <>{result.map((part, i) => 
        typeof part === 'string' 
          ? <RedactedText key={`pii-${i}`} text={part} piiValues={piiValuesToRedact} />
          : part
      )}</>
    }
    
    return result.length > 0 ? <>{result}</> : (
      piiValuesToRedact.length > 0 
        ? <RedactedText text={text} piiValues={piiValuesToRedact} />
        : text
    )
  }
  
  // Render field value with PII redaction
  const renderFieldValueWithPII = (fieldName: string, value: any): React.ReactNode => {
    if (typeof value === 'string') {
      if (piiValuesToRedact.length > 0) {
        return <RedactedText text={value} piiValues={piiValuesToRedact} />
      }
      return value
    }
    // For non-string values, use the generic field value renderer
    return renderFieldValue(fieldName, value)
  }

  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col">
      {/* Action Feedback Toast */}
      {actionFeedback && (
        <div className={cn(
          "fixed top-20 left-1/2 -translate-x-1/2 z-[60] px-4 py-2 rounded-lg shadow-lg animate-in fade-in slide-in-from-top-2 duration-200",
          actionFeedback.type === 'success' ? "bg-green-600 text-white" : "bg-red-600 text-white"
        )}>
          <div className="flex items-center gap-2">
            {actionFeedback.type === 'success' ? (
              <CheckCircle className="w-4 h-4" />
            ) : (
              <AlertCircle className="w-4 h-4" />
            )}
            <span className="text-sm font-medium">{actionFeedback.message}</span>
          </div>
        </div>
      )}
      
      {/* Text Selection Popover */}
      {selectedText && (
        <div 
          className="fixed z-[70] bg-white rounded-lg shadow-xl border border-gray-200 p-3 w-72"
          style={{
            top: selectedText.rect.bottom + window.scrollY + 8,
            left: Math.min(selectedText.rect.left + window.scrollX, window.innerWidth - 300)
          }}
        >
          <div className="mb-2">
            <p className="text-xs text-gray-500 mb-1">Selected text:</p>
            <p className="text-sm text-gray-700 bg-yellow-100 px-2 py-1 rounded line-clamp-2">
              "{selectedText.text}"
            </p>
          </div>
          <textarea
            value={highlightComment}
            onChange={(e) => setHighlightComment(e.target.value)}
            placeholder="Add a comment about this text..."
            rows={2}
            className="w-full text-sm p-2 border border-gray-200 rounded-lg placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-none"
            autoFocus
          />
          <div className="flex justify-end gap-2 mt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSelectedText(null)
                setHighlightComment('')
              }}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={!highlightComment.trim()}
              onClick={addHighlight}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Sparkles className="w-3 h-3 mr-1" />
              Add Note
            </Button>
          </div>
        </div>
      )}
      
      {/* Top Bar */}
      <div className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6">
        <div className="flex items-center gap-4">
          {/* Only show exit button for internal mode */}
          {!isExternalMode && (
            <>
              <button onClick={onExit} className="text-gray-500 hover:text-gray-900 transition-colors">
                <X className="w-5 h-5" />
              </button>
              <div className="h-6 w-px bg-gray-200" />
            </>
          )}
          {/* Show reviewer name for external mode */}
          {isExternalMode && reviewerInfo?.name && (
            <>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                  <User className="w-4 h-4 text-blue-600" />
                </div>
                <span className="text-gray-900 font-medium text-sm">{reviewerInfo.name}</span>
              </div>
              <div className="h-6 w-px bg-gray-200" />
            </>
          )}
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
            {/* Header with title field selector */}
            <div className="flex items-start justify-between mb-6">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h1 className="text-2xl font-bold text-gray-900">
                    {getDisplayTitle()}
                  </h1>
                  {/* PII Mode indicator */}
                  {hidePII && (
                    <div className="flex items-center gap-1 px-2 py-0.5 bg-gray-900 text-white rounded text-xs">
                      <Shield className="w-3 h-3" />
                      Privacy Mode
                    </div>
                  )}
                  {!hidePII && (
                    <div className="relative">
                      <button
                        onClick={() => setShowTitleFieldSelector(!showTitleFieldSelector)}
                        className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded transition-colors"
                        title="Change title field"
                      >
                        <Type className="w-4 h-4" />
                      </button>
                      {showTitleFieldSelector && form?.fields && (
                        <div className="absolute left-0 top-8 z-50 bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-[200px]">
                          <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-100">
                            Select Title Field
                          </div>
                          {getTitleCandidateFields(form.fields).map(field => (
                            <button
                              key={field.id}
                              onClick={() => {
                                setTitleFieldName(field.name)
                                setShowTitleFieldSelector(false)
                              }}
                              className={cn(
                                "w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center justify-between",
                                titleFieldName === field.name && "bg-blue-50 text-blue-700"
                              )}
                            >
                              <span>{field.label || field.name}</span>
                              {titleFieldName === field.name && <CheckCircle className="w-4 h-4" />}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                
              </div>
              {app.flagged && (
                <Badge className="bg-red-100 text-red-700 border-red-200">
                  <Flag className="w-3 h-3 mr-1" />
                  Flagged
                </Badge>
              )}
            </div>
            
            {/* Highlight instruction hint */}
            <div className="flex items-center gap-2 mb-4 text-xs text-gray-400">
              <Sparkles className="w-3 h-3" />
              <span>Tip: Select text to add highlighted notes</span>
            </div>

            {/* Text highlights summary */}
            {textHighlights.length > 0 && (
              <div className="mb-4 bg-yellow-50 rounded-xl border border-yellow-200 p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold text-yellow-800 flex items-center gap-2">
                    <Sparkles className="w-4 h-4" />
                    Highlighted Notes ({textHighlights.length})
                  </h4>
                </div>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {textHighlights.map(h => (
                    <div key={h.id} className="flex items-start justify-between gap-2 text-sm bg-white rounded-lg p-2 border border-yellow-200">
                      <div className="flex-1 min-w-0">
                        <p className="text-yellow-800 font-medium truncate">"{h.text}"</p>
                        <p className="text-gray-600 text-xs">{h.comment}</p>
                      </div>
                      <button
                        onClick={() => removeHighlight(h.id)}
                        className="text-gray-400 hover:text-red-500 flex-shrink-0"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Section-based data display */}
            {form?.fields && form.fields.length > 0 ? (
              <div className="space-y-4">
                {(() => {
                  const { sections, ungroupedFields } = groupFieldsBySections(form.fields, form.settings)
                  
                  // Filter ungrouped fields based on role visibility
                  const visibleUngroupedFields = ungroupedFields.filter(f => isFieldVisible(f.id))
                  
                  // Filter out fields that have data AND are all PII redacted
                  const ungroupedFieldsWithData = visibleUngroupedFields.filter(f => {
                    const val = app.raw_data[f.name] || app.raw_data[f.label]
                    return val !== undefined && val !== null && val !== ''
                  })
                  const allUngroupedPIIRedacted = ungroupedFieldsWithData.length > 0 && 
                    ungroupedFieldsWithData.every(f => isFieldRedacted(f))
                  
                  // Hide ungrouped section if all fields are PII redacted
                  const showUngroupedSection = visibleUngroupedFields.length > 0 && !allUngroupedPIIRedacted
                  
                  return (
                    <>
                      {/* Ungrouped fields first (if any) */}
                      {showUngroupedSection && (
                        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                          <div className="p-4 space-y-4">
                            {visibleUngroupedFields.map(field => {
                              const rawValue = app.raw_data[field.name] || app.raw_data[field.label]
                              if (rawValue === undefined || rawValue === null || rawValue === '') return null
                              
                              // Check if field is redacted (PII) - show with redacted value
                              const isPIIRedacted = isFieldRedacted(field)
                              
                              return (
                                <div key={field.id} className="border-b border-gray-100 pb-4 last:border-0 last:pb-0">
                                  <div className="flex items-start justify-between gap-2 mb-1.5">
                                    <span className="text-xs font-semibold text-indigo-600 uppercase tracking-wide">
                                      {field.label || field.name.replace(/_/g, ' ')}
                                    </span>
                                    {isPIIRedacted && (
                                      <Badge className="bg-gray-900 text-white border-gray-700 text-xs">
                                        <Shield className="w-3 h-3 mr-1" />
                                        Private
                                      </Badge>
                                    )}
                                    {!isPIIRedacted && textHighlights.some(h => h.fieldName === field.name) && (
                                      <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200 text-xs">
                                        <Sparkles className="w-3 h-3 mr-1" />
                                        {textHighlights.filter(h => h.fieldName === field.name).length}
                                      </Badge>
                                    )}
                                  </div>
                                  <div 
                                    className={cn(
                                      "text-sm leading-relaxed",
                                      isPIIRedacted 
                                        ? "text-gray-900 bg-gray-900 rounded px-1 select-none" 
                                        : "text-gray-800 select-text cursor-text"
                                    )}
                                    onMouseUp={() => !isPIIRedacted && handleTextSelection(field.name)}
                                  >
                                    {isPIIRedacted 
                                      ? '████████████████'
                                      : (typeof rawValue === 'string' 
                                          ? renderHighlightedText(field.name, rawValue)
                                          : renderFieldValueWithPII(field.name, rawValue))
                                    }
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}
                      
                      {/* Sections */}
                      {sections.map(section => {
                        const isCollapsed = collapsedSections.has(section.id)
                        const hasData = section.fields.some(f => {
                          const val = app.raw_data[f.name] || app.raw_data[f.label]
                          return val !== undefined && val !== null && val !== ''
                        })
                        
                        // Check if all fields in section are hidden by role visibility config
                        const allFieldsHiddenByRole = section.fields.every(f => !isFieldVisible(f.id))
                        
                        // Check if all fields with data in section are PII redacted - hide entire section
                        const fieldsWithData = section.fields.filter(f => {
                          const val = app.raw_data[f.name] || app.raw_data[f.label]
                          return val !== undefined && val !== null && val !== ''
                        })
                        const allFieldsPIIRedacted = fieldsWithData.length > 0 && 
                          fieldsWithData.every(f => isFieldRedacted(f))
                        
                        // Hide section if: no data, all fields hidden by role, OR all fields are PII redacted
                        if (!hasData || allFieldsHiddenByRole || allFieldsPIIRedacted) return null
                        
                        return (
                          <div key={section.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                            {/* Section header */}
                            <button
                              onClick={() => {
                                const newCollapsed = new Set(collapsedSections)
                                if (isCollapsed) {
                                  newCollapsed.delete(section.id)
                                } else {
                                  newCollapsed.add(section.id)
                                }
                                setCollapsedSections(newCollapsed)
                              }}
                              className="w-full px-4 py-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors border-b border-gray-200"
                            >
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold text-gray-900">{section.name}</span>
                                {section.description && (
                                  <span className="text-xs text-gray-500">• {section.description}</span>
                                )}
                                {sectionComments[section.id] && (
                                  <Badge className="bg-blue-100 text-blue-600 border-blue-200 text-xs">
                                    <MessageSquare className="w-3 h-3 mr-1" />
                                    Note
                                  </Badge>
                                )}
                              </div>
                              {isCollapsed ? (
                                <ChevronDown className="w-4 h-4 text-gray-400" />
                              ) : (
                                <ChevronUp className="w-4 h-4 text-gray-400" />
                              )}
                            </button>
                            
                            {/* Section content */}
                            {!isCollapsed && (
                              <div className="p-4 space-y-4">
                                {section.fields.map(field => {
                                  // Skip fields hidden by visibility config (role-based)
                                  if (!isFieldVisible(field.id)) return null
                                  
                                  const rawValue = app.raw_data[field.name] || app.raw_data[field.label]
                                  if (rawValue === undefined || rawValue === null || rawValue === '') return null
                                  
                                  // Check if field is redacted (PII) - show with redacted value
                                  const isPIIRedacted = isFieldRedacted(field)
                                  const displayValue = isPIIRedacted ? '████████████████' : rawValue
                                  
                                  return (
                                    <div key={field.id} className="border-b border-gray-100 pb-4 last:border-0 last:pb-0">
                                      <div className="flex items-start justify-between gap-2 mb-1.5">
                                        <span className="text-xs font-semibold text-indigo-600 uppercase tracking-wide">
                                          {field.label || field.name.replace(/_/g, ' ')}
                                        </span>
                                        {isPIIRedacted && (
                                          <Badge className="bg-gray-900 text-white border-gray-700 text-xs">
                                            <Shield className="w-3 h-3 mr-1" />
                                            Private
                                          </Badge>
                                        )}
                                        {!isPIIRedacted && textHighlights.some(h => h.fieldName === field.name) && (
                                          <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200 text-xs">
                                            <Sparkles className="w-3 h-3 mr-1" />
                                            {textHighlights.filter(h => h.fieldName === field.name).length} note(s)
                                          </Badge>
                                        )}
                                      </div>
                                      <div 
                                        className={cn(
                                          "text-sm leading-relaxed",
                                          isPIIRedacted 
                                            ? "text-gray-900 bg-gray-900 rounded px-1 select-none" 
                                            : "text-gray-800 select-text cursor-text"
                                        )}
                                        onMouseUp={() => !isPIIRedacted && handleTextSelection(field.name)}
                                      >
                                        {isPIIRedacted 
                                          ? displayValue
                                          : (typeof rawValue === 'string' 
                                              ? renderHighlightedText(field.name, rawValue)
                                              : renderFieldValueWithPII(field.name, rawValue))
                                        }
                                      </div>
                                    </div>
                                  )
                                })}
                                
                                {/* Section comment input */}
                                <div className="pt-4 border-t border-gray-100">
                                  <div className="flex items-start gap-2">
                                    <MessageSquare className="w-4 h-4 text-gray-400 mt-2 flex-shrink-0" />
                                    <textarea
                                      value={sectionComments[section.id] || ''}
                                      onChange={(e) => onSectionComment(section.id, e.target.value)}
                                      placeholder={`Add notes about ${section.name.toLowerCase()}...`}
                                      rows={2}
                                      className="flex-1 text-sm p-2 border border-gray-200 rounded-lg placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-none"
                                    />
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </>
                  )
                })()}
              </div>
            ) : (
              /* Fallback: flat list for forms without field definitions */
              <div className="space-y-4">
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden p-4 space-y-4">
                  {Object.entries(app.raw_data).map(([key, value]) => {
                    if (key.startsWith('_') || key === 'id') return null
                    
                    // Check if field is hidden by visibility config
                    if (!isFieldVisible(key)) return null
                    
                    // Check if this field is hidden by PII settings
                    const isHidden = hidePII && hiddenPIIFields && hiddenPIIFields.includes(key)
                    
                    // Render with PII handling
                    const renderValue = () => {
                      if (isHidden) {
                        return (
                          <span className="bg-gray-900 text-gray-900 rounded px-2 py-0.5 select-none cursor-help" title="Hidden for privacy">
                            ████████████████
                          </span>
                        )
                      }
                      if (typeof value === 'string' && piiValuesToRedact.length > 0) {
                        return <RedactedText text={value} piiValues={piiValuesToRedact} />
                      }
                      return renderFieldValue(key, value)
                    }
                    
                    return (
                      <div key={key} className="border-b border-gray-100 pb-4 last:border-0 last:pb-0">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-xs font-semibold text-indigo-600 uppercase tracking-wide">
                            {key.replace(/_/g, ' ')}
                          </span>
                          {isHidden && (
                            <Badge className="bg-gray-900 text-white border-gray-700 text-xs">
                              <EyeOff className="w-3 h-3 mr-1" />
                              Redacted
                            </Badge>
                          )}
                        </div>
                        <div className="text-gray-800 text-sm leading-relaxed">{renderValue()}</div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
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
              <div className="bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
                <div className="text-center py-8 px-6">
                  <div className="w-14 h-14 bg-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Award className="w-7 h-7 text-amber-600" />
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-2">No Rubric Configured</h3>
                  <p className="text-sm text-gray-500 mb-6 max-w-xs mx-auto">
                    {isExternalMode 
                      ? "A scoring rubric has not been set up for this review stage."
                      : "Add a scoring rubric to this stage to enable structured evaluation"
                    }
                  </p>
                  
                  {/* Rubric selection dropdown or creation - only for internal users */}
                  {!isExternalMode && availableRubrics.length > 0 ? (
                    <div className="space-y-3">
                      {!showRubricSelector ? (
                        <Button 
                          onClick={() => setShowRubricSelector(true)}
                          className="bg-blue-600 hover:bg-blue-700"
                        >
                          <Award className="w-4 h-4 mr-2" />
                          Select a Rubric
                        </Button>
                      ) : (
                        <div className="bg-white rounded-lg border border-gray-200 p-4 max-w-sm mx-auto">
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-sm font-medium text-gray-700">Select Rubric</span>
                            <button 
                              onClick={() => setShowRubricSelector(false)}
                              className="text-gray-400 hover:text-gray-600"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                          <div className="space-y-2 max-h-48 overflow-y-auto">
                            {availableRubrics.map(r => (
                              <button
                                key={r.id}
                                onClick={() => {
                                  onSelectRubric(r.id)
                                  setShowRubricSelector(false)
                                  showFeedback('success', `Rubric "${r.name}" assigned`)
                                }}
                                className="w-full text-left p-3 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors"
                              >
                                <div className="font-medium text-gray-900 text-sm">{r.name}</div>
                                {r.description && (
                                  <div className="text-xs text-gray-500 mt-1 line-clamp-2">{r.description}</div>
                                )}
                                <div className="text-xs text-gray-400 mt-1">
                                  {r.categories?.length || 0} categories • Max {r.max_score || 100} points
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                      <p className="text-xs text-gray-400">
                        Or configure rubrics in Workflow Settings
                      </p>
                    </div>
                  ) : !isExternalMode ? (
                    <div className="space-y-3">
                      <p className="text-sm text-gray-500">
                        No rubrics available. Create one in Workflow Settings.
                      </p>
                      <Button variant="outline" className="gap-2">
                        <Plus className="w-4 h-4" />
                        Configure Rubrics
                      </Button>
                    </div>
                  ) : null}
                </div>
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
            {/* Status indicators */}
            {app.status && app.status !== 'pending' && (
              <div className="mb-4 flex items-center gap-2">
                <span className="text-sm text-gray-500">Current status:</span>
                <Badge className={cn(
                  "capitalize",
                  app.status === 'approved' && "bg-green-100 text-green-700 border-green-200",
                  app.status === 'rejected' && "bg-red-100 text-red-700 border-red-200",
                  app.status === 'pending' && "bg-gray-100 text-gray-700 border-gray-200",
                  !['approved', 'rejected', 'pending'].includes(app.status) && "bg-blue-100 text-blue-700 border-blue-200"
                )}>
                  {app.status.replace(/_/g, ' ')}
                </Badge>
              </div>
            )}
            
            <div className="flex items-center gap-3">
              {/* Save & Next button */}
              <Button 
                onClick={onSaveAndNext}
                disabled={isSaving}
                variant="outline"
                className="flex-1"
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                Save & Next
              </Button>
              
              {/* Custom Status Dropdown - uses stage.custom_statuses if available */}
              {(() => {
                // Normalize custom_statuses to string array (can be string[] or StatusOption[])
                const normalizeStatuses = (statuses: any): string[] => {
                  if (!statuses || !Array.isArray(statuses) || statuses.length === 0) {
                    return ['Approved', 'Rejected', 'Pending']
                  }
                  return statuses.map((s: any) => typeof s === 'string' ? s : s.name)
                }
                const customStatuses = normalizeStatuses(stage.custom_statuses)
                
                const getStatusColor = (status: string) => {
                  const lower = status.toLowerCase()
                  if (lower.includes('approv') || lower.includes('accept') || lower.includes('complete')) {
                    return 'text-green-600 hover:bg-green-50'
                  }
                  if (lower.includes('reject') || lower.includes('deny') || lower.includes('decline')) {
                    return 'text-red-600 hover:bg-red-50'
                  }
                  if (lower.includes('pend') || lower.includes('wait') || lower.includes('review')) {
                    return 'text-amber-600 hover:bg-amber-50'
                  }
                  return 'text-blue-600 hover:bg-blue-50'
                }
                
                const getStatusIcon = (status: string) => {
                  const lower = status.toLowerCase()
                  if (lower.includes('approv') || lower.includes('accept') || lower.includes('complete')) {
                    return <ThumbsUp className="w-4 h-4 mr-2" />
                  }
                  if (lower.includes('reject') || lower.includes('deny') || lower.includes('decline')) {
                    return <ThumbsDown className="w-4 h-4 mr-2" />
                  }
                  return <Check className="w-4 h-4 mr-2" />
                }
                
                return (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button className="flex-[2] bg-indigo-600 hover:bg-indigo-700">
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Set Status
                        <ChevronDown className="w-4 h-4 ml-2" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      {customStatuses.map((status) => (
                        <DropdownMenuItem
                          key={status}
                          onClick={() => onDecision(status.toLowerCase().replace(/\s+/g, '_'))}
                          className={cn("cursor-pointer", getStatusColor(status))}
                        >
                          {getStatusIcon(status)}
                          {status}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )
              })()}
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