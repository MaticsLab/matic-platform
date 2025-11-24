'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { NavigationLayout } from '@/components/NavigationLayout'
import { WorkspaceTabProvider } from '@/components/WorkspaceTabProvider'
import { TabContentRouter } from '@/components/TabContentRouter'
import { workspacesSupabase } from '@/lib/api/workspaces-supabase'
import { saveLastWorkspace } from '@/lib/utils'
import type { Workspace } from '@/types/workspaces'

export default function WorkspacePage() {
  const params = useParams()
  const slug = params.slug as string
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadWorkspace()
  }, [slug])

  async function loadWorkspace() {
    try {
      setLoading(true)
      const data = await workspacesSupabase.getWorkspaceBySlug(slug)
      setWorkspace(data)
      
      // Save this as the last visited workspace
      saveLastWorkspace(slug)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load workspace')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-gray-500">Loading workspace...</div>
      </div>
    )
  }

  if (error || !workspace) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2 text-gray-900">Workspace Not Found</h1>
          <p className="text-gray-600 mb-4">{error || 'Not Found'}</p>
          <a href="/login" className="text-blue-600 hover:underline">
            Back to Login
          </a>
        </div>
      </div>
    )
  }

  return (
    <WorkspaceTabProvider workspaceId={workspace.id}>
      <NavigationLayout workspaceSlug={slug}>
        <TabContentRouter workspaceId={workspace.id} />
      </NavigationLayout>
    </WorkspaceTabProvider>
  )
}
