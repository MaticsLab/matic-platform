"use client"

import { useState, useEffect } from 'react'
import { getCurrentUser } from '@/lib/supabase'
import { workspacesSupabase } from '@/lib/api/workspaces-supabase'
import { useRouter } from 'next/navigation'
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
  const [user, setUser] = useState<any>(null)
  const router = useRouter()

  useEffect(() => {
    const getUser = async () => {
      const user = await getCurrentUser()
      setUser(user)
      if (user) {
        await fetchWorkspaces(user.id)
      }
      setLoading(false)
    }

    getUser()
  }, [])

  const fetchWorkspaces = async (userId: string) => {
    try {
      console.log('🔍 Fetching workspaces from Supabase for user:', userId)
      
      // Fetch from Supabase Direct (uses auth context internally)
      const apiWorkspaces = await workspacesSupabase.getWorkspacesForUser(userId)
      
      // Convert API response to hook format
      const formattedWorkspaces: Workspace[] = apiWorkspaces.map((workspace: APIWorkspace) => ({
        id: workspace.id,
        name: workspace.name,
        slug: workspace.slug,
        plan: 'free' // TODO: Add plan field to backend
      }))
      
      console.log('✅ Workspaces loaded:', formattedWorkspaces)
      setWorkspaces(formattedWorkspaces)
      
      // Set first workspace as current if none selected
      if (formattedWorkspaces.length > 0 && !currentWorkspace) {
        setCurrentWorkspace(formattedWorkspaces[0])
      }
      
      return formattedWorkspaces
    } catch (error) {
      console.error('❌ Error fetching workspaces:', error)
      setWorkspaces([])
      return []
    }
  }

  const switchToWorkspace = (workspaceSlug: string) => {
    console.log('🔄 Switching to workspace:', workspaceSlug)
    router.push(`/w/${workspaceSlug}`)
  }

  const findUserWorkspace = async (): Promise<string | null> => {
    if (!user) return null
    
    const userWorkspaces = await fetchWorkspaces(user.id)
    
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
    workspaces,
    currentWorkspace,
    loading,
    user,
    fetchWorkspaces: () => user ? fetchWorkspaces(user.id) : Promise.resolve([]),
    switchToWorkspace,
    findUserWorkspace,
    setCurrentWorkspaceBySlug
  }
}
