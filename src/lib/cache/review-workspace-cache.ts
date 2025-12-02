'use client'

/**
 * Review Workspace Cache Layer
 * 
 * Provides instant UI rendering by caching:
 * - Form structure (rarely changes)
 * - Workflow configuration (changes occasionally)
 * - Submissions (frequently changes - use realtime for updates)
 * 
 * Strategy:
 * 1. Render immediately from cache
 * 2. Fetch fresh data in background
 * 3. Merge updates silently
 */

// Cache keys
const CACHE_PREFIX = 'matic_review_'
const CACHE_VERSION = 'v1'

interface CacheEntry<T> {
  data: T
  timestamp: number
  version: string
}

interface FormCache {
  id: string
  name: string
  fields: any[]
  settings: any
  workspace_id: string
}

interface WorkflowCache {
  workflows: any[]
  stages: any[]
  rubrics: any[]
  reviewer_types: any[]
  groups: any[]
  stage_groups: any[]
  workflow_actions: any[]
}

interface SubmissionsCache {
  submissions: any[]
  lastFetchedAt: number
}

// Cache TTLs (in milliseconds)
const TTL = {
  FORM: 5 * 60 * 1000,         // 5 minutes - form structure rarely changes
  WORKFLOW: 2 * 60 * 1000,     // 2 minutes - workflow config changes occasionally
  SUBMISSIONS: 30 * 1000,       // 30 seconds - use realtime for live updates
}

function getCacheKey(type: string, id: string): string {
  return `${CACHE_PREFIX}${CACHE_VERSION}_${type}_${id}`
}

function isExpired(timestamp: number, ttl: number): boolean {
  return Date.now() - timestamp > ttl
}

// Generic cache operations
export function getFromCache<T>(type: string, id: string, ttl: number): T | null {
  if (typeof window === 'undefined') return null
  
  try {
    const key = getCacheKey(type, id)
    const stored = localStorage.getItem(key)
    
    if (!stored) return null
    
    const entry: CacheEntry<T> = JSON.parse(stored)
    
    // Check version and expiry
    if (entry.version !== CACHE_VERSION || isExpired(entry.timestamp, ttl)) {
      localStorage.removeItem(key)
      return null
    }
    
    return entry.data
  } catch (e) {
    console.warn('Cache read error:', e)
    return null
  }
}

export function setInCache<T>(type: string, id: string, data: T): void {
  if (typeof window === 'undefined') return
  
  try {
    const key = getCacheKey(type, id)
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      version: CACHE_VERSION,
    }
    localStorage.setItem(key, JSON.stringify(entry))
  } catch (e) {
    console.warn('Cache write error:', e)
    // If localStorage is full, clear old cache entries
    clearExpiredCache()
  }
}

export function invalidateCache(type: string, id: string): void {
  if (typeof window === 'undefined') return
  
  try {
    const key = getCacheKey(type, id)
    localStorage.removeItem(key)
  } catch (e) {
    console.warn('Cache invalidate error:', e)
  }
}

function clearExpiredCache(): void {
  if (typeof window === 'undefined') return
  
  try {
    const keys = Object.keys(localStorage).filter(k => k.startsWith(CACHE_PREFIX))
    for (const key of keys) {
      try {
        const stored = localStorage.getItem(key)
        if (stored) {
          const entry = JSON.parse(stored)
          // Remove if old version or very stale (> 1 hour)
          if (entry.version !== CACHE_VERSION || isExpired(entry.timestamp, 60 * 60 * 1000)) {
            localStorage.removeItem(key)
          }
        }
      } catch {
        localStorage.removeItem(key)
      }
    }
  } catch (e) {
    console.warn('Cache cleanup error:', e)
  }
}

// Specific cache operations for Review Workspace

export function getCachedForm(formId: string): FormCache | null {
  return getFromCache<FormCache>('form', formId, TTL.FORM)
}

export function setCachedForm(formId: string, form: FormCache): void {
  setInCache('form', formId, form)
}

export function getCachedWorkflow(workspaceId: string): WorkflowCache | null {
  return getFromCache<WorkflowCache>('workflow', workspaceId, TTL.WORKFLOW)
}

export function setCachedWorkflow(workspaceId: string, workflow: WorkflowCache): void {
  setInCache('workflow', workspaceId, workflow)
}

export function getCachedSubmissions(formId: string): SubmissionsCache | null {
  return getFromCache<SubmissionsCache>('submissions', formId, TTL.SUBMISSIONS)
}

export function setCachedSubmissions(formId: string, submissions: any[]): void {
  setInCache('submissions', formId, {
    submissions,
    lastFetchedAt: Date.now(),
  })
}

// Cache the entire review workspace data
export interface ReviewWorkspaceCache {
  form: FormCache
  workflow: WorkflowCache
  submissions: any[]
  cachedAt: number
}

export function getCachedReviewWorkspace(formId: string): ReviewWorkspaceCache | null {
  if (typeof window === 'undefined') return null
  
  const form = getCachedForm(formId)
  if (!form) return null
  
  const workflow = getCachedWorkflow(form.workspace_id)
  const submissionsCache = getCachedSubmissions(formId)
  
  // We need at least form to render something useful
  return {
    form,
    workflow: workflow || {
      workflows: [],
      stages: [],
      rubrics: [],
      reviewer_types: [],
      groups: [],
      stage_groups: [],
      workflow_actions: [],
    },
    submissions: submissionsCache?.submissions || [],
    cachedAt: Math.min(
      form ? Date.now() : 0,
      submissionsCache?.lastFetchedAt || 0
    ),
  }
}

export function setCachedReviewWorkspace(
  formId: string, 
  workspaceId: string,
  data: {
    form: any
    workflows: any[]
    stages: any[]
    rubrics: any[]
    reviewer_types: any[]
    groups: any[]
    stage_groups: any[]
    workflow_actions: any[]
    submissions: any[]
  }
): void {
  // Cache form structure
  setCachedForm(formId, {
    id: data.form.id,
    name: data.form.name,
    fields: data.form.fields,
    settings: data.form.settings,
    workspace_id: workspaceId,
  })
  
  // Cache workflow config
  setCachedWorkflow(workspaceId, {
    workflows: data.workflows,
    stages: data.stages,
    rubrics: data.rubrics,
    reviewer_types: data.reviewer_types,
    groups: data.groups,
    stage_groups: data.stage_groups,
    workflow_actions: data.workflow_actions,
  })
  
  // Cache submissions
  setCachedSubmissions(formId, data.submissions)
}
