'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

// Stub functions for deprecated cache functionality
type ReviewWorkspaceCache = {
  form: any;
  submissions: any[];
};

const getCachedReviewWorkspace = (formId: string, workspaceId: string): ReviewWorkspaceCache | null => null;
const setCachedReviewWorkspace = (formId: string, workspaceId: string, data: ReviewWorkspaceCache) => {};

import { formsClient } from '@/lib/api/forms-client'
import { RealtimeApplication } from './useApplicationsRealtime'

type DirectSubmission = {
  id: string
  form_id: string
  data?: Record<string, unknown>
  metadata?: Record<string, unknown>
  created_at: string
  submitted_at?: string | null
  updated_at?: string
}

interface UseOptimisticReviewDataOptions {
  formId: string | null
  workspaceId: string
  enabled?: boolean
}

interface ReviewDataState {
  form: any | null
  submissions: any[]
  isFromCache: boolean
  isFetching: boolean
  error: Error | null
}

/**
 * Optimistic Review Data Hook
 * 
 * Loading strategy:
 * 1. INSTANT: Render from localStorage cache (0ms)
 * 2. FAST: Fetch submissions directly from Supabase (~50-80ms)
 * 3. COMPLETE: Fetch full data from Go backend for complex joins (~150-250ms)
 * 
 * This gives users instant visual feedback while fresh data loads in background.
 */
export function useOptimisticReviewData({
  formId,
  workspaceId,
  enabled = true,
}: UseOptimisticReviewDataOptions) {
  const [state, setState] = useState<ReviewDataState>({
    form: null,
    submissions: [],
    isFromCache: false,
    isFetching: false,
    error: null,
  })
  
  const mountedRef = useRef(true)
  const fetchingRef = useRef(false)
  
  // Phase 1: Load from cache instantly
  useEffect(() => {
    if (!formId || !enabled) return
    
    console.time('📦 Cache load')
    const cached = getCachedReviewWorkspace(formId, workspaceId)
    console.timeEnd('📦 Cache load')
    
    if (cached && cached.form) {
      console.log('✅ Loaded from cache, rendering instantly')
      setState(prev => ({
        ...prev,
        form: cached.form,
        submissions: cached.submissions,
        isFromCache: true,
      }))
    }
  }, [formId, enabled])
  
  // Phase 2 & 3: Fetch fresh data
  const fetchData = useCallback(async () => {
    if (!formId || !workspaceId || !enabled || fetchingRef.current) return
    
    fetchingRef.current = true
    setState(prev => ({ ...prev, isFetching: true }))
    
    try {
      // Load fresh data from the Go backend
      console.log('🔄 Fetching review workspace data from Go backend')

      const [form, submissions] = await Promise.all([
        formsClient.get(formId),
        formsClient.getSubmissions(formId)
      ])
      
      if (!mountedRef.current) return
      
      // Merge complete data
      setState(prev => ({
        ...prev,
        form: form,
        submissions: submissions as any[],
        isFromCache: false,
        isFetching: false,
      }))
      
      // Cache for next time
      setCachedReviewWorkspace(formId, workspaceId, {
        form: form,
        submissions: (submissions as DirectSubmission[]) || [],
      })
      
    } catch (error) {
      console.error('Failed to fetch review data:', error)
      if (mountedRef.current) {
        setState(prev => ({
          ...prev,
          error: error as Error,
          isFetching: false,
        }))
      }
    } finally {
      fetchingRef.current = false
    }
  }, [formId, workspaceId, enabled])
  
  // Trigger fetch on mount
  useEffect(() => {
    fetchData()
    
    return () => {
      mountedRef.current = false
    }
  }, [fetchData])
  
  // Handle realtime submission updates
  const handleSubmissionInsert = useCallback((app: RealtimeApplication) => {
    setState(prev => {
      // Don't add duplicates
      if (prev.submissions.some(s => s.id === app.id)) return prev
      
      const newSubmission: DirectSubmission = {
        id: app.id,
        form_id: formId || '',
        metadata: app.metadata,
        created_at: app.created_at,
        submitted_at: app.submitted_at,
        updated_at: app.created_at,
      }
      
      return {
        ...prev,
        submissions: [newSubmission, ...prev.submissions],
      }
    })
  }, [formId])
  
  const handleSubmissionUpdate = useCallback((app: RealtimeApplication) => {
    setState(prev => ({
      ...prev,
      submissions: prev.submissions.map(s => 
        s.id === app.id 
          ? {
              ...s,
              data: app.data,
              metadata: app.metadata,
              updated_at: new Date().toISOString(),
            }
          : s
      ),
    }))
  }, [])
  
  const handleSubmissionDelete = useCallback((id: string) => {
    setState(prev => ({
      ...prev,
      submissions: prev.submissions.filter(s => s.id !== id),
    }))
  }, [])
  
  // Refresh submissions only (fast)
  const refreshSubmissions = useCallback(async () => {
    if (!formId) return
    
    try {
      const submissions = await formsClient.getSubmissions(formId)
      setState(prev => ({
        ...prev,
        submissions: submissions as any[],
      }))
    } catch (error) {
      console.error('Failed to refresh submissions:', error)
    }
  }, [formId])
  
  // Full refresh
  const refresh = useCallback(() => {
    fetchingRef.current = false
    fetchData()
  }, [fetchData])
  
  return {
    ...state,
    refresh,
    refreshSubmissions,
    realtimeHandlers: {
      onInsert: handleSubmissionInsert,
      onUpdate: handleSubmissionUpdate,
      onDelete: handleSubmissionDelete,
    },
  }
}
