'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from '@/lib/better-auth-client'
import { workspacesSupabase } from '@/lib/api/workspaces-supabase'

interface WorkspaceInfo {
  id: string
  name: string
  slug: string
}

/**
 * Workspace Resolution Hook
 * 
 * Centralizes workspace resolution logic:
 * 1. Tries localStorage lastWorkspace
 * 2. Falls back to fetching first available workspace
 * 3. Saves resolved workspace to localStorage
 * 
 * @returns Functions and state for workspace navigation
 */
export function useWorkspaceResolution() {
  const router = useRouter()
  const { data: session, isPending } = useSession()
  const [isResolving, setIsResolving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * Get workspace info from localStorage
   */
  const getLastWorkspace = useCallback((): WorkspaceInfo | null => {
    if (typeof window === 'undefined') return null
    
    const lastWorkspace = localStorage.getItem('lastWorkspace')
    if (!lastWorkspace) return null

    try {
      // Try parsing as JSON object first
      const workspace = JSON.parse(lastWorkspace)
      if (workspace.id && workspace.slug) {
        return workspace
      }
    } catch {
      // If JSON parse fails, treat as slug string
      return { id: '', slug: lastWorkspace, name: '' }
    }

    return null
  }, [])

  /**
   * Save workspace to localStorage
   */
  const saveLastWorkspace = useCallback((workspace: WorkspaceInfo) => {
    if (typeof window === 'undefined') return
    localStorage.setItem('lastWorkspace', JSON.stringify(workspace))
  }, [])

  /**
   * Fetch user's first available workspace
   */
  const fetchFirstWorkspace = useCallback(async (): Promise<WorkspaceInfo | null> => {
    if (!session?.user?.id) return null

    try {
      const workspaces = await workspacesSupabase.getWorkspacesForUser(session.user.id)
      if (workspaces && workspaces.length > 0) {
        const first = workspaces[0]
        return {
          id: first.id,
          name: first.name,
          slug: first.slug,
        }
      }
    } catch (err) {
      console.error('[Workspace Resolution] Failed to fetch workspaces:', err)
      throw err
    }

    return null
  }, [session?.user?.id])

  /**
   * Resolve workspace and navigate to it
   * Returns the resolved workspace slug
   */
  const resolveAndNavigate = useCallback(async (): Promise<string | null> => {
    if (isPending || !session?.user) {
      return null
    }

    setIsResolving(true)
    setError(null)

    try {
      // 1. Try localStorage first
      let workspace = getLastWorkspace()
      
      // 2. If no lastWorkspace, fetch first available
      if (!workspace) {
        workspace = await fetchFirstWorkspace()
        
        // 3. Save it for next time
        if (workspace) {
          saveLastWorkspace(workspace)
        }
      }

      // 4. Navigate if we found a workspace
      if (workspace?.slug) {
        router.push(`/workspace/${workspace.slug}`)
        return workspace.slug
      } else {
        setError('No workspaces available')
        return null
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to resolve workspace'
      setError(errorMessage)
      console.error('[Workspace Resolution]', errorMessage)
      return null
    } finally {
      setIsResolving(false)
    }
  }, [isPending, session, router, getLastWorkspace, fetchFirstWorkspace, saveLastWorkspace])

  /**
   * Navigate to last workspace or first available
   * Convenience function that just triggers navigation
   */
  const goToWorkspace = useCallback(async () => {
    await resolveAndNavigate()
  }, [resolveAndNavigate])

  /**
   * Get workspace URL without navigating
   */
  const getWorkspaceUrl = useCallback(async (): Promise<string | null> => {
    if (isPending || !session?.user) return null

    let workspace = getLastWorkspace()
    
    if (!workspace) {
      workspace = await fetchFirstWorkspace()
      if (workspace) {
        saveLastWorkspace(workspace)
      }
    }

    return workspace?.slug ? `/workspace/${workspace.slug}` : null
  }, [isPending, session, getLastWorkspace, fetchFirstWorkspace, saveLastWorkspace])

  return {
    // Functions
    goToWorkspace,
    resolveAndNavigate,
    getWorkspaceUrl,
    getLastWorkspace,
    saveLastWorkspace,
    
    // State
    isResolving,
    error,
    isAuthenticated: !!session?.user,
  }
}
