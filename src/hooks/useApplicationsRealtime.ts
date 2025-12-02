'use client'

import { useEffect, useCallback, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { RealtimeChannel } from '@supabase/supabase-js'

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
  const channelRef = useRef<RealtimeChannel | null>(null)
  
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

    console.log('🔌 Setting up Applications Realtime subscription for form:', formId)
    setStatus('connecting')

    const channel = supabase
      .channel(`applications-${formId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'form_submissions',
          filter: `form_id=eq.${formId}`
        },
        (payload) => {
          console.log('🔄 Realtime submission update:', payload.eventType, payload)
          
          if (payload.eventType === 'INSERT') {
            const newRow = payload.new as any
            // Parse data and metadata if they're strings
            let data = newRow.data
            let metadata = newRow.metadata
            
            if (typeof data === 'string') {
              try { data = JSON.parse(data) } catch { data = {} }
            }
            if (typeof metadata === 'string') {
              try { metadata = JSON.parse(metadata) } catch { metadata = {} }
            }
            
            const app: RealtimeApplication = {
              id: newRow.id,
              data: data || {},
              metadata: metadata || {},
              created_at: newRow.created_at,
              submitted_at: newRow.submitted_at || newRow.created_at,
            }
            
            onInsertRef.current?.(app)
          } else if (payload.eventType === 'UPDATE') {
            const updatedRow = payload.new as any
            let data = updatedRow.data
            let metadata = updatedRow.metadata
            
            if (typeof data === 'string') {
              try { data = JSON.parse(data) } catch { data = {} }
            }
            if (typeof metadata === 'string') {
              try { metadata = JSON.parse(metadata) } catch { metadata = {} }
            }
            
            const app: RealtimeApplication = {
              id: updatedRow.id,
              data: data || {},
              metadata: metadata || {},
              created_at: updatedRow.created_at,
              submitted_at: updatedRow.submitted_at || updatedRow.created_at,
            }
            
            onUpdateRef.current?.(app)
          } else if (payload.eventType === 'DELETE') {
            const deletedId = (payload.old as any).id
            onDeleteRef.current?.(deletedId)
          }
        }
      )
      .subscribe((status) => {
        console.log('📡 Applications realtime status:', status)
        if (status === 'SUBSCRIBED') {
          setStatus('connected')
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          setStatus('disconnected')
        }
      })

    channelRef.current = channel

    return () => {
      console.log('🔌 Cleaning up Applications Realtime subscription')
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
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
  const channelRef = useRef<RealtimeChannel | null>(null)
  
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

    console.log('🔌 Setting up Workflow Realtime subscription')
    setStatus('connecting')

    let channel = supabase.channel(`workflow-${workspaceId}`)

    // Subscribe to workflow stages changes
    if (workflowId) {
      channel = channel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'workflow_stages',
          filter: `review_workflow_id=eq.${workflowId}`
        },
        () => {
          console.log('🔄 Stage changed')
          onStageChangeRef.current?.()
        }
      )
    }

    // Subscribe to stage configs changes
    channel = channel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'stage_reviewer_configs',
      },
      () => {
        console.log('🔄 Stage config changed')
        onStageChangeRef.current?.()
      }
    )

    // Subscribe to workflow changes
    channel = channel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'review_workflows',
        filter: `workspace_id=eq.${workspaceId}`
      },
      () => {
        console.log('🔄 Workflow changed')
        onWorkflowChangeRef.current?.()
      }
    )

    channel.subscribe((status) => {
      console.log('📡 Workflow realtime status:', status)
      if (status === 'SUBSCRIBED') {
        setStatus('connected')
      } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
        setStatus('disconnected')
      }
    })

    channelRef.current = channel

    return () => {
      console.log('🔌 Cleaning up Workflow Realtime subscription')
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
      setStatus('disconnected')
    }
  }, [workspaceId, workflowId, enabled])

  return { status }
}
