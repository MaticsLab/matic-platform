'use client'

import React, { useEffect, useState, useMemo, useCallback } from 'react'
import {
  AreaChart, Area,
  BarChart, Bar,
  Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import {
  Users, CheckCircle2, Clock, FileText, TrendingUp,
  AlertCircle, Mail, Download, RefreshCw, ChevronRight,
  Calendar, Activity, BarChart2, Zap, Layers, PencilLine, Settings,
  ChevronDown, Search, ArrowUpDown, ArrowUp, ArrowDown,
  List, LayoutGrid, CalendarDays, X, Loader2
} from 'lucide-react'
import { formsClient } from '@/lib/api/forms-client'
import { goClient } from '@/lib/api/go-client'
import { recommendationsClient, type RecommendationRequest } from '@/lib/api/recommendations-client'
import { buildLabelMap, normalizeValueToString, stripHtml } from '@/lib/form-data-normalizer'
import { FullEmailComposer } from '@/components/ApplicationsHub/Applications/Review/FullEmailComposer'
import { ApplicationDetailSheet } from '@/components/ApplicationsHub/Applications/Review/v2/ApplicationDetailSheet'
import { useBreadcrumbs } from '@/hooks/useBreadcrumbs'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/ui-components/button'
import { ApplicationSettingsModal } from '../ApplicationsHub/Applications/Configuration/ApplicationSettingsModal'
import type { Application } from '@/components/ApplicationsHub/Applications/Review/v2/types'
import type {
  FormAnalyticsResponse,
  CheckInRecommendation,
  IncompleteSubmission,
  FieldAnswerBreakdown
} from '@/types/form-analytics'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

// ── Small helpers ─────────────────────────────────────────────────────────────

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const STATUS_COLORS: Record<string, string> = {
  submitted: '#22c55e',
  in_progress: '#3b82f6',
  draft: '#94a3b8',
}

const STATUS_LABEL: Record<string, string> = {
  submitted: 'Submitted',
  in_progress: 'In Progress',
  draft: 'Draft',
}

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(ms / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

function initials(name: string, email: string): string {
  if (name) return name.slice(0, 2).toUpperCase()
  return (email ?? '?').slice(0, 2).toUpperCase()
}

function displayName(name: string, email: string): string {
  if (name) return name
  return email || 'Unknown'
}

// ── Stat Card ─────────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string
  value: string | number
  icon: React.ReactNode
  trend?: string
  trendUp?: boolean
  color?: string
  sub?: string
}

function StatCard({ label, value, icon, trend, trendUp, color = 'blue', sub }: StatCardProps) {
  const colorMap: Record<string, { bg: string; text: string; icon: string }> = {
    blue:   { bg: 'bg-blue-50',   text: 'text-blue-600',   icon: 'bg-blue-100' },
    green:  { bg: 'bg-green-50',  text: 'text-green-600',  icon: 'bg-green-100' },
    amber:  { bg: 'bg-amber-50',  text: 'text-amber-600',  icon: 'bg-amber-100' },
    slate:  { bg: 'bg-slate-100', text: 'text-slate-500',  icon: 'bg-slate-200' },
    purple: { bg: 'bg-purple-50', text: 'text-purple-600', icon: 'bg-purple-100' },
    rose:   { bg: 'bg-rose-50',   text: 'text-rose-600',   icon: 'bg-rose-100' },
  }
  const c = colorMap[color] ?? colorMap.blue

  return (
    <div className={cn('rounded-xl border border-gray-200 p-5', c.bg)}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-1">{label}</p>
          <p className="text-2xl font-bold text-gray-900 leading-none">{value}</p>
          {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
          {trend && (
            <p className={cn('text-xs mt-1 font-medium', trendUp ? 'text-green-600' : 'text-gray-400')}>
              {trend}
            </p>
          )}
        </div>
        <div className={cn('rounded-lg p-2 flex-shrink-0', c.icon)}>
          <span className={c.text}>{icon}</span>
        </div>
      </div>
    </div>
  )
}

// ── Section Header ─────────────────────────────────────────────────────────────

function SectionHeader({ icon, title, action }: { icon: React.ReactNode; title: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <span className="text-gray-400">{icon}</span>
        <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
      </div>
      {action}
    </div>
  )
}

// ── Collapsible Section ───────────────────────────────────────────────────────

function CollapsibleSection({
  icon, title, action, children, collapsed, onToggle
}: {
  icon: React.ReactNode
  title: string
  action?: React.ReactNode
  children: React.ReactNode
  collapsed: boolean
  onToggle: () => void
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <button className="flex items-center gap-2 group" onClick={onToggle}>
          <span className="text-gray-400">{icon}</span>
          <h3 className="text-sm font-semibold text-gray-800 group-hover:text-gray-900">{title}</h3>
          <ChevronDown className={cn('w-3.5 h-3.5 text-gray-400 transition-transform duration-200', collapsed && '-rotate-90')} />
        </button>
        {action && <div className="flex items-center gap-2">{action}</div>}
      </div>
      {!collapsed && children}
    </div>
  )
}

// ── Sort Table Header ─────────────────────────────────────────────────────────

type SortKey = 'name' | 'completion_pct' | 'last_seen' | 'started_at'
type AnalyticsTabId = 'overview' | 'charts' | 'distributions' | 'fields' | 'checkins' | 'recommendations'

interface ApplicantRecommendationRow {
  submissionId: string
  applicantName: string
  applicantEmail: string
  requests: RecommendationRequest[]
  pendingRequests: RecommendationRequest[]
  submittedRequests: RecommendationRequest[]
  latestReminderAt?: string
}

interface RecommenderRecommendationGroup {
  key: string
  recommenderEmail: string
  recommenderName: string
  pendingRequests: RecommendationRequest[]
  applicants: Array<{ submissionId: string; applicantName: string; applicantEmail: string }>
  latestReminderAt?: string
}

function SortTh({ label, sortK, currentSort, dir, onSort, className }: {
  label: string; sortK: SortKey; currentSort: SortKey; dir: 'asc' | 'desc'
  onSort: (k: SortKey) => void; className?: string
}) {
  const active = currentSort === sortK
  return (
    <th className={cn('text-left text-xs font-medium px-4 py-3', className)}>
      <button
        className={cn('flex items-center gap-1 group transition-colors', active ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700')}
        onClick={() => onSort(sortK)}
      >
        {label}
        {active
          ? (dir === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)
          : <ArrowUpDown className="w-3 h-3 opacity-0 group-hover:opacity-40 transition-opacity" />}
      </button>
    </th>
  )
}

// ── Kanban View ───────────────────────────────────────────────────────────────

function KanbanView({ submissions, onUserClick }: { submissions: IncompleteSubmission[], onUserClick: (id: string) => void }) {
  const columns = [
    { key: 'draft',       label: 'Draft',       badge: 'bg-slate-200 text-slate-600' },
    { key: 'in_progress', label: 'In Progress', badge: 'bg-blue-100 text-blue-700' },
    { key: 'submitted',   label: 'Submitted',   badge: 'bg-green-100 text-green-700' },
  ]
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {columns.map(col => {
        const items = submissions.filter(s => s.status === col.key)
        return (
          <div key={col.key} className="bg-gray-50 rounded-xl p-3 border border-gray-200 min-h-[120px]">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-gray-600">{col.label}</span>
              <span className={cn('text-xs font-bold px-2 py-0.5 rounded-full', col.badge)}>{items.length}</span>
            </div>
            <div className="space-y-2">
              {items.map(s => (
                <div
                  key={s.submission_id}
                  className="bg-white rounded-lg border border-gray-200 p-3 cursor-pointer hover:border-blue-300 hover:shadow-sm transition-all"
                  onClick={() => onUserClick(s.submission_id)}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-[9px] font-semibold text-slate-600 flex-shrink-0">
                      {initials(s.name, s.email)}
                    </div>
                    <p className="text-xs text-gray-800 font-medium truncate flex-1">{displayName(s.name, s.email)}</p>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <CompletionRing pct={s.completion_pct} size={18} />
                      <span className="text-[10px] text-gray-500">{s.completion_pct}%</span>
                    </div>
                    <span className="text-[10px] text-gray-400">{relativeTime(s.last_seen)}</span>
                  </div>
                </div>
              ))}
              {items.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-6">No submissions</p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Calendar View ─────────────────────────────────────────────────────────────

function CalendarView({ submissions, onUserClick }: { submissions: IncompleteSubmission[], onUserClick: (id: string) => void }) {
  const [currentMonth, setCurrentMonth] = useState(() => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), 1) })
  const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate()
  const firstDayOfWeek = currentMonth.getDay()
  const byDate = useMemo(() => {
    const map: Record<string, IncompleteSubmission[]> = {}
    submissions.forEach(s => {
      const key = (s.last_seen || s.started_at)?.split('T')[0]
      if (key) { if (!map[key]) map[key] = []; map[key].push(s) }
    })
    return map
  }, [submissions])
  const todayStr = new Date().toISOString().split('T')[0]
  const monthStr = currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' })
  const cells: (number | null)[] = [...Array(firstDayOfWeek).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)]
  while (cells.length % 7 !== 0) cells.push(null)
  return (
    <div className="bg-white rounded-xl">
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
          <ChevronDown className="w-4 h-4 rotate-90 text-gray-500" />
        </button>
        <span className="text-sm font-semibold text-gray-800">{monthStr}</span>
        <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
          <ChevronDown className="w-4 h-4 -rotate-90 text-gray-500" />
        </button>
      </div>
      <div className="grid grid-cols-7 mb-1">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
          <div key={d} className="text-center text-[10px] font-medium text-gray-400 py-1">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (!day) return <div key={`e-${i}`} className="min-h-[56px]" />
          const y = currentMonth.getFullYear()
          const m = String(currentMonth.getMonth() + 1).padStart(2, '0')
          const dateKey = `${y}-${m}-${String(day).padStart(2, '0')}`
          const items = byDate[dateKey] || []
          const isToday = dateKey === todayStr
          return (
            <div key={day} className={cn(
              'min-h-[56px] rounded-lg p-1 border transition-colors',
              isToday ? 'border-blue-400 bg-blue-50' : items.length > 0 ? 'border-blue-100 bg-blue-50/30' : 'border-gray-100 hover:bg-gray-50'
            )}>
              <div className={cn('text-[11px] font-medium text-center mb-0.5', isToday ? 'text-blue-600' : 'text-gray-500')}>{day}</div>
              {items.slice(0, 2).map(s => (
                <div
                  key={s.submission_id}
                  className="truncate cursor-pointer text-[9px] bg-blue-100 text-blue-700 rounded px-1 mb-0.5 hover:bg-blue-200 transition-colors"
                  onClick={() => onUserClick(s.submission_id)}
                  title={displayName(s.name, s.email)}
                >
                  {displayName(s.name, s.email)}
                </div>
              ))}
              {items.length > 2 && <div className="text-[9px] text-gray-400 text-center">+{items.length - 2}</div>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Badge ─────────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    submitted:   'bg-green-50 text-green-700 border-green-200',
    in_progress: 'bg-blue-50 text-blue-700 border-blue-200',
    draft:       'bg-slate-100 text-slate-600 border-slate-300',
  }
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border', map[status] ?? map.draft)}>
      {STATUS_LABEL[status] ?? status}
    </span>
  )
}

// ── Completion Ring ───────────────────────────────────────────────────────────

function CompletionRing({ pct, size = 32 }: { pct: number; size?: number }) {
  const r = (size - 4) / 2
  const circ = 2 * Math.PI * r
  const filled = (pct / 100) * circ
  const color = pct >= 100 ? '#22c55e' : pct >= 50 ? '#3b82f6' : '#94a3b8'

  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e2e8f0" strokeWidth={4} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={4}
        strokeDasharray={circ} strokeDashoffset={circ - filled} strokeLinecap="round" />
    </svg>
  )
}

// ── Raw submission type (from /forms/:id/submissions) ────────────────────────

interface RawSubmission {
  id: string
  data: Record<string, any>
  status: string
  created_at: string
  submitted_at?: string
  ba_user?: { id: string; email: string; name: string }
}

// ── Map raw submission + schema fields → Application ─────────────────────────

function subToApplication(sub: RawSubmission): Application {
  const name = sub.ba_user?.name || sub.data?._applicant_name || sub.data?.name || ''
  const email = sub.ba_user?.email || sub.data?._applicant_email || sub.data?.email || ''
  const parts = name.trim().split(' ')
  const firstName = parts[0] || ''
  const lastName = parts.slice(1).join(' ') || ''
  return {
    id: sub.id,
    firstName,
    lastName,
    name: name || email,
    email,
    status: sub.status || 'draft',
    submittedDate: sub.submitted_at || sub.created_at,
    reviewedCount: 0,
    totalReviewers: 0,
    raw_data: sub.data ?? {},
  }
}

// ── CSV Export helper ─────────────────────────────────────────────────────────

function csvEscape(val: any): string {
  const s = val == null ? '' : String(val)
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

// ── Normalisation uses @/lib/form-data-normalizer (buildLabelMap, normalizeValueToString, stripHtml)

function exportToCSV(
  submissions: RawSubmission[],
  fields: Array<{ id: string; label: string; name: string; type: string; category: string }>,
  formName: string,
  formId: string,
) {
  // Build a flat map covering every field UUID and every field_key → human label
  const labelMap = buildLabelMap(fields)

  const metaCols = [
    { key: 'id',           label: 'Submission ID' },
    { key: 'email',        label: 'Email' },
    { key: 'name',         label: 'Name' },
    { key: 'status',       label: 'Status' },
    { key: 'started_at',   label: 'Started At' },
    { key: 'submitted_at', label: 'Submitted At' },
  ]

  // Data fields only (skip layout fields).
  // If schema fetch failed, fall back to auto-discovered keys from submissions.
  const dataFields = fields.filter(f => f.category === 'data')
  const useFallback = dataFields.length === 0

  const fallbackKeys = useFallback
    ? Array.from(new Set(submissions.flatMap(s => Object.keys(s.data ?? {}))))
        .filter(k => !k.startsWith('_') && k !== 'id')
    : []

  const fieldColumns = useFallback
    ? fallbackKeys.map(k => ({ key: k, label: labelMap[k] || k }))
    : dataFields.map(f  => ({ key: f.id,  label: stripHtml(f.label) || f.name, type: f.type, name: f.name }))

  const header = [
    ...metaCols.map(c => csvEscape(c.label)),
    ...fieldColumns.map(c => csvEscape(c.label)),
  ].join(',')

  const dataRows = submissions.map(sub => {
    const rawData  = sub.data ?? {}
    const email    = sub.ba_user?.email || rawData._applicant_email || rawData.email || ''
    const name     = sub.ba_user?.name  || rawData._applicant_name  || rawData.name  || ''
    const metaVals = [sub.id, email, name, sub.status, sub.created_at, sub.submitted_at ?? '']

    const dataCols = fieldColumns.map(col => {
      // Look up by UUID id first, then by field_key name
      const raw = rawData[(col as any).key] ?? rawData[(col as any).name ?? ''] ?? ''
      return csvEscape(normalizeValueToString(raw, (col as any).type ?? '', labelMap))
    })

    return [...metaVals.map(csvEscape), ...dataCols].join(',')
  })

  const csv = [header, ...dataRows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `${formName || 'form'}-submissions-${new Date().toISOString().split('T')[0]}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ── Main Component ─────────────────────────────────────────────────────────────

interface Props {
  formId: string
  workspaceId: string
}

export function FormAnalyticsPage({ formId, workspaceId }: Props) {
  const [data, setData] = useState<FormAnalyticsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [formName, setFormName] = useState<string>('')
  const [formFields, setFormFields] = useState<Array<{ id: string; label: string; name: string; type: string; category: string; section_id?: string }>>([])  
  const [formSections, setFormSections] = useState<Array<{ id: string; name: string; description?: string; sort_order: number }>>([])
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set())
  const [emailOpen, setEmailOpen] = useState(false)
  const [emailRecipients, setEmailRecipients] = useState<string[]>([])
  const [refreshing, setRefreshing] = useState(false)
  // Submission detail panel
  const [submissions, setSubmissions] = useState<RawSubmission[]>([])
  const [submissionsLoaded, setSubmissionsLoaded] = useState(false)
  const [submissionsLoading, setSubmissionsLoading] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailApp, setDetailApp] = useState<Application | null>(null)
  const [isAppSettingsModalOpen, setIsAppSettingsModalOpen] = useState(false)

  // ── Section state ──────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<AnalyticsTabId>('overview')
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set())
  const toggleSection = useCallback((id: string) => {
    setCollapsedSections(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }, [])

  // ── Submission list controls ───────────────────────────────────────────────
  const [submissionSearch, setSubmissionSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('last_seen')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [statusFilter, setStatusFilter] = useState('all')
  const [submissionView, setSubmissionView] = useState<'list' | 'kanban' | 'calendar'>('list')
  const [recommendationRows, setRecommendationRows] = useState<ApplicantRecommendationRow[]>([])
  const [recommendationsLoaded, setRecommendationsLoaded] = useState(false)
  const [recommendationsLoading, setRecommendationsLoading] = useState(false)
  const [sendingRecommendationReminders, setSendingRecommendationReminders] = useState(false)
  const [selectedRecommendationSubmissions, setSelectedRecommendationSubmissions] = useState<Set<string>>(new Set())
  const [selectedRecommendationGroups, setSelectedRecommendationGroups] = useState<Set<string>>(new Set())
  const [recommendationSearch, setRecommendationSearch] = useState('')
  const [showAllRecommenders, setShowAllRecommenders] = useState(false)
  const [recommendationGrouping, setRecommendationGrouping] = useState<'applicant' | 'recommender'>('applicant')
  const [editingRecommendationId, setEditingRecommendationId] = useState<string | null>(null)
  const [editingRecommenderEmail, setEditingRecommenderEmail] = useState('')
  const [savingRecommenderEmail, setSavingRecommenderEmail] = useState(false)
  const handleSort = useCallback((key: SortKey) => {
    setSortDir(prev => key === sortKey ? (prev === 'asc' ? 'desc' : 'asc') : 'asc')
    setSortKey(key)
  }, [sortKey])

  const params = useParams()
  const router = useRouter()
  const workspaceSlug = params?.slug as string

  // Breadcrumb items
  const breadcrumbItems = useMemo(() => [
    { label: 'Forms', href: `/workspace/${workspaceSlug}/applications`, icon: Layers },
    { label: formName || 'Form', href: `/workspace/${workspaceSlug}/applications/${formId}`, icon: BarChart2 },
  ], [workspaceSlug, formId, formName])

  // Breadcrumb action buttons
  const breadcrumbActions = useMemo(() => (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          if (workspaceSlug && formId) {
            router.push(`/workspace/${workspaceSlug}/applications/${formId}/analytics`)
          }
        }}
        title="Review Submissions"
      >
        <FileText className="w-4 h-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          if (workspaceSlug && formId) {
            router.push(`/workspace/${workspaceSlug}/portal-editor?formId=${formId}`)
          }
        }}
        title="Form Editor"
      >
        <PencilLine className="w-4 h-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsAppSettingsModalOpen(true)}
        title="Form Settings"
      >
        <Settings className="w-4 h-4" />
      </Button>
    </>
  ), [workspaceSlug, formId, router])

  const breadcrumbOptions = useMemo(() => ({ actions: breadcrumbActions }), [breadcrumbActions])

  // Breadcrumbs
  useBreadcrumbs(breadcrumbItems, breadcrumbOptions)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const result = await formsClient.getAnalytics(formId)
      setData(result)
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load analytics')
      toast.error('Failed to load form analytics')
    } finally {
      setLoading(false)
    }
    // Load form schema (sections + fields) separately — non-fatal
    try {
      // /api/v2/forms/:id returns the form with nested sections[] and fields[]
      const formV2 = await goClient.get<any>(`/api/v2/forms/${formId}`)
      if (formV2?.name) setFormName(formV2.name)
      if (Array.isArray(formV2?.sections)) {
        setFormSections(
          formV2.sections.map((s: any) => ({
            id: s.id,
            name: s.name,
            description: s.description ?? undefined,
            sort_order: s.sort_order ?? 0,
          }))
        )
      }
      if (Array.isArray(formV2?.fields) && formV2.fields.length > 0) {
        setFormFields(
          formV2.fields.map((f: any) => ({
            id: f.id,
            label: f.label,
            name: f.field_key,
            type: f.field_type,
            category: f.category ?? 'data',
            section_id: f.section_id ?? undefined,
          }))
        )
      }
    } catch {
      // schema is optional — CSV falls back to auto-detecting keys
    }
  }, [formId])

  const refresh = useCallback(async () => {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }, [load])

  useEffect(() => { load() }, [load])

  // ── Lazy-load full submissions (for detail panel + export) ────────────────

  const loadSubmissions = useCallback(async (): Promise<RawSubmission[]> => {
    if (submissionsLoaded) return submissions
    setSubmissionsLoading(true)
    try {
      const list = await goClient.get<RawSubmission[]>(
        `/forms/${formId}/submissions?include_user=true&limit=500`
      )
      const arr = Array.isArray(list) ? list : []
      setSubmissions(arr)
      setSubmissionsLoaded(true)
      return arr
    } catch {
      toast.error('Failed to load submission details')
      return []
    } finally {
      setSubmissionsLoading(false)
    }
  }, [formId, submissionsLoaded, submissions])

  const loadRecommendationRows = useCallback(async () => {
    setRecommendationsLoading(true)
    try {
      const list = await loadSubmissions()
      const rows: ApplicantRecommendationRow[] = []

      await Promise.all(
        list.map(async (sub) => {
          try {
            const requests = await recommendationsClient.list(sub.id)
            if (!requests.length) return
            const pendingRequests = requests.filter(r => r.status === 'pending')
            const submittedRequests = requests.filter(r => r.status === 'submitted')

            const latestReminderAt = pendingRequests
              .map(r => r.reminded_at)
              .filter((d): d is string => Boolean(d))
              .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0]

            rows.push({
              submissionId: sub.id,
              applicantName: sub.ba_user?.name || sub.data?._applicant_name || sub.data?.name || '',
              applicantEmail: sub.ba_user?.email || sub.data?._applicant_email || sub.data?.email || '',
              requests,
              pendingRequests,
              submittedRequests,
              latestReminderAt,
            })
          } catch {
            // Some submissions may not have recommendation requests or may be inaccessible.
          }
        })
      )

      rows.sort((a, b) => {
        if (b.pendingRequests.length !== a.pendingRequests.length) {
          return b.pendingRequests.length - a.pendingRequests.length
        }
        return b.submittedRequests.length - a.submittedRequests.length
      })
      setRecommendationRows(rows)
      setRecommendationsLoaded(true)
      setSelectedRecommendationSubmissions(prev => {
        const next = new Set<string>()
        rows.forEach(r => {
          if (prev.has(r.submissionId) && r.pendingRequests.length > 0) next.add(r.submissionId)
        })
        return next
      })
    } catch (err: any) {
      toast.error(err?.message || 'Failed to load recommendation reminders')
    } finally {
      setRecommendationsLoading(false)
    }
  }, [loadSubmissions])

  useEffect(() => {
    if (activeTab === 'recommendations' && !recommendationsLoaded) {
      void loadRecommendationRows()
    }
  }, [activeTab, recommendationsLoaded, loadRecommendationRows])

  const handleUserClick = useCallback(async (submissionId: string) => {
    const list = await loadSubmissions()
    const sub = list.find(s => s.id === submissionId)
    if (!sub) {
      toast.error('Could not find submission details')
      return
    }
    setDetailApp(subToApplication(sub))
    setDetailOpen(true)
  }, [loadSubmissions])

  const handleExport = useCallback(async () => {
    const list = await loadSubmissions()
    if (list.length === 0) {
      toast.error('No submissions to export')
      return
    }
    exportToCSV(list, formFields, formName, formId)
    toast.success(`Exported ${list.length} submissions`)
  }, [loadSubmissions, formFields, formName, formId])

  // ── Helpers ────────────────────────────────────────────────────────────────

  function openEmailComposer(recipients: string[]) {
    setEmailRecipients(recipients.filter(Boolean))
    setEmailOpen(true)
  }

  function toggleRow(id: string) {
    setSelectedRows(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function selectAll(ids: string[]) {
    setSelectedRows(prev => prev.size === ids.length ? new Set() : new Set(ids))
  }

  // ── Heatmap max count ──────────────────────────────────────────────────────
  const heatmapMax = useMemo(() => {
    if (!data?.heatmap) return 1
    return Math.max(...data.heatmap.map(c => c.count), 1)
  }, [data?.heatmap])

  const heatmapMap = useMemo(() => {
    const m: Record<string, number> = {}
    data?.heatmap?.forEach(c => { m[`${c.day}-${c.hour}`] = c.count })
    return m
  }, [data?.heatmap])

  const filteredSubmissions = useMemo(() => {
    const list = data?.submissions ?? data?.incomplete_submissions ?? []
    let filtered = statusFilter !== 'all' ? list.filter(s => s.status === statusFilter) : list
    if (submissionSearch) {
      const q = submissionSearch.toLowerCase()
      filtered = filtered.filter(s =>
        (s.name || '').toLowerCase().includes(q) || (s.email || '').toLowerCase().includes(q)
      )
    }
    return [...filtered].sort((a, b) => {
      let av: any, bv: any
      if (sortKey === 'name') { av = (a.name || a.email || '').toLowerCase(); bv = (b.name || b.email || '').toLowerCase() }
      else if (sortKey === 'completion_pct') { av = a.completion_pct; bv = b.completion_pct }
      else if (sortKey === 'started_at') { av = a.started_at || ''; bv = b.started_at || '' }
      else { av = a.last_seen || ''; bv = b.last_seen || '' }
      if (av < bv) return sortDir === 'asc' ? -1 : 1
      if (av > bv) return sortDir === 'asc' ? 1 : -1
      return 0
    })
  }, [data?.submissions, data?.incomplete_submissions, submissionSearch, statusFilter, sortKey, sortDir])

  const analyticsTabs = useMemo(() => {
    const fieldBreakdowns = data?.field_breakdowns ?? []
    const checkIns = data?.check_ins ?? []

    const tabs: Array<{ id: AnalyticsTabId; label: string; count?: number }> = [
      { id: 'overview', label: 'Overview' },
      { id: 'charts', label: 'Volume & Funnel' },
      { id: 'distributions', label: 'Distributions & Activity' },
    ]

    if (fieldBreakdowns.length > 0) {
      tabs.push({ id: 'fields', label: 'Field Answer Breakdown', count: fieldBreakdowns.length })
    }

    if (checkIns.length > 0) {
      tabs.push({ id: 'checkins', label: 'Recommended Check-ins', count: checkIns.length })
    }

    tabs.push({ id: 'recommendations', label: 'Letters of Recommendation', count: recommendationRows.length })

    return tabs
  }, [data?.check_ins, data?.field_breakdowns, recommendationRows.length])

  const filteredRecommendationRows = useMemo(() => {
    const q = recommendationSearch.trim().toLowerCase()
    if (!q) return recommendationRows

    return recommendationRows.filter((row) => {
      const applicantMatches =
        row.applicantName.toLowerCase().includes(q) ||
        row.applicantEmail.toLowerCase().includes(q)

      const recommenderMatches = row.requests.some((req) =>
        (req.recommender_name || '').toLowerCase().includes(q) ||
        (req.recommender_email || '').toLowerCase().includes(q)
      )

      return applicantMatches || recommenderMatches
    })
  }, [recommendationRows, recommendationSearch])

  const selectedRecommendationRows = recommendationRows.filter(row => selectedRecommendationSubmissions.has(row.submissionId))
  const selectedFilteredRecommendationCount = filteredRecommendationRows.filter(row => selectedRecommendationSubmissions.has(row.submissionId)).length

  const groupedRecommendationRows = useMemo<RecommenderRecommendationGroup[]>(() => {
    const groups = new Map<string, RecommenderRecommendationGroup>()

    filteredRecommendationRows.forEach((row) => {
      row.pendingRequests.forEach((req) => {
        const email = (req.recommender_email || '').trim().toLowerCase()
        if (!email) return

        const key = email
        const existing = groups.get(key)
        if (!existing) {
          groups.set(key, {
            key,
            recommenderEmail: req.recommender_email || email,
            recommenderName: req.recommender_name || '',
            pendingRequests: [req],
            applicants: [{
              submissionId: row.submissionId,
              applicantName: row.applicantName,
              applicantEmail: row.applicantEmail,
            }],
            latestReminderAt: req.reminded_at,
          })
          return
        }

        existing.pendingRequests.push(req)
        const hasApplicant = existing.applicants.some(a => a.submissionId === row.submissionId)
        if (!hasApplicant) {
          existing.applicants.push({
            submissionId: row.submissionId,
            applicantName: row.applicantName,
            applicantEmail: row.applicantEmail,
          })
        }
        if (req.reminded_at && (!existing.latestReminderAt || new Date(req.reminded_at).getTime() > new Date(existing.latestReminderAt).getTime())) {
          existing.latestReminderAt = req.reminded_at
        }
        if (!existing.recommenderName && req.recommender_name) {
          existing.recommenderName = req.recommender_name
        }
      })
    })

    return Array.from(groups.values()).sort((a, b) => {
      const aReminderTime = a.latestReminderAt ? new Date(a.latestReminderAt).getTime() : 0
      const bReminderTime = b.latestReminderAt ? new Date(b.latestReminderAt).getTime() : 0
      if (bReminderTime !== aReminderTime) return bReminderTime - aReminderTime
      return b.pendingRequests.length - a.pendingRequests.length
    })
  }, [filteredRecommendationRows])

  const selectedRecommendationGroupRows = groupedRecommendationRows.filter(group => selectedRecommendationGroups.has(group.key))
  const selectedFilteredRecommendationGroupCount = groupedRecommendationRows.filter(group => selectedRecommendationGroups.has(group.key)).length

  const toggleRecommendationRow = useCallback((submissionId: string) => {
    const row = recommendationRows.find(r => r.submissionId === submissionId)
    if (!row || row.pendingRequests.length === 0) return

    setSelectedRecommendationSubmissions(prev => {
      const next = new Set(prev)
      if (next.has(submissionId)) next.delete(submissionId)
      else next.add(submissionId)
      return next
    })
  }, [recommendationRows])

  const toggleAllRecommendationRows = useCallback(() => {
    setSelectedRecommendationSubmissions(prev => {
      const next = new Set(prev)
      const filteredIds = filteredRecommendationRows
        .filter(row => row.pendingRequests.length > 0)
        .map(row => row.submissionId)
      const allFilteredSelected = filteredIds.length > 0 && filteredIds.every(id => next.has(id))

      if (allFilteredSelected) {
        filteredIds.forEach(id => next.delete(id))
      } else {
        filteredIds.forEach(id => next.add(id))
      }

      return next
    })
  }, [filteredRecommendationRows])

  const startEditRecommenderEmail = useCallback((req: RecommendationRequest) => {
    setEditingRecommendationId(req.id)
    setEditingRecommenderEmail(req.recommender_email || '')
    setShowAllRecommenders(true)
  }, [])

  const cancelEditRecommenderEmail = useCallback(() => {
    setEditingRecommendationId(null)
    setEditingRecommenderEmail('')
  }, [])

  const saveRecommenderEmail = useCallback(async (req: RecommendationRequest) => {
    const nextEmail = editingRecommenderEmail.trim()
    if (!nextEmail || !nextEmail.includes('@')) {
      toast.error('Enter a valid recommender email address')
      return
    }

    setSavingRecommenderEmail(true)
    try {
      await recommendationsClient.update(req.id, { recommender_email: nextEmail })
      toast.success('Recommender email updated')
      cancelEditRecommenderEmail()
      await loadRecommendationRows()
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update recommender email')
    } finally {
      setSavingRecommenderEmail(false)
    }
  }, [cancelEditRecommenderEmail, editingRecommenderEmail, loadRecommendationRows])

  const toggleRecommendationGroup = useCallback((groupKey: string) => {
    setSelectedRecommendationGroups(prev => {
      const next = new Set(prev)
      if (next.has(groupKey)) next.delete(groupKey)
      else next.add(groupKey)
      return next
    })
  }, [])

  const toggleAllRecommendationGroups = useCallback(() => {
    setSelectedRecommendationGroups(prev => {
      const next = new Set(prev)
      const keys = groupedRecommendationRows.map(group => group.key)
      const allSelected = keys.length > 0 && keys.every(key => next.has(key))

      if (allSelected) {
        keys.forEach(key => next.delete(key))
      } else {
        keys.forEach(key => next.add(key))
      }

      return next
    })
  }, [groupedRecommendationRows])

  const sendRemindersForRows = useCallback(async (rows: ApplicantRecommendationRow[]) => {
    if (rows.length === 0) {
      toast.error('Select at least one applicant with pending recommendation requests')
      return
    }

    setSendingRecommendationReminders(true)
    let sentCount = 0
    let failedCount = 0

    try {
      for (const row of rows) {
        for (const request of row.pendingRequests) {
          try {
            await recommendationsClient.sendReminder(request.id)
            sentCount += 1
          } catch {
            failedCount += 1
          }
        }
      }

      if (sentCount > 0 && failedCount === 0) {
        toast.success(`Sent ${sentCount} reminder${sentCount === 1 ? '' : 's'}`)
      } else if (sentCount > 0 && failedCount > 0) {
        toast.warning(`Sent ${sentCount} reminder${sentCount === 1 ? '' : 's'}, ${failedCount} failed`)
      } else {
        toast.error('Failed to send recommendation reminders')
      }

      await loadRecommendationRows()
    } finally {
      setSendingRecommendationReminders(false)
    }
  }, [loadRecommendationRows])

  const sendRemindersForGroups = useCallback(async (groups: RecommenderRecommendationGroup[]) => {
    if (groups.length === 0) {
      toast.error('Select at least one recommender group')
      return
    }

    setSendingRecommendationReminders(true)
    let sentCount = 0
    let failedCount = 0

    try {
      for (const group of groups) {
        for (const request of group.pendingRequests) {
          try {
            await recommendationsClient.sendReminder(request.id)
            sentCount += 1
          } catch {
            failedCount += 1
          }
        }
      }

      if (sentCount > 0 && failedCount === 0) {
        toast.success(`Sent ${sentCount} reminder${sentCount === 1 ? '' : 's'}`)
      } else if (sentCount > 0 && failedCount > 0) {
        toast.warning(`Sent ${sentCount} reminder${sentCount === 1 ? '' : 's'}, ${failedCount} failed`)
      } else {
        toast.error('Failed to send recommendation reminders')
      }

      await loadRecommendationRows()
    } finally {
      setSendingRecommendationReminders(false)
    }
  }, [loadRecommendationRows])

  useEffect(() => {
    if (!analyticsTabs.some(tab => tab.id === activeTab)) {
      setActiveTab('overview')
    }
  }, [activeTab, analyticsTabs])

  // ── Loading / Error states ────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 gap-3">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-gray-500">Loading analytics…</p>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 gap-3">
        <AlertCircle className="w-8 h-8 text-rose-500" />
        <p className="text-sm text-rose-500">{error ?? 'No data'}</p>
        <button onClick={load} className="text-sm text-blue-600 underline">Retry</button>
      </div>
    )
  }

  const { overview, daily_volume, completion_buckets, funnel, last_active_users,
    check_ins, field_breakdowns, incomplete_submissions, submissions: analyticsSubmissions } = data

  const allSubmissions = analyticsSubmissions ?? incomplete_submissions

  const submissionIds = filteredSubmissions.map(s => s.submission_id)
  const selectedEmails = filteredSubmissions
    .filter(s => selectedRows.has(s.submission_id))
    .map(s => s.email)
    .filter(Boolean)

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Form Analytics</h1>
            <p className="text-xs text-gray-500 mt-0.5">Real-time submission insights & user management</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExport}
              disabled={submissionsLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-600 bg-white hover:bg-gray-50 border border-gray-200 rounded-lg transition-colors disabled:opacity-50"
            >
              {submissionsLoading
                ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                : <Download className="w-3.5 h-3.5" />}
              Export CSV
            </button>
            <button
              onClick={refresh}
              disabled={refreshing}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-600 bg-white hover:bg-gray-50 border border-gray-200 rounded-lg transition-colors disabled:opacity-50"
            >
              <RefreshCw className={cn('w-3.5 h-3.5', refreshing && 'animate-spin')} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="px-6 py-6 space-y-8">

        <div className="flex flex-wrap items-center gap-2">
          {analyticsTabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                activeTab === tab.id
                  ? 'border-blue-200 bg-blue-50 text-blue-700'
                  : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              )}
            >
              <span>{tab.label}</span>
              {typeof tab.count === 'number' && (
                <span className={cn(
                  'rounded-full px-1.5 py-0.5 text-[10px]',
                  activeTab === tab.id ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'
                )}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {activeTab === 'overview' && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 gap-3">
            <StatCard label="Total Submissions" value={overview.total} icon={<FileText className="w-4 h-4" />} color="blue" />
            <StatCard label="Submitted" value={overview.submitted}
              icon={<CheckCircle2 className="w-4 h-4" />} color="green"
              sub={overview.total > 0 ? `${Math.round(overview.submitted / overview.total * 100)}% of total` : undefined} />
            <StatCard label="In Progress" value={overview.in_progress} icon={<Clock className="w-4 h-4" />} color="amber" />
            <StatCard label="Draft / Not Started" value={overview.draft} icon={<FileText className="w-4 h-4" />} color="slate" />
            <StatCard label="Avg Completion" value={`${overview.avg_completion_pct}%`}
              icon={<TrendingUp className="w-4 h-4" />} color="purple" />
            <StatCard label="Active Last 24h" value={overview.active_last_24_hours} icon={<Activity className="w-4 h-4" />} color="blue" />
            <StatCard label="New Last 7 Days" value={overview.new_last_7_days} icon={<Calendar className="w-4 h-4" />} color="purple" />
            <StatCard label="Completed Today" value={overview.completed_today}
              icon={<Zap className="w-4 h-4" />} color="green" />
          </div>
        )}

        {activeTab === 'charts' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Daily Volume */}
          <div className="lg:col-span-2 bg-white border border-gray-200 rounded-xl p-5">
            <SectionHeader icon={<BarChart2 className="w-4 h-4" />} title="Submission Volume (Last 30 Days)" />
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={daily_volume} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                <defs>
                  <linearGradient id="volGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }}
                  tickFormatter={d => d.slice(5)} interval={4} />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, color: '#1e293b' }}
                  labelStyle={{ color: '#64748b' }} />
                <Area type="monotone" dataKey="count" stroke="#3b82f6" fill="url(#volGrad)"
                  strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Submission Funnel */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <SectionHeader icon={<ChevronRight className="w-4 h-4" />} title="Completion Funnel" />
            <div className="space-y-3 mt-2">
              {funnel.map((stage, i) => (
                <div key={stage.stage}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-700">{stage.stage}</span>
                    <span className="text-gray-500">{stage.count} ({stage.pct}%)</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-gray-200 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${stage.pct}%`,
                        background: i === 0 ? '#475569' : i === 1 ? '#3b82f6' : '#22c55e'
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
          </div>
        )}

        {activeTab === 'distributions' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* Completion Distribution */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <SectionHeader icon={<TrendingUp className="w-4 h-4" />} title="Completion Distribution" />
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={completion_buckets} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="range" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, color: '#1e293b' }}
                  cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {completion_buckets.map((b, i) => (
                    <Cell key={b.range}
                      fill={b.max === 100 ? '#22c55e' : b.max === 0 ? '#e2e8f0' : `hsl(${210 + i * 20}, 70%, 55%)`} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Activity Heatmap */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <SectionHeader icon={<Activity className="w-4 h-4" />} title="Activity Heatmap (Day × Hour)" />
            <div className="overflow-x-auto">
              <div className="min-w-[400px]">
                {/* Hour labels */}
                <div className="flex gap-[2px] ml-8 mb-1">
                  {[0, 3, 6, 9, 12, 15, 18, 21].map(h => (
                    <div key={h} className="text-[9px] text-gray-400 flex-1 text-center">{h}</div>
                  ))}
                </div>
                {DAY_LABELS.map((day, d) => (
                  <div key={day} className="flex items-center gap-[2px] mb-[2px]">
                    <span className="text-[9px] text-gray-400 w-7 flex-shrink-0">{day}</span>
                    {Array.from({ length: 24 }).map((_, h) => {
                      const count = heatmapMap[`${d}-${h}`] ?? 0
                      const intensity = count === 0 ? 0 : Math.max(0.15, count / heatmapMax)
                      return (
                        <div
                          key={h}
                          title={`${day} ${h}:00 — ${count} submission${count !== 1 ? 's' : ''}`}
                          className="flex-1 aspect-square rounded-[2px] cursor-default"
                          style={{
                            background: count === 0
                              ? '#f1f5f9'
                              : `rgba(59, 130, 246, ${intensity})`
                          }}
                        />
                      )
                    })}
                  </div>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2 mt-3">
              <span className="text-[10px] text-gray-400">Less</span>
              {[0.1, 0.3, 0.5, 0.7, 0.9, 1].map(op => (
                <div key={op} className="w-3 h-3 rounded-sm" style={{ background: `rgba(59,130,246,${op})` }} />
              ))}
              <span className="text-[10px] text-gray-400">More</span>
            </div>
          </div>
          </div>
        )}

        {/* ── Field Answer Breakdowns ────────────────────────────────────── */}
        {activeTab === 'fields' && field_breakdowns.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <span className="text-gray-400"><BarChart2 className="w-4 h-4" /></span>
              <h3 className="text-sm font-semibold text-gray-800">Field Answer Breakdown</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {field_breakdowns.map((f: FieldAnswerBreakdown) => (
                <div key={f.field_id} className="bg-white border border-gray-200 rounded-xl p-4">
                  <p className="text-xs font-medium text-gray-700 mb-3 truncate">{f.field_label}</p>
                  <div className="space-y-2">
                    {f.answers.slice(0, 6).map(a => (
                      <div key={a.value}>
                        <div className="flex justify-between text-xs mb-0.5">
                          <span className="text-gray-600 truncate max-w-[70%]">{a.value}</span>
                          <span className="text-gray-400 ml-2 flex-shrink-0">{a.count} ({a.pct}%)</span>
                        </div>
                        <div className="h-1 rounded-full bg-gray-200 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-blue-500 transition-all"
                            style={{ width: `${a.pct}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-gray-400 mt-2">{f.total} total responses</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Recommended Check-ins ──────────────────────────────────────── */}
        {activeTab === 'checkins' && check_ins.length > 0 && (
          <div>
            <SectionHeader
              icon={<AlertCircle className="w-4 h-4 text-amber-400" />}
              title={`Recommended Check-ins (${check_ins.length})`}
              action={
                <button
                  onClick={() => openEmailComposer(check_ins.map(c => c.email).filter(Boolean))}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition-colors"
                >
                  <Mail className="w-3.5 h-3.5" />
                  Email All
                </button>
              }
            />
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left text-xs text-gray-500 font-medium px-4 py-3">User</th>
                    <th className="text-left text-xs text-gray-500 font-medium px-4 py-3">Status</th>
                    <th className="text-left text-xs text-gray-500 font-medium px-4 py-3">Completion</th>
                    <th className="text-left text-xs text-gray-500 font-medium px-4 py-3 hidden md:table-cell">Reason</th>
                    <th className="text-left text-xs text-gray-500 font-medium px-4 py-3">Last Seen</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {check_ins.slice(0, 25).map((ci: CheckInRecommendation) => (
                    <tr
                      key={ci.submission_id}
                      className="border-b border-gray-100 hover:bg-blue-50 transition-colors cursor-pointer"
                      onClick={(e) => { if ((e.target as HTMLElement).closest('button')) return; handleUserClick(ci.submission_id) }}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-semibold text-slate-600 flex-shrink-0">
                            {initials(ci.name, ci.email)}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs text-gray-800 truncate">{displayName(ci.name, ci.email)}</p>
                            {ci.name && <p className="text-[10px] text-gray-400 truncate">{ci.email}</p>}</div></div>
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={ci.status} /></td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <CompletionRing pct={ci.completion_pct} size={24} />
                          <span className="text-xs text-gray-600">{ci.completion_pct}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span className={cn(
                          'text-xs',
                          ci.days_inactive >= 14 ? 'text-rose-500' : ci.days_inactive >= 7 ? 'text-amber-600' : 'text-gray-400'
                        )}>
                          {ci.reason}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-gray-400">{relativeTime(ci.last_seen)}</span>
                      </td>
                      <td className="px-4 py-3">
                        {ci.email && (
                          <button
                            onClick={() => openEmailComposer([ci.email])}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                            title={`Send email to ${ci.email}`}
                          >
                            <Mail className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'recommendations' && (
          <div>
            <SectionHeader
              icon={<Mail className="w-4 h-4" />}
              title={`Letters of Recommendation (${recommendationRows.length})`}
              action={
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => void loadRecommendationRows()}
                    disabled={recommendationsLoading}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-600 bg-white hover:bg-gray-50 border border-gray-200 rounded-lg transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className={cn('w-3.5 h-3.5', recommendationsLoading && 'animate-spin')} />
                    Refresh
                  </button>
                  <button
                    onClick={() => {
                      if (recommendationGrouping === 'recommender') {
                        void sendRemindersForGroups(selectedRecommendationGroupRows)
                      } else {
                        void sendRemindersForRows(selectedRecommendationRows)
                      }
                    }}
                    disabled={
                      sendingRecommendationReminders ||
                      (recommendationGrouping === 'recommender'
                        ? selectedRecommendationGroupRows.length === 0
                        : selectedRecommendationRows.length === 0)
                    }
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {sendingRecommendationReminders ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />}
                    Send Reminder to Selected ({recommendationGrouping === 'recommender' ? selectedRecommendationGroupRows.length : selectedRecommendationRows.length})
                  </button>
                </div>
              }
            />

            {recommendationsLoading ? (
              <div className="bg-white border border-gray-200 rounded-xl p-8 flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                <p className="text-sm text-gray-500">Loading recommendation requests...</p>
              </div>
            ) : recommendationRows.length === 0 ? (
              <div className="bg-white border border-gray-200 rounded-xl p-8 flex flex-col items-center gap-2">
                <Mail className="w-8 h-8 text-gray-400" />
                <p className="text-sm text-gray-700 font-medium">No pending recommendation reminders</p>
                <p className="text-xs text-gray-400">Applicants with pending recommendation requests will appear here.</p>
              </div>
            ) : (
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className="flex flex-wrap items-center gap-2 p-3 border-b border-gray-100 bg-gray-50/60">
                  <div className="relative flex-1 min-w-[220px]">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                    <input
                      value={recommendationSearch}
                      onChange={(e) => setRecommendationSearch(e.target.value)}
                      placeholder="Search recommender or applicant..."
                      className="w-full pl-8 pr-8 py-1.5 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
                    />
                    {recommendationSearch && (
                      <button onClick={() => setRecommendationSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                  <button
                    onClick={() => setShowAllRecommenders(prev => !prev)}
                    className={cn(
                      'px-2.5 py-1.5 text-xs rounded-lg border transition-colors',
                      showAllRecommenders
                        ? 'text-blue-700 bg-blue-50 border-blue-200 hover:bg-blue-100'
                        : 'text-gray-600 bg-white border-gray-200 hover:bg-gray-50'
                    )}
                  >
                    {showAllRecommenders ? 'Showing all recommenders' : 'Show all recommenders'}
                  </button>
                  <button
                    onClick={() => setRecommendationGrouping(prev => prev === 'applicant' ? 'recommender' : 'applicant')}
                    className={cn(
                      'px-2.5 py-1.5 text-xs rounded-lg border transition-colors',
                      recommendationGrouping === 'recommender'
                        ? 'text-blue-700 bg-blue-50 border-blue-200 hover:bg-blue-100'
                        : 'text-gray-600 bg-white border-gray-200 hover:bg-gray-50'
                    )}
                  >
                    {recommendationGrouping === 'recommender' ? 'Grouped by recommender email' : 'Group by recommender email'}
                  </button>
                  <span className="text-xs text-gray-400">
                    {filteredRecommendationRows.length} of {recommendationRows.length} applicants
                  </span>
                </div>

                {recommendationGrouping === 'applicant' && filteredRecommendationRows.length === 0 ? (
                  <div className="p-8 flex flex-col items-center gap-2 text-center">
                    <Search className="w-6 h-6 text-gray-300" />
                    <p className="text-sm text-gray-500">No recommender matches your search</p>
                  </div>
                ) : recommendationGrouping === 'recommender' && groupedRecommendationRows.length === 0 ? (
                  <div className="p-8 flex flex-col items-center gap-2 text-center">
                    <Search className="w-6 h-6 text-gray-300" />
                    <p className="text-sm text-gray-500">No recommender groups match your search</p>
                  </div>
                ) : recommendationGrouping === 'recommender' ? (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="px-4 py-3 w-10">
                        <input
                          type="checkbox"
                          checked={selectedFilteredRecommendationGroupCount === groupedRecommendationRows.length && groupedRecommendationRows.length > 0}
                          onChange={toggleAllRecommendationGroups}
                          className="rounded border-gray-300 bg-white text-blue-600 cursor-pointer"
                        />
                      </th>
                      <th className="text-left text-xs text-gray-500 font-medium px-4 py-3">Recommender</th>
                      <th className="text-left text-xs text-gray-500 font-medium px-4 py-3">Applicants</th>
                      <th className="text-left text-xs text-gray-500 font-medium px-4 py-3">Pending Letters</th>
                      <th className="text-left text-xs text-gray-500 font-medium px-4 py-3">Last Reminder</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {groupedRecommendationRows.map((group) => (
                      <tr key={group.key} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 w-10">
                          <input
                            type="checkbox"
                            checked={selectedRecommendationGroups.has(group.key)}
                            onChange={() => toggleRecommendationGroup(group.key)}
                            className="rounded border-gray-300 bg-white text-blue-600 cursor-pointer"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-xs text-gray-800 font-medium">{group.recommenderName || group.recommenderEmail}</p>
                          {group.recommenderName && (
                            <p className="text-[10px] text-gray-400">{group.recommenderEmail}</p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1.5">
                            {(showAllRecommenders ? group.applicants : group.applicants.slice(0, 3)).map((applicant) => (
                              <span key={`${group.key}-${applicant.submissionId}`} className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-[10px] text-gray-700">
                                {displayName(applicant.applicantName, applicant.applicantEmail)}
                              </span>
                            ))}
                            {!showAllRecommenders && group.applicants.length > 3 && (
                              <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-[10px] text-gray-600">
                                +{group.applicants.length - 3} more
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] text-amber-700">
                            {group.pendingRequests.length}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs text-gray-400">{group.latestReminderAt ? relativeTime(group.latestReminderAt) : 'Never'}</span>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => void sendRemindersForGroups([group])}
                            disabled={sendingRecommendationReminders}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors disabled:opacity-50"
                            title="Send reminder"
                          >
                            {sendingRecommendationReminders ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="px-4 py-3 w-10">
                        <input
                          type="checkbox"
                          checked={selectedFilteredRecommendationCount === filteredRecommendationRows.length && filteredRecommendationRows.length > 0}
                          onChange={toggleAllRecommendationRows}
                          className="rounded border-gray-300 bg-white text-blue-600 cursor-pointer"
                        />
                      </th>
                      <th className="text-left text-xs text-gray-500 font-medium px-4 py-3">Applicant</th>
                      <th className="text-left text-xs text-gray-500 font-medium px-4 py-3">Recommenders</th>
                      <th className="text-left text-xs text-gray-500 font-medium px-4 py-3">Last Reminder</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRecommendationRows.map((row) => (
                      <tr key={row.submissionId} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 w-10">
                          <input
                            type="checkbox"
                            checked={selectedRecommendationSubmissions.has(row.submissionId)}
                            onChange={() => toggleRecommendationRow(row.submissionId)}
                            disabled={row.pendingRequests.length === 0}
                            className="rounded border-gray-300 bg-white text-blue-600 cursor-pointer"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-xs text-gray-800 font-medium">{displayName(row.applicantName, row.applicantEmail)}</p>
                          {row.applicantName && row.applicantEmail && (
                            <p className="text-[10px] text-gray-400">{row.applicantEmail}</p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1.5">
                            {(showAllRecommenders ? row.requests : row.requests.slice(0, 3)).map(req => (
                              <span
                                key={req.id}
                                className={cn(
                                  'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] gap-1',
                                  req.status === 'submitted'
                                    ? 'border-green-200 bg-green-50 text-green-700'
                                    : req.status === 'pending'
                                      ? 'border-amber-200 bg-amber-50 text-amber-700'
                                      : 'border-gray-200 bg-gray-50 text-gray-600'
                                )}
                              >
                                {editingRecommendationId === req.id ? (
                                  <>
                                    <input
                                      value={editingRecommenderEmail}
                                      onChange={(e) => setEditingRecommenderEmail(e.target.value)}
                                      className="h-5 w-40 rounded border border-gray-300 px-1.5 text-[10px] text-gray-700 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
                                      onClick={(e) => e.stopPropagation()}
                                    />
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        void saveRecommenderEmail(req)
                                      }}
                                      disabled={savingRecommenderEmail}
                                      className="text-blue-700 hover:text-blue-800"
                                      title="Save"
                                    >
                                      {savingRecommenderEmail ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Save'}
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        cancelEditRecommenderEmail()
                                      }}
                                      className="text-gray-500 hover:text-gray-700"
                                      title="Cancel"
                                    >
                                      Cancel
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <span>{req.recommender_name || req.recommender_email}</span>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        startEditRecommenderEmail(req)
                                      }}
                                      disabled={req.status !== 'pending'}
                                      className="text-gray-500 hover:text-gray-700 disabled:opacity-40"
                                      title={req.status === 'pending' ? 'Edit recommender email' : 'Only pending requests can be edited'}
                                    >
                                      <PencilLine className="w-3 h-3" />
                                    </button>
                                  </>
                                )}
                              </span>
                            ))}
                            {!showAllRecommenders && row.requests.length > 3 && (
                              <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-[10px] text-gray-600">
                                +{row.requests.length - 3} more
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs text-gray-400">{row.latestReminderAt ? relativeTime(row.latestReminderAt) : 'Never'}</span>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => void sendRemindersForRows([row])}
                            disabled={sendingRecommendationReminders || row.pendingRequests.length === 0}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors disabled:opacity-50"
                            title="Send reminder"
                          >
                            {sendingRecommendationReminders ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Submissions ──────────────────────────────────────────────────── */}
        <CollapsibleSection
          icon={<Users className="w-4 h-4" />}
          title={`Submissions (${allSubmissions.length})`}
          collapsed={collapsedSections.has('incomplete')}
          onToggle={() => toggleSection('incomplete')}
          action={
            selectedRows.size > 0 ? (
              <button
                onClick={() => openEmailComposer(selectedEmails)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors"
              >
                <Mail className="w-3.5 h-3.5" />
                Email Selected ({selectedRows.size})
              </button>
            ) : undefined
          }
        >
          {allSubmissions.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-xl p-8 flex flex-col items-center gap-2">
              <Users className="w-8 h-8 text-gray-400" />
              <p className="text-sm text-gray-700 font-medium">No submissions yet</p>
              <p className="text-xs text-gray-400">Submissions will appear here once users start applying.</p>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              {/* Toolbar */}
              <div className="flex flex-wrap items-center gap-2 p-3 border-b border-gray-100 bg-gray-50/60">
                <div className="relative flex-1 min-w-[180px]">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                  <input
                    value={submissionSearch}
                    onChange={e => setSubmissionSearch(e.target.value)}
                    placeholder="Search by name or email…"
                    className="w-full pl-8 pr-8 py-1.5 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
                  />
                  {submissionSearch && (
                    <button onClick={() => setSubmissionSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                  className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
                >
                  <option value="all">All Statuses</option>
                  <option value="draft">Draft</option>
                  <option value="in_progress">In Progress</option>
                  <option value="submitted">Submitted</option>
                </select>
                <div className="flex items-center rounded-lg border border-gray-200 bg-white overflow-hidden">
                  {(['list', 'kanban', 'calendar'] as const).map(v => (
                    <button
                      key={v}
                      onClick={() => setSubmissionView(v)}
                      className={cn('p-1.5 transition-colors', submissionView === v ? 'bg-blue-50 text-blue-600' : 'text-gray-400 hover:bg-gray-50')}
                      title={v.charAt(0).toUpperCase() + v.slice(1)}
                    >
                      {v === 'list'     && <List className="w-3.5 h-3.5" />}
                      {v === 'kanban'   && <LayoutGrid className="w-3.5 h-3.5" />}
                      {v === 'calendar' && <CalendarDays className="w-3.5 h-3.5" />}
                    </button>
                  ))}
                </div>
                {filteredSubmissions.length !== allSubmissions.length && (
                  <span className="text-xs text-gray-400">{filteredSubmissions.length} of {allSubmissions.length}</span>
                )}
              </div>

              {/* Kanban / Calendar / List views */}
              {submissionView === 'kanban' ? (
                <div className="p-4">
                  <KanbanView submissions={filteredSubmissions} onUserClick={handleUserClick} />
                </div>
              ) : submissionView === 'calendar' ? (
                <div className="p-4">
                  <CalendarView submissions={filteredSubmissions} onUserClick={handleUserClick} />
                </div>
              ) : filteredSubmissions.length === 0 ? (
                <div className="p-8 flex flex-col items-center gap-2 text-center">
                  <Search className="w-6 h-6 text-gray-300" />
                  <p className="text-sm text-gray-500">No submissions match your filters</p>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="px-4 py-3 w-10">
                        <input
                          type="checkbox"
                          checked={selectedRows.size === submissionIds.length && submissionIds.length > 0}
                          onChange={() => selectAll(submissionIds)}
                          className="rounded border-gray-300 bg-white text-blue-600 cursor-pointer"
                        />
                      </th>
                      <SortTh label="User" sortK="name" currentSort={sortKey} dir={sortDir} onSort={handleSort} />
                      <th className="text-left text-xs text-gray-500 font-medium px-4 py-3">Status</th>
                      <SortTh label="Completion" sortK="completion_pct" currentSort={sortKey} dir={sortDir} onSort={handleSort} />
                      <SortTh label="Started" sortK="started_at" currentSort={sortKey} dir={sortDir} onSort={handleSort} className="hidden md:table-cell" />
                      <SortTh label="Last Active" sortK="last_seen" currentSort={sortKey} dir={sortDir} onSort={handleSort} />
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSubmissions.map((s: IncompleteSubmission) => (
                      <tr key={s.submission_id} className={cn(
                        'border-b border-gray-100 hover:bg-gray-50 transition-colors',
                        selectedRows.has(s.submission_id) && 'bg-blue-50'
                      )}>
                        <td className="px-4 py-3 w-10" onClick={e => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedRows.has(s.submission_id)}
                            onChange={() => toggleRow(s.submission_id)}
                            className="rounded border-gray-300 bg-white text-blue-600 cursor-pointer"
                          />
                        </td>
                        <td
                          className="px-4 py-3 cursor-pointer group"
                          onClick={() => handleUserClick(s.submission_id)}
                        >
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-semibold text-slate-600 flex-shrink-0">
                              {initials(s.name, s.email)}
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs text-gray-800 truncate">{displayName(s.name, s.email)}</p>
                              {s.name && <p className="text-[10px] text-gray-400 truncate">{s.email}</p>}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3"><StatusBadge status={s.status} /></td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <CompletionRing pct={s.completion_pct} size={24} />
                            <span className="text-xs text-gray-600">{s.completion_pct}%</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          <span className="text-xs text-gray-400">{relativeTime(s.started_at)}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={cn(
                            'text-xs',
                            s.days_inactive >= 14 ? 'text-rose-500' : s.days_inactive >= 7 ? 'text-amber-600' : 'text-gray-400'
                          )}>
                            {relativeTime(s.last_seen)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {s.email && (
                            <button
                              onClick={() => openEmailComposer([s.email])}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                              title={`Send email to ${s.email}`}
                            >
                              <Mail className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </CollapsibleSection>

        {/* ── Last Active Users ──────────────────────────────────────────── */}
        {last_active_users.length > 0 && (
          <CollapsibleSection icon={<Users className="w-4 h-4" />} title="Recent Activity" collapsed={collapsedSections.has('recent')} onToggle={() => toggleSection('recent')}>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {last_active_users.slice(0, 8).map(u => (
                <div
                  key={u.submission_id}
                  onClick={() => handleUserClick(u.submission_id)}
                  className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col gap-2 cursor-pointer hover:border-blue-300 hover:shadow-sm transition-all"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-semibold text-slate-600 flex-shrink-0">
                      {initials(u.name, u.email)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-gray-800 font-medium truncate">{displayName(u.name, u.email)}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <StatusBadge status={u.status} />
                      </div>
                    </div>
                    <CompletionRing pct={u.completion_pct} size={28} />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-gray-400">{relativeTime(u.last_seen)}</span>
                    <span className="text-[10px] text-blue-600">{u.completion_pct}%</span>
                  </div>
                </div>
              ))}
            </div>
          </CollapsibleSection>
        )}

        {/* Bottom padding */}
        <div className="h-8" />
      </div>

      {/* Email Composer */}
      <FullEmailComposer
        open={emailOpen}
        onClose={() => setEmailOpen(false)}
        workspaceId={workspaceId}
        formId={formId}
        recipientEmails={emailRecipients}
        initialSubject="Following up on your application"
        onSent={() => {
          setEmailOpen(false)
          toast.success('Email sent successfully')
        }}
      />

      {/* Submission Detail Panel */}
      {detailApp && (
        <ApplicationDetailSheet
          open={detailOpen}
          onOpenChange={setDetailOpen}
          application={detailApp}
          reviewersMap={{}}
          workspaceId={workspaceId}
          formId={formId}
          onStatusChange={(appId, newStatus) => {
            setDetailApp(prev => prev ? { ...prev, status: newStatus } : null)
            // Update cached submissions
            setSubmissions(prev =>
              prev.map(s => s.id === appId ? { ...s, status: newStatus } : s)
            )
          }}
          sections={formSections}
          fields={formFields.map(f => ({ id: f.id, label: f.label, type: f.type || 'text', name: f.name, section_id: f.section_id }))}
        />
      )}

      {/* App Settings Modal */}
      {isAppSettingsModalOpen && (
        <ApplicationSettingsModal
          open={isAppSettingsModalOpen}
          onOpenChange={setIsAppSettingsModalOpen}
          formId={formId}
          workspaceId={workspaceId}
          onSave={() => setIsAppSettingsModalOpen(false)}
        />
      )}
    </div>
  )
}
