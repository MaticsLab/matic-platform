"use client"

import { useState, useEffect, useCallback, useRef } from 'react'
import { workspacesSupabase } from '@/lib/api/workspaces-supabase'
import { useRouter } from 'next/navigation'
import { useSession } from '@/lib/better-auth-client'
import type { Workspace as APIWorkspace } from '@/types/workspaces'

interface Workspace {
  id: string
  name: string
  slug: string
  plan: string
}

export function useWorkspaceDiscovery() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const { data, isPending: authLoading } = useSession()
  const hybridUser = data?.user || null
  const isAuthenticated = !!hybridUser
  
  // Track if we've already fetched to prevent infinite loops
  const hasFetchedRef = useRef(false)

  const fetchWorkspaces = useCallback(async (userId: string) => {
    try {
      console.log('🔍 Fetching workspaces for user:', userId)
      
      // Fetch from Go backend (uses auth context internally)
      const apiWorkspaces = await workspacesSupabase.getWorkspacesForUser(userId)
      
      // Ensure apiWorkspaces is an array
      const workspacesArray = Array.isArray(apiWorkspaces) ? apiWorkspaces : []
      
      // Convert API response to hook format
      const formattedWorkspaces: Workspace[] = workspacesArray.map((workspace: APIWorkspace) => ({
        id: workspace.id,
        name: workspace.name,
        slug: workspace.slug,
        plan: 'free' // TODO: Add plan field to backend
      }))
      
      console.log('✅ Workspaces loaded:', formattedWorkspaces)
      setWorkspaces(formattedWorkspaces)
      
      return formattedWorkspaces
    } catch (error) {
      console.error('❌ Error fetching workspaces:', error)
      setWorkspaces([])
      return []
    }
  }, []) // No dependencies - function doesn't depend on external state

  useEffect(() => {
    const loadWorkspaces = async () => {
      // Wait for auth to finish loading
      if (authLoading) return
      
      // Prevent duplicate fetches
      if (hasFetchedRef.current) return
      
      if (isAuthenticated && hybridUser) {
        hasFetchedRef.current = true
        const loaded = await fetchWorkspaces(hybridUser.id)
        
        // Set first workspace as current if none selected
        if (loaded.length > 0) {
          setCurrentWorkspace(prev => prev || loaded[0])
        }
      }
      setLoading(false)
    }

    loadWorkspaces()
  }, [authLoading, isAuthenticated, hybridUser, fetchWorkspaces])

  const switchToWorkspace = (workspaceSlug: string) => {
    console.log('🔄 Switching to workspace:', workspaceSlug)
    router.push(`/w/${workspaceSlug}`)
  }

  const findUserWorkspace = async (): Promise<string | null> => {
    if (!hybridUser) return null
    
    const userWorkspaces = await fetchWorkspaces(hybridUser.id)
    
    if (userWorkspaces.length > 0) {
      return userWorkspaces[0].slug // Return first workspace
    }
    
    return null
  }

  const setCurrentWorkspaceBySlug = (slugOrId: string) => {
    // Support both slug (e.g., "BPNC") and ID (UUID)
    const workspace = workspaces.find(w => w.slug === slugOrId || w.id === slugOrId)
    if (workspace) {
      console.log('✅ Setting current workspace:', workspace)
      setCurrentWorkspace(workspace)
      localStorage.setItem('lastWorkspace', JSON.stringify(workspace))
    } else {
      console.log('⚠️ Workspace not found with slug/id:', slugOrId, 'Available workspaces:', workspaces)
    }
  }

  return {
    workspaces: Array.isArray(workspaces) ? workspaces : [],
    currentWorkspace,
    loading: loading || authLoading,
    user: hybridUser,
    fetchWorkspaces: () => hybridUser ? fetchWorkspaces(hybridUser.id) : Promise.resolve([]),
    switchToWorkspace,
    findUserWorkspace,
    setCurrentWorkspaceBySlug
  }
}
