'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { 
  CheckCircle, ChevronRight, AlertCircle, FileText, DollarSign, 
  GraduationCap, Info, X, Edit2, MessageSquare, Loader2,
  ChevronLeft, Star, Award, BookOpen, Users, Clock, Send,
  Eye, EyeOff, Sparkles, Lock, Unlock, Tag, Save, User,
  Play, Pause, Shield, ChevronUp, ChevronDown, Timer, MoreHorizontal,
  Highlighter, Plus
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
    }).filter((s: FormSection) => s.fields.length > 0)
    
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
          return config.section_id === section.id || (f as any).section_id === section.id
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

// Helper to normalize rubric categories to a consistent format
function normalizeRubricCategory(cat: any): { id: string; name: string; max: number; levels: Array<{ minScore: number; maxScore: number; description: string }> } {
  // Handle various property name formats (camelCase vs snake_case)
  const id = cat.id || ''
  const name = cat.name || cat.category || 'Category'
  const max = cat.max_points || cat.maxPoints || cat.max || 0
  
  // Handle levels/guidelines array
  let levels: Array<{ minScore: number; maxScore: number; description: string }> = []
  
  if (cat.levels && Array.isArray(cat.levels)) {
    levels = cat.levels.map((l: any) => ({
      minScore: l.minScore || l.min_score || l.min_points || 0,
      maxScore: l.maxScore || l.max_score || l.max_points || max,
      description: l.description || l.label || ''
    }))
  } else if (cat.guidelines && Array.isArray(cat.guidelines)) {
    levels = cat.guidelines.map((g: any) => ({
      minScore: g.min_points || 0,
      maxScore: g.max_points || max,
      description: g.description || g.label || ''
    }))
  } else if (cat.criteria && Array.isArray(cat.criteria)) {
    // Legacy format
    levels = cat.criteria.map((c: any) => {
      if (c.range) {
        const [min, maxVal] = c.range.split('-').map((n: string) => parseInt(n.trim()))
        return { minScore: min || 0, maxScore: maxVal || max, description: c.desc || c.description || '' }
      }
      return { minScore: 0, maxScore: max, description: c.desc || c.description || '' }
    })
  }
  
  return { id, name, max, levels }
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
  const parts = String(text).split(regex)
  
  return (
    <>
      {parts.map((part, i) => {
        const isRedacted = validPiiValues.some(v => v.toLowerCase() === part.toLowerCase())
        if (isRedacted) {
          return (
            <span 
              key={i}
              className="bg-gray-900 text-gray-900 rounded px-1 select-none cursor-help"
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

// Collect PII values from hidden fields for inline redaction
function collectPIIValues(rawData: Record<string, any>, hiddenPIIFields: string[]): string[] {
  const values: string[] = []
  hiddenPIIFields.forEach(fieldName => {
    const value = rawData[fieldName]
    if (value && typeof value === 'string' && value.trim().length >= 2) {
      values.push(value.trim())
      // Also split by common separators for names like "John Smith"
      const parts = value.trim().split(/[\s,]+/)
      parts.forEach(p => {
        if (p.length >= 2) values.push(p)
      })
    }
  })
  return [...new Set(values)] // Remove duplicates
}

// Helper function to render field values with optional PII redaction
function renderExternalFieldValue(value: any, fieldType?: string, piiValues?: string[]): React.ReactNode {
  // Handle null/undefined/empty
  if (value === null || value === undefined || value === '') {
    return <span className="text-gray-400/60 text-sm">—</span>
  }
  
  // Handle booleans
  if (typeof value === 'boolean') {
    return (
      <span className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
        value ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-600"
      )}>
        {value ? 'Yes' : 'No'}
      </span>
    )
  }
  
  // Handle long text (essays, textareas)
  if (fieldType === 'textarea' || fieldType === 'long_text' || fieldType === 'essay') {
    const textContent = value || 'No content provided.'
    return (
      <p className="text-gray-700 leading-relaxed whitespace-pre-wrap text-[15px]">
        {piiValues && piiValues.length > 0 ? (
          <RedactedText text={String(textContent)} piiValues={piiValues} />
        ) : textContent}
      </p>
    )
  }
  
  // Handle files
  if (fieldType === 'file' || fieldType === 'upload') {
    return (
      <div className="inline-flex items-center gap-2 text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg">
        <FileText className="w-4 h-4" />
        <span className="text-sm font-medium">File uploaded</span>
      </div>
    )
  }
  
  // Handle arrays (repeaters)
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return <span className="text-gray-400/60 text-sm">—</span>
    }
    
    // Check if it's an array of primitives
    if (value.every(v => typeof v !== 'object' || v === null)) {
      const textContent = value.join(', ')
      return (
        <span className="text-gray-900">
          {piiValues && piiValues.length > 0 ? (
            <RedactedText text={textContent} piiValues={piiValues} />
          ) : textContent}
        </span>
      )
    }
    
    // Array of objects (repeater items)
    return (
      <div className="space-y-2 mt-1">
        {value.map((item: any, i: number) => (
          <div key={i} className="bg-gray-50/50 rounded-lg border border-gray-100 p-3 hover:border-gray-200 transition-colors">
            <div className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-2">Entry {i + 1}</div>
            {typeof item === 'object' && item !== null ? (
              <div className="grid gap-1.5">
                {Object.entries(item).filter(([k]) => !k.startsWith('_')).map(([k, v]) => (
                  <div key={k} className="flex flex-wrap gap-x-2 text-sm">
                    <span className="text-gray-500 min-w-[80px]">{k.replace(/_/g, ' ')}:</span>
                    <span className="text-gray-900 font-medium">
                      {v === null || v === undefined || v === '' ? '—' : (
                        piiValues && piiValues.length > 0 ? (
                          <RedactedText text={String(v)} piiValues={piiValues} />
                        ) : String(v)
                      )}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <span className="text-sm text-gray-900">{String(item)}</span>
            )}
          </div>
        ))}
      </div>
    )
  }
  
  // Handle objects (groups)
  if (typeof value === 'object' && value !== null) {
    const entries = Object.entries(value).filter(([k]) => !k.startsWith('_'))
    
    if (entries.length === 0) {
      return <span className="text-gray-400/60 text-sm">—</span>
    }
    
    // Check if all values are simple (no nested objects)
    const allSimple = entries.every(([, v]) => typeof v !== 'object' || v === null)
    
    if (allSimple && entries.length <= 4) {
      // Render inline for simple groups with few fields
      return (
        <div className="flex flex-wrap gap-3">
          {entries.map(([k, v]) => (
            <span key={k} className="inline-flex items-center gap-1.5 text-sm bg-gray-50 px-2.5 py-1 rounded-md">
              <span className="text-gray-500">{k.replace(/_/g, ' ')}:</span>
              <span className="text-gray-900 font-medium">
                {v === null || v === '' ? '—' : (
                  piiValues && piiValues.length > 0 ? (
                    <RedactedText text={String(v)} piiValues={piiValues} />
                  ) : String(v)
                )}
              </span>
            </span>
          ))}
        </div>
      )
    }
    
    // Render as nested card for complex groups
    return (
      <div className="mt-1 bg-gray-50/50 rounded-lg border border-gray-100 overflow-hidden">
        <div className="divide-y divide-gray-100">
          {entries.map(([k, v]) => (
            <div key={k} className="px-3 py-2.5">
              <div className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1">
                {k.replace(/_/g, ' ')}
              </div>
              <div className="text-gray-900">{renderExternalFieldValue(v, undefined, piiValues)}</div>
            </div>
          ))}
        </div>
      </div>
    )
  }
  
  // Default: render as string with PII redaction
  const stringValue = String(value)
  return (
    <span className="text-gray-900">
      {piiValues && piiValues.length > 0 ? (
        <RedactedText text={stringValue} piiValues={piiValues} />
      ) : stringValue}
    </span>
  )
}

// Empty default - rubric should come from the backend
const EMPTY_RUBRIC: RubricCategory[] = []

export function ExternalReviewInterface({ reviewerName, token }: ExternalReviewInterfaceProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [applications, setApplications] = useState<Application[]>([])
  const [rubric, setRubric] = useState<RubricCategory[]>(EMPTY_RUBRIC)
  const [hasRubric, setHasRubric] = useState(false) // Track if rubric was loaded from backend
  const [fieldVisibilityConfig, setFieldVisibilityConfig] = useState<FieldVisibilityConfig>({})
  const [canViewPriorScores, setCanViewPriorScores] = useState(false)
  const [canViewPriorComments, setCanViewPriorComments] = useState(false)
  const [formFields, setFormFields] = useState<FormField[]>([])
  const [formSections, setFormSections] = useState<FormField[]>([]) // Section-type FormFields
  const [reviewerInfo, setReviewerInfo] = useState<{ id: string; name: string; email: string; type?: string } | null>(null)
  const [reviewerPermissions, setReviewerPermissions] = useState<{
    can_edit_score?: boolean
    can_edit_status?: boolean
    can_comment_only?: boolean
    can_tag?: boolean
  }>({})
  const [hidePII, setHidePII] = useState(true) // External reviewers default to PII protected
  const [hiddenPIIFields, setHiddenPIIFields] = useState<string[]>([])
  const [piiValues, setPiiValues] = useState<string[]>([]) // Collected PII values for inline redaction
  
  // Timer state (like FocusReviewMode)
  const [timer, setTimer] = useState(0)
  const [timerActive, setTimerActive] = useState(true)
  
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
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set())
  
  // Section comments state (per application, per section)
  const [sectionComments, setSectionComments] = useState<Record<string, Record<string, string>>>({})
  
  // Text highlight state
  const [textHighlights, setTextHighlights] = useState<Record<string, Array<{
    id: string
    fieldName: string
    text: string
    comment: string
  }>>>({})
  const [selectedText, setSelectedText] = useState<{
    text: string
    fieldName: string
    rect: DOMRect
  } | null>(null)
  const [highlightComment, setHighlightComment] = useState('')
  const highlightInputRef = useRef<HTMLInputElement>(null)
  
  // Hover state for rubric category tooltips
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null)
  
  // Timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout
    if (timerActive) {
      interval = setInterval(() => setTimer(t => t + 1), 1000)
    }
    return () => clearInterval(interval)
  }, [timerActive])
  
  // Focus on highlight input when selection appears
  useEffect(() => {
    if (selectedText && highlightInputRef.current) {
      highlightInputRef.current.focus()
    }
  }, [selectedText])
  
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
  
  // Format timer display
  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`
  
  // PII redaction helpers
  const isFieldRedacted = useCallback((fieldName: string): boolean => {
    return hidePII && hiddenPIIFields.includes(fieldName)
  }, [hidePII, hiddenPIIFields])
  
  const redactValue = useCallback((fieldName: string, value: any): any => {
    if (!hidePII || !hiddenPIIFields.includes(fieldName)) return value
    return '████████████████'
  }, [hidePII, hiddenPIIFields])
  
  // Get display title - uses Application # when PII mode is on
  const getDisplayTitle = useCallback((app: Application, index: number): string => {
    if (hidePII) {
      return `Application #${index + 1}`
    }
    return app.redactedName
  }, [hidePII])

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
        
        // Store reviewer info
        if (reviewer) {
          setReviewerInfo({
            id: reviewer.id,
            name: reviewer.name,
            email: reviewer.email,
            type: reviewer.reviewer_type_id
          })
        }
        
        // Store form structure for dynamic rendering
        const formFieldsArray = form.fields || []
        const sections = formFieldsArray.filter((f) => f.type === 'section')
        const fields = formFieldsArray.filter((f) => f.type !== 'section')
        setFormSections(sections)
        setFormFields(fields)
        
        // Parse custom statuses and tags from ApplicationStage
        let parsedStatuses: string[] = []
        let parsedTags: string[] = []
        
        if (stage) {
          const statuses = typeof stage.custom_statuses === 'string'
            ? JSON.parse(stage.custom_statuses)
            : stage.custom_statuses
          if (Array.isArray(statuses)) {
            parsedStatuses = statuses
            setCustomStatuses(statuses)
          }
          
          const tags = typeof stage.custom_tags === 'string'
            ? JSON.parse(stage.custom_tags)
            : stage.custom_tags
          if (Array.isArray(tags)) {
            parsedTags = tags
            setCustomTags(tags)
          }
          
          // Get PII settings from stage
          if (stage.hide_pii !== undefined) {
            setHidePII(stage.hide_pii)
          }
          if (stage.hidden_pii_fields && Array.isArray(stage.hidden_pii_fields)) {
            setHiddenPIIFields(stage.hidden_pii_fields)
          }
        }
        
        // Get reviewer type permissions if available
        if (reviewer?.reviewer_type_id) {
          // The permissions should come from the reviewer type, for now use stage_config
          // Default permissions if not specified
          setReviewerPermissions({
            can_edit_score: true,
            can_edit_status: parsedStatuses.length > 0,
            can_tag: parsedTags.length > 0,
            can_comment_only: false
          })
        }
        
        // Priority: stage config rubric > stage rubric from response > form settings rubric
        let rubricLoaded = false
        if (stageRubric && stageRubric.categories) {
          // Parse rubric categories from stage-specific rubric
          const categories = typeof stageRubric.categories === 'string' 
            ? JSON.parse(stageRubric.categories) 
            : stageRubric.categories
          if (Array.isArray(categories) && categories.length > 0) {
            setRubric(categories as RubricCategory[])
            rubricLoaded = true
          }
        } else if (settings.rubric && Array.isArray(settings.rubric) && settings.rubric.length > 0) {
          // Fallback to form settings rubric
          setRubric(settings.rubric as RubricCategory[])
          rubricLoaded = true
        }
        setHasRubric(rubricLoaded)

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

          // Build sections using the proper groupFieldsBySections helper
          // This uses form.settings.sections and config.section_id like FocusReviewMode does
          const grouped = groupFieldsBySections(formFieldsArray, settings)
          
          let appSections: Application['sections'] = []
          
          // Convert grouped sections to the Application sections format
          if (grouped.sections.length > 0) {
            appSections = grouped.sections.map(section => ({
              id: section.id,
              title: section.name,
              fields: section.fields
                .filter(f => isFieldVisible(f.id))
                .map(f => ({
                  id: f.id,
                  label: f.label || f.name || f.id,
                  value: data[f.id] || data[f.name] || data[f.label] || '',
                  type: f.type
                }))
                .filter(f => f.value !== '' && f.value !== null && f.value !== undefined)
            })).filter(s => s.fields.length > 0)
          }
          
          // Add ungrouped fields as a separate section if any
          if (grouped.ungroupedFields.length > 0) {
            const ungroupedMapped = grouped.ungroupedFields
              .filter(f => isFieldVisible(f.id))
              .map(f => ({
                id: f.id,
                label: f.label || f.name || f.id,
                value: data[f.id] || data[f.name] || data[f.label] || '',
                type: f.type
              }))
              .filter(f => f.value !== '' && f.value !== null && f.value !== undefined)
            
            if (ungroupedMapped.length > 0) {
              appSections.push({
                id: 'other-fields',
                title: 'Other Information',
                fields: ungroupedMapped
              })
            }
          }
          
          // If still no sections, try to create from raw data keys
          if (appSections.length === 0 && Object.keys(data).length > 0) {
            const rawFields = Object.entries(data)
              .filter(([key]) => !key.startsWith('_') && key !== 'id')
              .map(([key, value]) => ({
                id: key,
                label: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
                value: value,
                type: 'text'
              }))
              .filter(f => f.value !== '' && f.value !== null && f.value !== undefined)
            
            if (rawFields.length > 0) {
              appSections = [{
                id: 'all-fields',
                title: 'Application Data',
                fields: rawFields
              }]
            }
          }

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
        
        // Collect PII values for inline redaction from all applications
        if (hiddenPIIFields.length > 0 || (stage?.hidden_pii_fields && stage.hidden_pii_fields.length > 0)) {
          const allPiiValues: string[] = []
          const piiFieldNames = stage?.hidden_pii_fields || []
          mappedApps.forEach(app => {
            const collected = collectPIIValues(app.data, piiFieldNames)
            allPiiValues.push(...collected)
          })
          setPiiValues([...new Set(allPiiValues)])
        }
        
        const initialScores: Record<string, Record<string, number>> = {}
        mappedApps.forEach(app => {
          if (!scores[app.id]) {
            initialScores[app.id] = {}
            rubric.forEach(cat => { initialScores[app.id][cat.id] = 0 })
          }
        })
        setScores(prev => ({ ...initialScores, ...prev }))
        
        // Set initial active section to first available
        if (mappedApps.length > 0 && mappedApps[0].sections.length > 0) {
          setActiveSection(mappedApps[0].sections[0].id)
        }
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
  
  const isSubmittedApp = submitted.includes(currentApp?.id || '')
  const isDraftApp = drafts.includes(currentApp?.id || '')
  const currentScore = scores[currentApp?.id || ''] || {}
  const currentStatus = selectedStatus[currentApp?.id || ''] || ''
  const currentTags = selectedTags[currentApp?.id || ''] || []
  const currentOverallComments = overallComments[currentApp?.id || ''] || ''
  
  // Normalize rubric categories for consistent access
  const normalizedRubric = rubric.map(normalizeRubricCategory)
  const maxScore = normalizedRubric.reduce((a, b) => a + (b.max || 0), 0) || 100 // Default to 100 if no rubric
  const totalScore = Object.values(currentScore).reduce((a, b) => a + (b || 0), 0)
  const scorePercent = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0

  const handleScoreChange = (categoryId: string, value: number) => {
    if (isSubmittedApp) return
    setScores({ ...scores, [currentApp.id]: { ...currentScore, [categoryId]: value } })
  }

  const handleNoteChange = (categoryId: string, value: string) => {
    if (isSubmittedApp) return
    setRubricNotes({ ...rubricNotes, [currentApp.id]: { ...(rubricNotes[currentApp.id] || {}), [categoryId]: value } })
  }
  
  // Handle section comment
  const handleSectionComment = (sectionId: string, comment: string) => {
    setSectionComments({
      ...sectionComments,
      [currentApp.id]: {
        ...(sectionComments[currentApp.id] || {}),
        [sectionId]: comment
      }
    })
  }
  
  // Handle text selection for highlighting
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
        comment: highlightComment.trim()
      }
      setTextHighlights({
        ...textHighlights,
        [currentApp.id]: [...(textHighlights[currentApp.id] || []), newHighlight]
      })
      setSelectedText(null)
      setHighlightComment('')
      window.getSelection()?.removeAllRanges()
    }
  }
  
  // Remove a highlight
  const removeHighlight = (highlightId: string) => {
    setTextHighlights({
      ...textHighlights,
      [currentApp.id]: (textHighlights[currentApp.id] || []).filter(h => h.id !== highlightId)
    })
  }
  
  // Get current app's section comments
  const currentSectionComments = sectionComments[currentApp?.id || ''] || {}
  const currentHighlights = textHighlights[currentApp?.id || ''] || []

  const handleSubmit = async () => {
    setIsSubmitting(true)
    try {
      await goClient.post(`/external-review/${token}/submit/${currentApp.id}`, {
        scores: currentScore,
        notes: rubricNotes[currentApp.id],
        overall_comments: overallComments[currentApp.id],
        section_comments: sectionComments[currentApp.id],
        highlights: textHighlights[currentApp.id],
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
        section_comments: sectionComments[currentApp.id],
        highlights: textHighlights[currentApp.id],
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 flex flex-col">
      {/* Header - Focus Mode Style */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="px-6 py-3">
          <div className="flex items-center justify-between">
            {/* Left: Logo and Reviewer Info */}
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-200">
                <Award className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="font-semibold text-gray-900">Review Portal</h1>
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <User className="w-3 h-3" />
                  <span>{reviewerInfo?.name || reviewerName}</span>
                  {reviewerInfo?.email && (
                    <>
                      <span className="text-gray-300">•</span>
                      <span className="text-gray-400">{reviewerInfo.email}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
            
            {/* Center: Navigation and Progress */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
                  disabled={currentIndex === 0}
                  className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <span className="text-gray-600 text-sm font-medium min-w-[80px] text-center">
                  {currentIndex + 1} of {applications.length}
                </span>
                <button
                  onClick={() => setCurrentIndex(Math.min(applications.length - 1, currentIndex + 1))}
                  disabled={currentIndex === applications.length - 1}
                  className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
              
              {/* Progress bar */}
              <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-500"
                  style={{ width: `${(submitted.length / applications.length) * 100}%` }}
                />
              </div>
              <span className="text-sm font-medium text-gray-600">{submitted.length}/{applications.length}</span>
            </div>
            
            {/* Right: Timer and Privacy */}
            <div className="flex items-center gap-3">
              {/* Timer */}
              <div className="flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-1.5">
                <button onClick={() => setTimerActive(!timerActive)} className="text-gray-500 hover:text-gray-900">
                  {timerActive ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                </button>
                <Timer className="w-4 h-4 text-gray-400" />
                <span className="text-gray-900 font-mono text-sm min-w-[50px]">{formatTime(timer)}</span>
              </div>
              
              {/* Privacy Mode */}
              {hidePII && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-900 text-white rounded-lg text-sm font-medium">
                  <Shield className="w-4 h-4" />
                  Privacy Mode
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content - Focus Mode Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Application Queue */}
        <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
          <div className="p-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900 text-sm">Review Queue</h3>
            <div className="mt-2 h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-500" style={{ width: `${(submitted.length / applications.length) * 100}%` }} />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {applications.map((app, idx) => {
              const isDone = submitted.includes(app.id)
              const isDraft = drafts.includes(app.id)
              const isActive = idx === currentIndex
              return (
                <button 
                  key={app.id} 
                  onClick={() => setCurrentIndex(idx)} 
                  className={cn(
                    "w-full text-left p-3 rounded-xl mb-1 transition-all flex items-center justify-between",
                    isActive ? "bg-blue-50 border border-blue-200" : "hover:bg-gray-50 border border-transparent"
                  )}
                >
                  <div>
                    <p className={cn("font-medium text-sm", isActive ? "text-blue-900" : "text-gray-900")}>
                      {getDisplayTitle(app, idx)}
                    </p>
                    <p className={cn("text-xs text-gray-500 mt-0.5", hidePII && "blur-sm select-none")}>
                      {hidePII ? '████████' : app.major}
                    </p>
                  </div>
                  {isDone ? (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  ) : isDraft ? (
                    <Save className="w-4 h-4 text-amber-500" />
                  ) : isActive ? (
                    <ChevronRight className="w-4 h-4 text-blue-500" />
                  ) : (
                    <div className="w-2 h-2 rounded-full bg-gray-300" />
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Middle - Application Content */}
        <div className="flex-1 overflow-y-auto bg-gray-50">
          <div className="p-8 max-w-3xl mx-auto">
            {/* Applicant Header Card */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden mb-6">
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-blue-100 text-sm mb-1">Application #{currentIndex + 1} of {applications.length}</p>
                    <h2 className="text-2xl font-bold flex items-center gap-3">
                      {getDisplayTitle(currentApp, currentIndex)}
                      {hidePII && (
                        <span className="text-xs bg-white/20 px-2 py-0.5 rounded">
                          <Shield className="w-3 h-3 inline mr-1" />
                          Protected
                        </span>
                      )}
                    </h2>
                    <p className={cn("text-blue-100 mt-1", hidePII && "blur-sm select-none")}>
                      {hidePII ? '████████ • ████████' : `${currentApp.major} • ${currentApp.school}`}
                    </p>
                  </div>
                  {isSubmittedApp && (
                    <div className="bg-white/20 backdrop-blur-sm rounded-xl px-4 py-2 flex items-center gap-2">
                      <CheckCircle className="w-5 h-5" />
                      <span className="font-medium">Reviewed</span>
                    </div>
                  )}
                  {isDraftApp && !isSubmittedApp && (
                    <div className="bg-amber-400/20 backdrop-blur-sm rounded-xl px-4 py-2 flex items-center gap-2 text-amber-100">
                      <Save className="w-5 h-5" />
                      <span className="font-medium">Draft</span>
                    </div>
                  )}
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
                          {/* Section Header */}
                          <div className="flex items-center justify-between mb-4">
                            <h4 className="text-lg font-semibold text-gray-900">{section.title}</h4>
                            {currentHighlights.filter(h => section.fields.some(f => f.id === h.fieldName)).length > 0 && (
                              <span className="inline-flex items-center gap-1 text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full">
                                <Highlighter className="w-3 h-3" />
                                {currentHighlights.filter(h => section.fields.some(f => f.id === h.fieldName)).length} highlights
                              </span>
                            )}
                          </div>
                          
                          {/* Fields */}
                          <div className="space-y-3">
                            {section.fields.map(field => {
                              const fieldRedacted = isFieldRedacted(field.id) || isFieldRedacted(field.label)
                              const fieldHighlights = currentHighlights.filter(h => h.fieldName === field.id)
                              return (
                                <div 
                                  key={field.id} 
                                  className="group bg-white rounded-xl border border-gray-100 hover:border-gray-200 transition-all duration-200 overflow-hidden"
                                >
                                  {/* Field Label */}
                                  <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50/50 border-b border-gray-100">
                                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">{field.label}</p>
                                    <div className="flex items-center gap-2">
                                      {fieldHighlights.length > 0 && (
                                        <span className="text-xs text-yellow-600 flex items-center gap-1">
                                          <Highlighter className="w-3 h-3" />
                                          {fieldHighlights.length}
                                        </span>
                                      )}
                                      {fieldRedacted && (
                                        <span className="flex items-center gap-1 text-xs bg-gray-800 text-white px-2 py-0.5 rounded">
                                          <EyeOff className="w-3 h-3" />
                                          Hidden
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  
                                  {/* Field Value */}
                                  <div 
                                    className="px-4 py-3"
                                    onMouseUp={() => !fieldRedacted && handleTextSelection(field.id)}
                                  >
                                    {fieldRedacted ? (
                                      <div className="bg-gray-900/5 text-gray-400 px-3 py-2 rounded-lg text-sm font-mono select-none border border-gray-200">
                                        ████████████████
                                      </div>
                                    ) : (
                                      <div className="text-gray-700">
                                        {renderExternalFieldValue(field.value, field.type, hidePII ? piiValues : [])}
                                      </div>
                                    )}
                                  </div>
                                  
                                  {/* Highlights for this field */}
                                  {fieldHighlights.length > 0 && (
                                    <div className="px-4 pb-3 space-y-2">
                                      {fieldHighlights.map(h => (
                                        <div key={h.id} className="flex items-start gap-2 p-2 bg-yellow-50 rounded-lg border border-yellow-200">
                                          <Highlighter className="w-3.5 h-3.5 text-yellow-600 mt-0.5 flex-shrink-0" />
                                          <div className="flex-1 min-w-0">
                                            <p className="text-xs text-yellow-800 font-medium truncate">"{h.text}"</p>
                                            <p className="text-xs text-yellow-700 mt-0.5">{h.comment}</p>
                                          </div>
                                          <button 
                                            onClick={() => removeHighlight(h.id)}
                                            className="text-yellow-500 hover:text-yellow-700 p-0.5"
                                          >
                                            <X className="w-3 h-3" />
                                          </button>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                          
                          {section.fields.length === 0 && (
                            <div className="text-center py-8 text-gray-400">
                              <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                              <p className="text-sm">No visible fields in this section</p>
                            </div>
                          )}
                          
                          {/* Section Comment */}
                          <div className="mt-6 pt-4 border-t border-gray-100">
                            <div className="flex items-center gap-2 mb-2">
                              <MessageSquare className="w-4 h-4 text-gray-400" />
                              <label className="text-sm font-medium text-gray-600">Section Notes</label>
                            </div>
                            <textarea
                              value={currentSectionComments[section.id] || ''}
                              onChange={(e) => handleSectionComment(section.id, e.target.value)}
                              placeholder="Add notes about this section..."
                              rows={2}
                              className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none resize-none transition-all placeholder:text-gray-400"
                            />
                          </div>
                        </div>
                      )
                    ))}
                    
                    {/* Prior Reviews Section */}
                    {activeSection === 'prior-reviews' && canViewPriorScores && currentApp.priorReviews && (
                      <div className="space-y-4">
                        <h4 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                          <Star className="w-5 h-5 text-amber-500" />
                          Prior Reviews
                        </h4>
                        {currentApp.priorReviews.map((review, idx) => (
                          <div key={idx} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                            <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-100">
                              <span className="font-medium text-gray-900">{review.reviewer_name}</span>
                              <span className="text-lg font-bold text-blue-600">{review.total_score} pts</span>
                            </div>
                            <div className="p-4">
                              <div className="grid grid-cols-2 gap-2 mb-3">
                                {Object.entries(review.scores).map(([catId, score]) => {
                                  const cat = normalizedRubric.find(r => r.id === catId)
                                  return (
                                    <div key={catId} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                                      <span className="text-xs text-gray-600">{cat?.name || catId}</span>
                                      <span className="text-sm font-semibold text-gray-900">{score}/{cat?.max || '?'}</span>
                                    </div>
                                  )
                                })}
                              </div>
                              {canViewPriorComments && review.notes && Object.keys(review.notes).length > 0 && (
                                <div className="border-t border-gray-100 pt-3 mt-3">
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
        </div>

        {/* Right Sidebar - Compact Evaluation */}
        <div className="w-80 bg-white border-l border-gray-100 flex flex-col">
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                <Star className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 text-sm">Evaluation</h3>
                <p className="text-xs text-gray-500">{hasRubric ? 'Hover for guidelines' : 'Comments only'}</p>
              </div>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto">
            {isSubmittedApp ? (
              <div className="p-6 text-center">
                <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <CheckCircle className="w-8 h-8 text-emerald-600" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-1">Complete!</h3>
                {hasRubric && (
                  <p className="text-2xl font-bold text-blue-600 mb-4">{totalScore}<span className="text-sm text-gray-400 font-normal">/{maxScore}</span></p>
                )}
                <button onClick={handleEdit} className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center gap-1.5 mx-auto">
                  <Edit2 className="w-3.5 h-3.5" />
                  Edit
                </button>
              </div>
            ) : (
              <div className="p-4">
                {/* Score Summary Card */}
                {hasRubric && (
                  <div className="mb-4 p-3 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-100/50">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-blue-700">Total</span>
                      <span className="text-xl font-bold text-blue-600">{totalScore}<span className="text-xs text-blue-400 font-normal">/{maxScore}</span></span>
                    </div>
                    <div className="mt-2 h-1.5 bg-blue-200/40 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-300" style={{ width: `${scorePercent}%` }} />
                    </div>
                  </div>
                )}

                {/* No Rubric Notice */}
                {!hasRubric && (
                  <div className="mb-4 p-3 bg-amber-50 border border-amber-100 rounded-xl">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-500" />
                      <p className="text-xs font-medium text-amber-700">No rubric configured</p>
                    </div>
                  </div>
                )}

                {/* Compact Category Scores */}
                {hasRubric && normalizedRubric.length > 0 && (
                  <div className="space-y-2">
                    {normalizedRubric.map((cat) => (
                      <div 
                        key={cat.id} 
                        className="relative group"
                        onMouseEnter={() => setHoveredCategory(cat.id)}
                        onMouseLeave={() => setHoveredCategory(null)}
                      >
                        {/* Compact Score Row */}
                        <div className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 transition-colors">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-700 truncate">{cat.name}</p>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <input 
                              type="number" 
                              min="0" 
                              max={cat.max} 
                              value={currentScore[cat.id] || 0} 
                              onChange={(e) => handleScoreChange(cat.id, Math.min(cat.max, Math.max(0, parseInt(e.target.value) || 0)))} 
                              className="w-12 text-center text-sm font-semibold bg-white border border-gray-200 rounded-md py-1 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none"
                            />
                            <span className="text-xs text-gray-400">/{cat.max}</span>
                          </div>
                        </div>
                        
                        {/* Slider */}
                        <div className="px-2 pb-2">
                          <input 
                            type="range" 
                            min="0" 
                            max={cat.max} 
                            value={currentScore[cat.id] || 0} 
                            onChange={(e) => handleScoreChange(cat.id, parseInt(e.target.value))} 
                            className="w-full h-1 bg-gray-200 rounded-full appearance-none cursor-pointer accent-blue-600"
                          />
                        </div>
                        
                        {/* Hover Tooltip with Guidelines */}
                        {hoveredCategory === cat.id && cat.levels.length > 0 && (
                          <div className="absolute left-0 right-0 top-full z-20 mt-1 p-3 bg-gray-900 text-white rounded-lg shadow-xl text-xs animate-in fade-in slide-in-from-top-2 duration-200">
                            <p className="font-semibold mb-2 text-gray-200">Scoring Guidelines</p>
                            <div className="space-y-1.5">
                              {cat.levels.map((level, idx) => (
                                <div key={idx} className="flex gap-2">
                                  <span className="font-mono text-blue-300 flex-shrink-0">{level.minScore}-{level.maxScore}</span>
                                  <span className="text-gray-300">{level.description}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {/* Note Input */}
                        <div className="px-2 pb-2">
                          <input 
                            type="text" 
                            value={rubricNotes[currentApp.id]?.[cat.id] || ''} 
                            onChange={(e) => handleNoteChange(cat.id, e.target.value)} 
                            placeholder="Note..." 
                            className="w-full text-xs p-1.5 bg-gray-50 border border-gray-100 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-400 outline-none placeholder:text-gray-400"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Divider */}
                <div className="my-4 border-t border-gray-100" />
                
                {/* Status Selection */}
                {customStatuses.length > 0 && (
                  <div className="mb-4">
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">Status</label>
                    <select
                      value={currentStatus}
                      onChange={(e) => setSelectedStatus({ ...selectedStatus, [currentApp.id]: e.target.value })}
                      className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none"
                    >
                      <option value="">Select...</option>
                      {customStatuses.map((status) => (
                        <option key={status} value={status}>{status}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Tags Selection */}
                {customTags.length > 0 && (
                  <div className="mb-4">
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">Tags</label>
                    <div className="flex flex-wrap gap-1.5">
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
                              "px-2 py-1 text-xs font-medium rounded-md transition-all",
                              isSelected
                                ? "bg-blue-100 text-blue-700"
                                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
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
                <div className="mb-4">
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">
                    Overall Notes
                  </label>
                  <textarea
                    value={currentOverallComments}
                    onChange={(e) => setOverallComments({ ...overallComments, [currentApp.id]: e.target.value })}
                    placeholder="Overall thoughts..."
                    rows={2}
                    className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none resize-none placeholder:text-gray-400"
                  />
                </div>

                {/* Draft indicator */}
                {isDraftApp && (
                  <div className="mb-4 p-2 bg-amber-50 border border-amber-100 rounded-lg flex items-center gap-2 text-amber-700 text-xs">
                    <Save className="w-3.5 h-3.5" />
                    <span>Draft saved</span>
                  </div>
                )}
              </div>
            )}
          </div>
          
          {/* Fixed Bottom Actions */}
          {!isSubmittedApp && (
            <div className="p-4 border-t border-gray-100 bg-gray-50/50 space-y-2">
              <button 
                onClick={handleSubmit} 
                disabled={isSubmitting} 
                className="w-full py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 text-sm"
              >
                {isSubmitting ? (
                  <><Loader2 className="w-4 h-4 animate-spin" />Submitting...</>
                ) : (
                  <><Send className="w-4 h-4" />Submit Review</>
                )}
              </button>
              <button 
                onClick={handleSaveDraft} 
                disabled={isSavingDraft} 
                className="w-full py-2 bg-white text-gray-600 rounded-lg font-medium hover:bg-gray-100 transition-colors border border-gray-200 flex items-center justify-center gap-2 disabled:opacity-50 text-sm"
              >
                {isSavingDraft ? (
                  <><Loader2 className="w-4 h-4 animate-spin" />Saving...</>
                ) : (
                  <><Save className="w-4 h-4" />Save Draft</>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
      
      {/* Text Selection Highlight Popover */}
      {selectedText && (
        <div 
          className="fixed z-50 bg-white rounded-lg shadow-xl border border-gray-200 p-3 w-72 animate-in fade-in zoom-in-95 duration-200"
          style={{
            top: selectedText.rect.bottom + 8,
            left: Math.min(selectedText.rect.left, window.innerWidth - 300)
          }}
        >
          <div className="flex items-center gap-2 mb-2">
            <Highlighter className="w-4 h-4 text-yellow-500" />
            <span className="text-sm font-medium text-gray-900">Add Comment</span>
            <button 
              onClick={() => { setSelectedText(null); setHighlightComment('') }}
              className="ml-auto text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-gray-500 mb-2 truncate bg-yellow-50 px-2 py-1 rounded">
            "{selectedText.text.substring(0, 50)}{selectedText.text.length > 50 ? '...' : ''}"
          </p>
          <input
            ref={highlightInputRef}
            type="text"
            value={highlightComment}
            onChange={(e) => setHighlightComment(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addHighlight()}
            placeholder="Your comment..."
            className="w-full p-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none"
          />
          <button 
            onClick={addHighlight}
            disabled={!highlightComment.trim()}
            className="w-full mt-2 py-1.5 bg-yellow-500 text-white rounded-lg text-sm font-medium hover:bg-yellow-600 transition-colors disabled:opacity-50"
          >
            Add Highlight
          </button>
        </div>
      )}

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
