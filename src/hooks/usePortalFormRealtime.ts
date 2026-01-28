'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { RealtimeChannel } from '@supabase/supabase-js'

interface UsePortalFormRealtimeOptions {
  formId: string
  submissionId?: string | null
  email: string
  enabled?: boolean
  onDataUpdate?: (data: Record<string, any>) => void
  onSave?: (data: Record<string, any>) => Promise<void>
}

interface UsePortalFormRealtimeReturn {
  status: 'connecting' | 'connected' | 'disconnected' | 'error'
  saveData: (data: Record<string, any>) => Promise<void>
  isSaving: boolean
}

/**
 * Hook for real-time form data synchronization in public portal
 * Uses Supabase Realtime to sync form data across sessions
 */
export function usePortalFormRealtime({
  formId,
  submissionId,
  email,
  enabled = true,
  onDataUpdate,
  onSave,
}: UsePortalFormRealtimeOptions): UsePortalFormRealtimeReturn {
  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected')
  const [isSaving, setIsSaving] = useState(false)
  const channelRef = useRef<RealtimeChannel | null>(null)
  const onDataUpdateRef = useRef(onDataUpdate)
  const onSaveRef = useRef(onSave)
  const lastSavedDataRef = useRef<string>('')
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Update refs when callbacks change
  useEffect(() => {
    onDataUpdateRef.current = onDataUpdate
    onSaveRef.current = onSave
  }, [onDataUpdate, onSave])

  // Save function that debounces rapid changes
  const saveData = useCallback(async (data: Record<string, any>) => {
    // Early return if not enabled or missing required params
    if (!enabled || !submissionId || !formId || !email) {
      return
    }

    const dataString = JSON.stringify(data)
    
    // Skip if data hasn't changed
    if (dataString === lastSavedDataRef.current) {
      return
    }

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    // Debounce: wait 300ms before saving to batch rapid changes
    saveTimeoutRef.current = setTimeout(async () => {
      setIsSaving(true)
      try {
        // Use custom save handler if provided, otherwise use default
        if (onSaveRef.current) {
          await onSaveRef.current(data)
          // Only update lastSavedDataRef if save succeeded
          lastSavedDataRef.current = dataString
        } else {
          // Default: save to backend API
          const baseUrl = typeof window !== 'undefined' && window.location.hostname === 'localhost'
            ? 'http://localhost:8080/api/v1'
            : process.env.NEXT_PUBLIC_GO_API_URL || 'https://api.maticsapp.com/api/v1'
          
          const response = await fetch(`${baseUrl}/submissions/${submissionId}/autosave`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ data }),
          })
          
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}))
            throw new Error(errorData.error || `Save failed with status ${response.status}`)
          }
          
          // Only update lastSavedDataRef if save succeeded
          lastSavedDataRef.current = dataString
        }
      } catch (error) {
        console.error('Failed to save form data:', error)
        // Don't update lastSavedDataRef on error so it will retry on next change
        throw error // Re-throw to allow caller to handle
      } finally {
        setIsSaving(false)
      }
    }, 300)
  }, [formId, submissionId, email])

  // Set up Supabase Realtime subscription
  useEffect(() => {
    if (!enabled || !formId || !submissionId || !email) {
      setStatus('disconnected')
      return
    }

    // Safety check for Supabase client
    try {
      if (!supabase || typeof supabase.channel !== 'function') {
        console.warn('Supabase client not available, skipping realtime subscription')
        setStatus('disconnected')
        return
      }

      console.log('🔌 Setting up Portal Form Realtime subscription', { formId, submissionId })
      setStatus('connecting')

      // Create a unique channel for this form submission
      const channelName = `portal-form-${formId}-${submissionId}`
      const channel = supabase.channel(channelName)

      // Subscribe to changes in the submission data
      // Submissions are stored in application_submissions table
      channel
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'application_submissions',
            filter: `id=eq.${submissionId}`,
          },
          (payload) => {
            console.log('🔄 Portal form data updated via Realtime:', payload)
            
            try {
              const updatedRow = payload.new as any
              let formData: Record<string, any> = {}
              
              // Parse the data field (it might be JSON string or object)
              if (updatedRow.data) {
                if (typeof updatedRow.data === 'string') {
                  formData = JSON.parse(updatedRow.data)
                } else {
                  formData = updatedRow.data
                }
              }
              
              // Only update if this change didn't come from us
              const currentDataString = JSON.stringify(formData)
              if (currentDataString !== lastSavedDataRef.current) {
                lastSavedDataRef.current = currentDataString
                onDataUpdateRef.current?.(formData)
              }
            } catch (error) {
              console.error('Failed to parse realtime update:', error)
            }
          }
        )
        .subscribe((status) => {
          console.log('📡 Portal form realtime status:', status)
          
          if (status === 'SUBSCRIBED') {
            setStatus('connected')
          } else if (status === 'CHANNEL_ERROR') {
            setStatus('disconnected') // Use 'disconnected' instead of 'error' to prevent UI issues
          } else if (status === 'TIMED_OUT' || status === 'CLOSED') {
            setStatus('disconnected')
          }
        })

      channelRef.current = channel
    } catch (error) {
      console.error('Failed to set up realtime subscription:', error)
      setStatus('disconnected') // Use 'disconnected' instead of 'error' to prevent UI issues
    }

    // Cleanup
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
      if (channelRef.current) {
        try {
          supabase.removeChannel(channelRef.current)
        } catch (error) {
          console.warn('Error removing channel:', error)
        }
        channelRef.current = null
      }
      setStatus('disconnected')
    }
  }, [enabled, formId, submissionId, email])

  // Return disconnected state if not enabled
  const finalStatus = (!enabled || !formId || !submissionId || !email) ? 'disconnected' : status
  const finalSaveData = (!enabled || !formId || !submissionId || !email) 
    ? (async () => {}) 
    : saveData

  return {
    status: finalStatus,
    saveData: finalSaveData,
    isSaving: (!enabled || !formId || !submissionId || !email) ? false : isSaving,
  }
}
