/**
 * AI Reports API Client
 * Handles natural language report generation and workspace statistics
 */

import { goFetch } from './go-client'
import type { AIReportResponse, WorkspaceStats, ReportQueryCheck } from '@/types/search'

/**
 * Generate an AI-powered report from a natural language query
 */
export async function generateReport(
  workspaceId: string, 
  query: string
): Promise<AIReportResponse> {
  return goFetch<AIReportResponse>(
    `/reports/generate?workspace_id=${workspaceId}`,
    {
      method: 'POST',
      body: JSON.stringify({ query })
    }
  )
}

/**
 * Get workspace statistics
 */
export async function getWorkspaceStats(workspaceId: string): Promise<{ stats: WorkspaceStats; generated: string }> {
  return goFetch<{ stats: WorkspaceStats; generated: string }>(
    `/reports/stats?workspace_id=${workspaceId}`
  )
}

/**
 * Check if a query should trigger AI report generation
 */
export async function checkReportQuery(query: string): Promise<ReportQueryCheck> {
  return goFetch<ReportQueryCheck>(
    `/reports/is-report-query?q=${encodeURIComponent(query)}`
  )
}

/**
 * Client-side check for report query patterns (faster than API call)
 */
export function isReportQueryLocal(query: string): boolean {
  const lowerQuery = query.toLowerCase()
  const reportPatterns = [
    'how many',
    'total',
    'count',
    'report',
    'summary',
    'statistics',
    'stats',
    'breakdown',
    'trend',
    'growth',
    'insights',
    'analysis',
    'analyze',
    'compare',
    'show me',
    'what is',
    'what are',
    'who has',
    'who are',
    'list all',
    'give me',
  ]
  
  return reportPatterns.some(pattern => lowerQuery.includes(pattern))
}

/**
 * Classify report query type locally
 */
export function classifyReportType(query: string): string {
  const lowerQuery = query.toLowerCase()
  
  if (/how many|count|total|number of/.test(lowerQuery)) {
    return 'count'
  }
  if (/trend|over time|growth|change|compared to|vs|versus/.test(lowerQuery)) {
    return 'trend'
  }
  if (/breakdown|by|per|group|each|distribution/.test(lowerQuery)) {
    return 'breakdown'
  }
  if (/list|show|all|who|which/.test(lowerQuery)) {
    return 'list'
  }
  if (/summary|overview|report|status|insights/.test(lowerQuery)) {
    return 'summary'
  }
  
  return 'general'
}

/**
 * Format a data point value for display
 */
export function formatDataPointValue(value: number | string, type?: string): string {
  if (typeof value === 'number') {
    if (type === 'percentage') {
      return `${value.toFixed(1)}%`
    }
    if (type === 'currency') {
      return `$${value.toLocaleString()}`
    }
    return value.toLocaleString()
  }
  return String(value)
}

/**
 * Get trend icon based on trend direction
 */
export function getTrendIcon(trend?: string): string {
  switch (trend) {
    case 'up': return '↑'
    case 'down': return '↓'
    case 'stable': return '→'
    default: return ''
  }
}

/**
 * Get trend color class based on trend direction
 */
export function getTrendColor(trend?: string): string {
  switch (trend) {
    case 'up': return 'text-green-500'
    case 'down': return 'text-red-500'
    case 'stable': return 'text-gray-500'
    default: return 'text-gray-400'
  }
}

export const reportsClient = {
  generateReport,
  getWorkspaceStats,
  checkReportQuery,
  isReportQueryLocal,
  classifyReportType,
  formatDataPointValue,
  getTrendIcon,
  getTrendColor,
}
