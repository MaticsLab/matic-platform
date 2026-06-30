// ── Form Analytics Response Types ─────────────────────────────────────────────

export interface FormAnalyticsOverview {
  total: number
  submitted: number
  in_progress: number
  draft: number
  avg_completion_pct: number
  completed_today: number
  new_last_7_days: number
  active_last_24_hours: number
}

export interface DailyVolume {
  date: string   // YYYY-MM-DD
  count: number
}

export interface CompletionBucket {
  range: string
  count: number
  min: number
  max: number
}

export interface FunnelStage {
  stage: string
  count: number
  pct: number
}

export interface LastActiveUser {
  user_id: string
  email: string
  name: string
  completion_pct: number
  status: string
  last_seen: string // ISO 8601
  submission_id: string
  days_inactive: number
}

export interface CheckInRecommendation {
  user_id: string
  email: string
  name: string
  completion_pct: number
  status: string
  last_seen: string
  submission_id: string
  days_inactive: number
  reason: string
}

export interface HeatmapCell {
  day: number   // 0=Sun … 6=Sat
  hour: number  // 0-23
  count: number
}

export interface FieldAnswerOption {
  value: string
  count: number
  pct: number
}

export interface FieldAnswerBreakdown {
  field_id: string
  field_label: string
  field_type: string
  answers: FieldAnswerOption[]
  total: number
}

export interface IncompleteSubmission {
  submission_id: string
  user_id: string
  email: string
  name: string
  completion_pct: number
  status: string
  last_seen: string
  started_at: string
  days_inactive: number
}

export interface FormAnalyticsResponse {
  overview: FormAnalyticsOverview
  daily_volume: DailyVolume[]
  completion_buckets: CompletionBucket[]
  funnel: FunnelStage[]
  last_active_users: LastActiveUser[]
  check_ins: CheckInRecommendation[]
  heatmap: HeatmapCell[]
  field_breakdowns: FieldAnswerBreakdown[]
  submissions: IncompleteSubmission[]
  incomplete_submissions: IncompleteSubmission[]
}
