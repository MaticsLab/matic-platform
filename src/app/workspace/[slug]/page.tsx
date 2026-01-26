'use client'

import { useEffect, useState, Suspense } from 'react'
import { useParams } from 'next/navigation'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { NavigationLayout } from '@/components/NavigationLayout'
import { WorkspaceTabProvider } from '@/components/WorkspaceTabProvider'
import { TabContentRouter } from '@/components/TabContentRouter'
import { workspacesSupabase } from '@/lib/api/workspaces-supabase'
import { saveLastWorkspace } from '@/lib/utils'
import type { Workspace } from '@/types/workspaces'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

function WorkspacePageContent() {
  const params = useParams()
  const slug = params.slug as string
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (slug) {
      loadWorkspace()
    }
  }, [slug])

  async function loadWorkspace() {
    try {
      setLoading(true)
      setError(null)
      const data = await workspacesSupabase.getWorkspaceBySlug(slug)
      
      if (!data) {
        throw new Error('Workspace not found')
      }
      
      setWorkspace(data)
      
      // Save this as the last visited workspace
      saveLastWorkspace(slug)
    } catch (err: any) {
      console.error('Failed to load workspace:', err)
      const errorMessage = err?.message || err?.error || 'Failed to load workspace'
      setError(errorMessage)
      toast.error(`Failed to load workspace: ${errorMessage}`)
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
          <a href="/signup-v2?mode=login" className="text-blue-600 hover:underline">
            Back to Login
          </a>
        </div>
      </div>
    )
  }

  // Ensure workspace.id is a string
  const workspaceId = typeof workspace.id === 'string' ? workspace.id : String(workspace.id)
  
  // Validate workspaceId before rendering
  if (!workspaceId || workspaceId === 'undefined' || workspaceId === 'null') {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2 text-gray-900">Invalid Workspace</h1>
          <p className="text-gray-600 mb-4">Workspace ID is missing or invalid</p>
          <a href="/signup-v2?mode=login" className="text-blue-600 hover:underline">
            Back to Login
          </a>
        </div>
      </div>
    )
  }
  
  try {
    return (
      <WorkspaceTabProvider workspaceId={workspaceId}>
        <NavigationLayout workspaceSlug={slug}>
          <TabContentRouter workspaceId={workspaceId} />
        </NavigationLayout>
      </WorkspaceTabProvider>
    )
  } catch (renderError: any) {
    console.error('Error rendering workspace page:', renderError)
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2 text-gray-900">Render Error</h1>
          <p className="text-gray-600 mb-4">{renderError?.message || 'Failed to render workspace'}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="text-blue-600 hover:underline"
          >
            Reload Page
          </button>
        </div>
      </div>
    )
  }
}

export default function WorkspacePage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    }>
      <ProtectedRoute>
        <WorkspacePageContent />
      </ProtectedRoute>
    </Suspense>
  )
}
