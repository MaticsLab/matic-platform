import { goFetch } from './go-client'

/**
 * Review Submission Export - Comprehensive data structure for review and export
 */
export interface ReviewSubmissionExport {
  submission_id: string
  form_id: string
  form_name: string
  status: string
  submitted_at?: string
  started_at: string
  last_saved_at: string
  
  // Applicant
  applicant_id: string
  applicant_email: string
  applicant_name: string
  
  // Form data (JSONB)
  form_data: Record<string, any>
  
  // Progress
  completion_percentage: number
  
  // Workflow/Review
  workflow_id?: string
  assigned_reviewer_id?: string
  current_stage?: string
  review_score?: number
  review_notes?: string
  
  // Recommendations
  recommendations_count: number
  recommendations_pending: number
  recommendations_submitted: number
  recommendation_details?: RecommendationSummary[]
  
  // Timestamps
  created_at: string
  updated_at: string
}

export interface RecommendationSummary {
  id: string
  recommender_name: string
  recommender_email: string
  recommender_relationship?: string
  recommender_organization?: string
  status: string // pending, submitted, expired, cancelled
  requested_at: string
  submitted_at?: string
  expires_at?: string
  reminder_count: number
}

export interface ReviewExportFilters {
  workspace_id: string
  form_id?: string
  status?: string // draft, submitted, in_progress, etc.
  submitted_after?: string
  submitted_before?: string
  has_recommendations?: boolean
}

export interface ReviewExportResponse {
  data: ReviewSubmissionExport[]
  count: number
  filters: {
    workspace_id: string
    form_id?: string
    status?: string
  }
}

/**
 * Review Export API Client
 * Provides methods for fetching comprehensive submission data for review and export
 */
export const reviewExportClient = {
  /**
   * Get comprehensive submission data for review workspace
   * @param filters - Query filters
   * @returns Array of enriched submission data
   */
  getExportData: async (filters: ReviewExportFilters): Promise<ReviewExportResponse> => {
    const params = new URLSearchParams()
    params.append('workspace_id', filters.workspace_id)
    
    if (filters.form_id) params.append('form_id', filters.form_id)
    if (filters.status) params.append('status', filters.status)
    if (filters.submitted_after) params.append('submitted_after', filters.submitted_after)
    if (filters.submitted_before) params.append('submitted_before', filters.submitted_before)
    if (filters.has_recommendations !== undefined) {
      params.append('has_recommendations', filters.has_recommendations.toString())
    }
    
    return goFetch<ReviewExportResponse>(`/review-export?${params}`)
  },
  
  /**
   * Export submission data to CSV format
   * @param filters - Query filters
   * @returns CSV string ready for download
   */
  exportToCSV: async (filters: ReviewExportFilters): Promise<string> => {
    const response = await reviewExportClient.getExportData(filters)
    
    if (!response?.data || !Array.isArray(response.data)) {
      throw new Error('Invalid API response: expected data array')
    }
    
    return convertToCSV(response.data)
  },
  
  /**
   * Download CSV file directly
   * @param filters - Query filters
   * @param filename - Optional custom filename
   */
  downloadCSV: async (
    filters: ReviewExportFilters,
    filename?: string
  ): Promise<void> => {
    const csv = await reviewExportClient.exportToCSV(filters)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename || `review-export-${new Date().toISOString()}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
  },
}

/**
 * Convert review submission data to CSV format
 * Flattens nested form data and recommendation details into columns
 */
function convertToCSV(data: ReviewSubmissionExport[]): string {
  if (data.length === 0) return ''
  
  // Collect all unique form field keys across all submissions
  const formFieldKeys = new Set<string>()
  data.forEach(row => {
    if (row.form_data && typeof row.form_data === 'object') {
      Object.keys(row.form_data).forEach(key => formFieldKeys.add(key))
    }
  })
  
  // Find max number of recommendations to determine recommendation columns
  const maxRecs = Math.max(...data.map(row => row.recommendations_count || 0))
  
  // Build header row
  const standardHeaders = [
    'Submission ID',
    'Form Name',
    'Applicant Name',
    'Applicant Email',
    'Status',
    'Submitted At',
    'Started At',
    'Completion %',
    'Recommendations Total',
    'Recommendations Pending',
    'Recommendations Submitted',
  ]
  
  // Add form field headers (prefixed with "Form: ")
  const formFieldHeaders = Array.from(formFieldKeys)
    .sort()
    .map(key => `Form: ${key}`)
  
  // Add recommendation headers
  const recHeaders: string[] = []
  for (let i = 1; i <= maxRecs; i++) {
    recHeaders.push(
      `Rec ${i} Name`,
      `Rec ${i} Email`,
      `Rec ${i} Status`,
      `Rec ${i} Submitted At`
    )
  }
  
  const allHeaders = [...standardHeaders, ...formFieldHeaders, ...recHeaders]
  
  // Build data rows
  const csvRows = [allHeaders.map(escapeCSVValue).join(',')]
  
  for (const row of data) {
    const values: string[] = []
    
    // Standard fields
    values.push(escapeCSVValue(row.submission_id))
    values.push(escapeCSVValue(row.form_name))
    values.push(escapeCSVValue(row.applicant_name))
    values.push(escapeCSVValue(row.applicant_email))
    values.push(escapeCSVValue(row.status))
    values.push(escapeCSVValue(row.submitted_at || ''))
    values.push(escapeCSVValue(row.started_at))
    values.push(escapeCSVValue(row.completion_percentage.toString()))
    values.push(escapeCSVValue(row.recommendations_count.toString()))
    values.push(escapeCSVValue(row.recommendations_pending.toString()))
    values.push(escapeCSVValue(row.recommendations_submitted.toString()))
    
    // Form fields (in same order as headers)
    const formData = row.form_data || {}
    for (const key of Array.from(formFieldKeys).sort()) {
      const value = formData[key]
      if (value === null || value === undefined) {
        values.push('')
      } else if (typeof value === 'object') {
        values.push(escapeCSVValue(JSON.stringify(value)))
      } else {
        values.push(escapeCSVValue(String(value)))
      }
    }
    
    // Recommendation details
    const recs = row.recommendation_details || []
    for (let i = 0; i < maxRecs; i++) {
      if (i < recs.length) {
        const rec = recs[i]
        values.push(escapeCSVValue(rec.recommender_name))
        values.push(escapeCSVValue(rec.recommender_email))
        values.push(escapeCSVValue(rec.status))
        values.push(escapeCSVValue(rec.submitted_at || ''))
      } else {
        // Empty cells for missing recommendations
        values.push('', '', '', '')
      }
    }
    
    csvRows.push(values.join(','))
  }
  
  return csvRows.join('\n')
}

/**
 * Escape a value for CSV format
 * Handles quotes, commas, and newlines
 */
function escapeCSVValue(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return ''
  
  const str = String(value)
  
  // If the value contains comma, quote, or newline, wrap in quotes and escape quotes
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  
  return str
}
