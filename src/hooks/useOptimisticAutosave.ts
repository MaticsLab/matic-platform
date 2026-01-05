import { useState, useCallback, useRef, useEffect } from 'react'
import { submissionsClient, AutosaveResponse } from '@/lib/api/submissions-client'
import { toast } from 'sonner'

interface UseOptimisticAutosaveOptions {
  submissionId: string
  initialData: Record<string, any>
  initialVersion: number
  debounceMs?: number
  onConflict?: (serverData: Record<string, any>, serverVersion: number) => void
  onSaveSuccess?: (version: number) => void
  onSaveError?: (error: Error) => void
  enabled?: boolean
}

interface UseOptimisticAutosaveReturn {
  formData: Record<string, any>
  version: number
  isSaving: boolean
  lastSavedAt: Date | null
  hasPendingChanges: boolean
  handleFieldChange: (fieldId: string, value: any) => void
  handleBatchChange: (changes: Record<string, any>) => void
  forceSave: () => Promise<void>
  resetToServerData: (data: Record<string, any>, version: number) => void
}

/**
 * Hook for optimistic autosave with conflict detection
 * 
 * Features:
 * - Only sends changed fields (not full form)
 * - Detects version conflicts
 * - Debounced saving (default 2s)
 * - Tracks pending changes for beforeunload warnings
 */
export function useOptimisticAutosave({
  submissionId,
  initialData,
  initialVersion,
  debounceMs = 2000,
  onConflict,
  onSaveSuccess,
  onSaveError,
  enabled = true,
}: UseOptimisticAutosaveOptions): UseOptimisticAutosaveReturn {
  // State
  const [formData, setFormData] = useState<Record<string, any>>(initialData)
  const [version, setVersion] = useState(initialVersion)
  const [isSaving, setIsSaving] = useState(false)
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null)

  // Refs for avoiding stale closures
  const lastSavedDataRef = useRef<Record<string, any>>(initialData)
  const pendingChangesRef = useRef<Record<string, any>>({})
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)
  const isSavingRef = useRef(false)
  const versionRef = useRef(initialVersion)

  // Keep version ref in sync
  useEffect(() => {
    versionRef.current = version
  }, [version])

  // Update refs when initial data changes (e.g., on load)
  useEffect(() => {
    if (initialData && Object.keys(initialData).length > 0) {
      lastSavedDataRef.current = initialData
      setFormData(initialData)
    }
  }, [initialData])

  useEffect(() => {
    versionRef.current = initialVersion
    setVersion(initialVersion)
  }, [initialVersion])

  // Autosave function
  const autosave = useCallback(async () => {
    if (!enabled || !submissionId || isSavingRef.current) return
    
    const changes = { ...pendingChangesRef.current }
    if (Object.keys(changes).length === 0) return

    isSavingRef.current = true
    setIsSaving(true)

    try {
      const response = await submissionsClient.autosave(submissionId, {
        changes,
        base_version: versionRef.current,
      })

      if (response.conflict) {
        // Handle conflict
        console.warn('Autosave conflict detected', {
          clientVersion: versionRef.current,
          serverVersion: response.server_version,
        })
        
        toast.warning('Your changes conflicted with a newer version', {
          description: 'The form has been updated with the latest data.',
          action: {
            label: 'View Changes',
            onClick: () => onConflict?.(response.server_data!, response.server_version!),
          },
        })

        // Update to server state
        if (response.server_data) {
          lastSavedDataRef.current = response.server_data
          setFormData(response.server_data)
        }
        if (response.server_version) {
          versionRef.current = response.server_version
          setVersion(response.server_version)
        }
        pendingChangesRef.current = {}

        onConflict?.(response.server_data!, response.server_version!)
      } else {
        // Success - update refs
        Object.keys(changes).forEach(key => {
          lastSavedDataRef.current[key] = changes[key]
        })
        pendingChangesRef.current = {}
        versionRef.current = response.version
        setVersion(response.version)
        setLastSavedAt(new Date(response.saved_at))

        onSaveSuccess?.(response.version)
      }
    } catch (error) {
      console.error('Autosave failed:', error)
      // Keep pending changes for retry
      onSaveError?.(error as Error)
    } finally {
      isSavingRef.current = false
      setIsSaving(false)
    }
  }, [submissionId, enabled, onConflict, onSaveSuccess, onSaveError])

  // Handle single field change
  const handleFieldChange = useCallback((fieldId: string, value: any) => {
    setFormData(prev => ({ ...prev, [fieldId]: value }))

    // Track change if different from last saved
    const lastSavedValue = lastSavedDataRef.current[fieldId]
    if (JSON.stringify(lastSavedValue) !== JSON.stringify(value)) {
      pendingChangesRef.current[fieldId] = value
    } else {
      // Value reverted to saved state
      delete pendingChangesRef.current[fieldId]
    }

    // Clear existing timer and set new one
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }
    debounceTimerRef.current = setTimeout(autosave, debounceMs)
  }, [autosave, debounceMs])

  // Handle batch changes (multiple fields at once)
  const handleBatchChange = useCallback((changes: Record<string, any>) => {
    setFormData(prev => ({ ...prev, ...changes }))

    // Track all changes
    Object.entries(changes).forEach(([fieldId, value]) => {
      const lastSavedValue = lastSavedDataRef.current[fieldId]
      if (JSON.stringify(lastSavedValue) !== JSON.stringify(value)) {
        pendingChangesRef.current[fieldId] = value
      } else {
        delete pendingChangesRef.current[fieldId]
      }
    })

    // Debounce
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }
    debounceTimerRef.current = setTimeout(autosave, debounceMs)
  }, [autosave, debounceMs])

  // Force save immediately (for beforeunload, navigation, etc.)
  const forceSave = useCallback(async () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = null
    }
    await autosave()
  }, [autosave])

  // Reset to server data (after conflict resolution)
  const resetToServerData = useCallback((data: Record<string, any>, newVersion: number) => {
    lastSavedDataRef.current = data
    pendingChangesRef.current = {}
    setFormData(data)
    setVersion(newVersion)
    versionRef.current = newVersion
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [])

  // Warn about unsaved changes before unload
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (Object.keys(pendingChangesRef.current).length > 0) {
        e.preventDefault()
        e.returnValue = 'You have unsaved changes. Are you sure you want to leave?'
        return e.returnValue
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [])

  return {
    formData,
    version,
    isSaving,
    lastSavedAt,
    hasPendingChanges: Object.keys(pendingChangesRef.current).length > 0,
    handleFieldChange,
    handleBatchChange,
    forceSave,
    resetToServerData,
  }
}

/**
 * Simplified hook for forms that don't need full optimistic features
 * Just provides debounced autosave
 */
export function useSimpleAutosave(
  submissionId: string | undefined,
  formData: Record<string, any>,
  version: number,
  debounceMs = 3000
) {
  const [isSaving, setIsSaving] = useState(false)
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null)
  const lastSavedRef = useRef<string>('')
  const isSavingRef = useRef(false)

  useEffect(() => {
    if (!submissionId || isSavingRef.current) return

    const dataString = JSON.stringify(formData)
    if (dataString === lastSavedRef.current) return

    const timer = setTimeout(async () => {
      isSavingRef.current = true
      setIsSaving(true)

      try {
        await submissionsClient.save(submissionId, formData, version)
        lastSavedRef.current = dataString
        setLastSavedAt(new Date())
      } catch (error) {
        console.error('Autosave failed:', error)
      } finally {
        isSavingRef.current = false
        setIsSaving(false)
      }
    }, debounceMs)

    return () => clearTimeout(timer)
  }, [submissionId, formData, version, debounceMs])

  return { isSaving, lastSavedAt }
}
