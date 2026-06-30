'use client'

import { useEffect, useRef, useState } from 'react'

export interface RealtimeApplication {
  id: string
  data: Record<string, any>
  metadata: Record<string, any>
  created_at: string
  submitted_at: string
}

interface UseApplicationsRealtimeOptions {
  formId: string | null
  workspaceId: string
  enabled?: boolean
  onInsert?: (app: RealtimeApplication) => void
  onUpdate?: (app: RealtimeApplication) => void
  onDelete?: (id: string) => void
}

export function useApplicationsRealtime({
  formId,
  workspaceId,
  enabled = true,
  onInsert,
  onUpdate,
  onDelete,
}: UseApplicationsRealtimeOptions) {
  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected')
  
  // Store callbacks in refs to avoid re-subscriptions
  const onInsertRef = useRef(onInsert)
  const onUpdateRef = useRef(onUpdate)
  const onDeleteRef = useRef(onDelete)
  
  useEffect(() => {
    onInsertRef.current = onInsert
    onUpdateRef.current = onUpdate
    onDeleteRef.current = onDelete
  }, [onInsert, onUpdate, onDelete])

  useEffect(() => {
    if (!formId || !enabled) {
      setStatus('disconnected')
      return
    }

    return () => {
      setStatus('disconnected')
    }
  }, [formId, enabled])

  return { status }
}

// Hook for workflow/stage changes
interface UseWorkflowRealtimeOptions {
  workspaceId: string
  workflowId?: string
  enabled?: boolean
  onStageChange?: () => void
  onWorkflowChange?: () => void
}

export function useWorkflowRealtime({
  workspaceId,
  workflowId,
  enabled = true,
  onStageChange,
  onWorkflowChange,
}: UseWorkflowRealtimeOptions) {
  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected')
  
  const onStageChangeRef = useRef(onStageChange)
  const onWorkflowChangeRef = useRef(onWorkflowChange)
  
  useEffect(() => {
    onStageChangeRef.current = onStageChange
    onWorkflowChangeRef.current = onWorkflowChange
  }, [onStageChange, onWorkflowChange])

  useEffect(() => {
    if (!workspaceId || !enabled) {
      setStatus('disconnected')
      return
    }

    return () => {
      setStatus('disconnected')
    }
  }, [workspaceId, workflowId, enabled])

  return { status }
}
