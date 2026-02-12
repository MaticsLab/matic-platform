'use client'

import { useEffect, useState, Suspense } from 'react'
import { useParams } from 'next/navigation'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { NavigationLayout } from '@/components/NavigationLayout'
import { BreadcrumbProvider } from '@/components/BreadcrumbProvider'
import { BreadcrumbBar } from '@/components/BreadcrumbBar'
import { workspacesSupabase } from '@/lib/api/workspaces-supabase'
import { saveLastWorkspace } from '@/lib/utils'
import type { Workspace } from '@/types/workspaces'
import { toast } from 'sonner'
import { LoadingOverlay } from '@/components/LoadingOverlay'

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
    return <LoadingOverlay message="Loading workspace..." />
  }

  if (error || !workspace) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2 text-gray-900">Workspace Not Found</h1>
          <p className="text-gray-600 mb-4">{error || 'Not Found'}</p>
          <a href="/?login=true" className="text-blue-600 hover:underline">
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
          <a href="/?login=true" className="text-blue-600 hover:underline">
            Back to Login
          </a>
        </div>
      </div>
    )
  }

  return (
    <BreadcrumbProvider workspaceSlug={slug}>
      <NavigationLayout workspaceSlug={slug}>
        <BreadcrumbBar />
        {/* This is where your page content goes */}
        {/* Each child route will render here and set its own breadcrumbs */}
        <div className="p-6">
          <h1 className="text-2xl font-bold">Welcome to {workspace.name}</h1>
          <p className="text-gray-600 mt-2">
            Select a section from the sidebar to get started
          </p>
        </div>
      </NavigationLayout>
    </BreadcrumbProvider>
  )
}

export default function WorkspacePage() {
  return (
    <ProtectedRoute requireOrganization>
      <Suspense fallback={<LoadingOverlay message="Loading..." />}>
        <WorkspacePageContent />
      </Suspense>
    </ProtectedRoute>
  )
}
